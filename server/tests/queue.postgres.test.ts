import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Pool } from 'pg';
import { createPostgresQueueRepository } from '../src/modules/queue/queue.repository.ts';

const userId = '11111111-1111-4111-8111-111111111111';
const serviceId = '22222222-2222-4222-8222-222222222222';
const entryId = '33333333-3333-4333-8333-333333333333';
const queueId = '44444444-4444-4444-8444-444444444444';
const joinedAt = new Date('2026-11-06T16:00:00Z');
const startedAt = new Date('2026-11-06T16:05:00Z');
const endedAt = new Date('2026-11-06T16:10:00Z');
const row = {
  id: entryId, userId, serviceId, priority: 2, joinedAt, status: 'queued',
  endedAt: null, serviceStartedAt: null, completedAt: null,
  serviceName: 'CTAP', userName: 'Student', position: 1,
};

type Reply = { rows?: readonly object[]; rowCount?: number; error?: Error };

// This adapter tests repository decisions and transaction handling. Real SQL,
// locking, constraints, and concurrency are tested separately in *.integration.ts.
function database(replies: Reply[]) {
  const remaining = [...replies];
  const calls: { sql: string; values?: unknown[] }[] = [];
  let releases = 0;
  async function query(sql: string, values?: unknown[]) {
    calls.push({ sql: sql.trim(), values });
    const reply = remaining.shift();
    assert.ok(reply, `Unexpected query: ${sql}`);
    if (reply.error) throw reply.error;
    return { rows: reply.rows ?? [], rowCount: reply.rowCount ?? reply.rows?.length ?? 0 };
  }
  const db = { query, connect: async () => ({ query, release: () => { releases++; } }) };
  return {
    repository: createPostgresQueueRepository(db as unknown as Pool), calls,
    verify(transaction?: 'COMMIT' | 'ROLLBACK') {
      assert.equal(remaining.length, 0, 'All expected database replies were consumed');
      if (transaction) {
        assert.equal(calls[0].sql, 'BEGIN');
        assert.equal(calls.at(-1)?.sql, transaction);
        assert.equal(releases, 1, 'Transaction connection must be released');
      }
    },
  };
}

test('PostgreSQL queue maps waiting visits and captures join-time metadata', async () => {
  const db = database([{ rows: [row, { ...row, userName: null, position: 2 }] }, {}, { rows: [row] }, {}, {}, {}]);
  const waiting = await db.repository.listWaiting(serviceId);
  assert.equal(waiting[0].position, 1);
  assert.equal(waiting[0].joinedAt, joinedAt.toISOString());
  assert.equal(waiting[1].userName, undefined);
  const joined = await db.repository.join(userId, serviceId);
  assert.equal(joined.serviceName, 'CTAP');
  assert.equal(joined.priority, 2);
  assert.equal(joined.serviceStartedAt, null);
  assert.deepEqual(db.calls[2].values, [userId, serviceId]);
  db.verify();
});

test('PostgreSQL queue rejects invalid IDs before querying', async () => {
  const db = database([]);
  for (const action of [
    () => db.repository.join('bad', serviceId), () => db.repository.join(userId, 'bad'),
    () => db.repository.leave('bad', entryId), () => db.repository.leave(userId, 'bad'),
    () => db.repository.startService('bad', entryId), () => db.repository.startService(serviceId, 'bad'),
    () => db.repository.completeService('bad'), () => db.repository.setQueueStatus('bad', 'open'),
    () => db.repository.setQueueStatus(serviceId, 'invalid' as 'open'),
  ]) await assert.rejects(action, { status: 400, code: 'INVALID_INPUT' });
  assert.equal(db.calls.length, 0);
});

test('PostgreSQL queue distinguishes closed, missing, duplicate, and failed joins', async () => {
  for (const [rows, code, status] of [
    [[], 'QUEUE_NOT_FOUND', 404], [[{ status: 'closed' }], 'QUEUE_CLOSED', 409],
  ] as const) {
    const db = database([{}, { rows: [] }, { rows: [...rows] }, {}]);
    await assert.rejects(db.repository.join(userId, serviceId), { status, code });
    db.verify('ROLLBACK');
  }
  const duplicate = database([{}, { error: Object.assign(new Error('duplicate'), { code: '23505' }) }, {}]);
  await assert.rejects(duplicate.repository.join(userId, serviceId), { status: 409, code: 'ALREADY_IN_QUEUE' });
  const failure = new Error('Database offline');
  const failed = database([{}, { error: failure }, {}]);
  await assert.rejects(failed.repository.join(userId, serviceId), error => error === failure);
});

test('PostgreSQL queue leaves only an owned waiting visit', async () => {
  const db = database([{}, {}, { rows: [{ ...row, status: 'left', endedAt, userName: null }] }, {}, {}]);
  const left = await db.repository.leave(userId, entryId);
  assert.equal(left.status, 'left');
  assert.equal(left.endedAt, endedAt.toISOString());
  assert.deepEqual(db.calls[2].values, [userId, entryId]);
  db.verify('COMMIT');
  for (const [rows, status, code] of [
    [[], 404, 'ENTRY_NOT_FOUND'], [[{ status: 'serving' }], 409, 'NOT_WAITING'],
  ] as const) {
    const missing = database([{}, {}, { rows: [] }, { rows: [...rows] }, {}]);
    await assert.rejects(missing.repository.leave(userId, entryId), { status, code });
    missing.verify('ROLLBACK');
  }
});

test('PostgreSQL queue commits service start and returns updated queue state', async () => {
  const started = { ...row, status: 'serving', serviceStartedAt: startedAt };
  const db = database([
    {}, { rows: [{ queueId }] }, { rows: [{ id: entryId }] }, { rowCount: 1 },
    { rows: [started] }, { rows: [{ id: serviceId, name: 'CTAP' }] },
    { rows: [{ ...row, id: queueId, userName: null }] }, { rows: [started] }, {}, {},
  ]);
  const result = await db.repository.startService(serviceId, entryId);
  assert.equal(result.started.status, 'serving');
  assert.equal(result.started.serviceStartedAt, startedAt.toISOString());
  assert.equal(result.queue.waitingCount, 1);
  assert.equal(result.queue.nextEntryId, queueId);
  assert.equal(result.queue.entries[0].position, 1);
  assert.equal(result.queue.inService[0].id, entryId);
  db.verify('COMMIT');
});

test('PostgreSQL queue rolls back the visit if saving its notification fails', async () => {
  const failure = new Error('Notification storage failed');
  const joined = database([{}, { rows: [row] }, { error: failure }, {}]);
  await assert.rejects(joined.repository.join(userId, serviceId), error => error === failure);
  joined.verify('ROLLBACK');
  const left = database([{}, {}, { rows: [{ ...row, status: 'left', endedAt }] }, { error: failure }, {}]);
  await assert.rejects(left.repository.leave(userId, entryId), error => error === failure);
  left.verify('ROLLBACK');
});

test('PostgreSQL queue rolls back stale, empty, missing, and failed service starts', async () => {
  const scenarios: { replies: Reply[]; status: number; code: string }[] = [
    { replies: [{ rows: [] }], status: 404, code: 'SERVICE_NOT_FOUND' },
    { replies: [{ rows: [{ queueId }] }, { rows: [] }], status: 409, code: 'QUEUE_EMPTY' },
    { replies: [{ rows: [{ queueId }] }, { rows: [{ id: queueId }] }], status: 409, code: 'QUEUE_CHANGED' },
    { replies: [{ rows: [{ queueId }] }, { rows: [{ id: entryId }] }, { rowCount: 0 }], status: 409, code: 'QUEUE_CHANGED' },
    { replies: [{ rows: [{ queueId }] }, { rows: [{ id: entryId }] }, { rowCount: 1 }, { rows: [] }], status: 404, code: 'ENTRY_NOT_FOUND' },
    { replies: [{ rows: [{ queueId }] }, { rows: [{ id: entryId }] }, { rowCount: 1 }, { rows: [row] }, { rows: [] }], status: 404, code: 'SERVICE_NOT_FOUND' },
  ];
  for (const { replies, status, code } of scenarios) {
    const db = database([{}, ...replies, {}]);
    await assert.rejects(db.repository.startService(serviceId, entryId), { status, code });
    db.verify('ROLLBACK');
  }
  const failure = new Error('Write failed');
  const db = database([{}, { error: failure }, {}]);
  await assert.rejects(db.repository.startService(serviceId, entryId), error => error === failure);
  db.verify('ROLLBACK');
});

test('PostgreSQL queue commits completion with consistent timestamps and an empty queue', async () => {
  const db = database([
    {}, { rows: [{ serviceId, status: 'serving' }] }, { rowCount: 1 },
    { rows: [{ ...row, status: 'served', serviceStartedAt: startedAt, completedAt: endedAt, endedAt }] },
    { rows: [{ id: serviceId, name: 'CTAP' }] }, { rows: [] }, { rows: [] }, {},
  ]);
  const result = await db.repository.completeService(entryId);
  assert.equal(result.completed.status, 'served');
  assert.equal(result.completed.completedAt, result.completed.endedAt);
  assert.equal(result.queue.nextEntryId, null);
  assert.equal(result.queue.waitingCount, 0);
  db.verify('COMMIT');
});

test('PostgreSQL queue rolls back missing, already completed, and conflicting completions', async () => {
  for (const [replies, status, code] of [
    [[{ rows: [] }], 404, 'ENTRY_NOT_FOUND'],
    [[{ rows: [{ serviceId, status: 'served' }] }], 409, 'NOT_IN_SERVICE'],
    [[{ rows: [{ serviceId, status: 'serving' }] }, { rowCount: 0 }], 409, 'NOT_IN_SERVICE'],
  ] as const) {
    const db = database([{}, ...replies, {}]);
    await assert.rejects(db.repository.completeService(entryId), { status, code });
    db.verify('ROLLBACK');
  }
});

test('PostgreSQL queue opens and closes existing queues and rejects missing queues', async () => {
  for (const status of ['open', 'closed'] as const) {
    const db = database([{ rows: [{ id: queueId, serviceId, status, updatedAt: endedAt }] }]);
    assert.deepEqual(await db.repository.setQueueStatus(serviceId, status), {
      id: queueId, serviceId, status, updatedAt: endedAt.toISOString(),
    });
    assert.deepEqual(db.calls[0].values, [serviceId, status]);
    db.verify();
  }
  const db = database([{ rows: [] }]);
  await assert.rejects(db.repository.setQueueStatus(serviceId, 'closed'), { status: 404, code: 'QUEUE_NOT_FOUND' });
});
