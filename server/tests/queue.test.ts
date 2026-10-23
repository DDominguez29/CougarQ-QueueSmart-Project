import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createStore } from '../src/data/store.ts';
import { completeService, getQueue, listQueues, serveNext } from '../src/modules/queue/queue.service.ts';
import { validateCompletionBody, validateQueueQuery, validateServeNextBody } from '../src/modules/queue/queue.validation.ts';
import { admin, student, makeEntry, makeStore, expectApiError } from './fixtures.ts';

test('queue ordering uses priority, then arrival, then stable insertion order', () => {
  const store = makeStore([
    makeEntry({ id: 'normal-early', joinedAt: '2026-10-22T08:00:00.000Z' }),
    makeEntry({ id: 'urgent-late', priority: 2, joinedAt: '2026-10-22T10:00:00.000Z' }),
    makeEntry({ id: 'urgent-early', priority: 2, joinedAt: '2026-10-22T09:00:00.000Z' }),
    makeEntry({ id: 'urgent-tie', priority: 2, joinedAt: '2026-10-22T09:00:00.000Z' }),
  ]);
  const queue = getQueue(store, admin, 'ctap');
  assert.deepEqual(queue.entries.map((entry) => entry.id), ['urgent-early', 'urgent-tie', 'urgent-late', 'normal-early']);
  assert.deepEqual(queue.entries.map((entry) => entry.position), [1, 2, 3, 4]);
  assert.equal(queue.nextEntryId, 'urgent-early');
});

test('queue lists exclude completed entries and keep services separate', () => {
  const store = makeStore([
    makeEntry(),
    makeEntry({ id: 'served', status: 'served' }),
    makeEntry({ id: 'left', status: 'left' }),
    makeEntry({ id: 'support-entry', serviceId: 'support' }),
  ]);
  const result = listQueues(store, admin);
  assert.equal(result.totalWaiting, 2);
  assert.equal(result.queues[0].waitingCount, 1);
  assert.equal(result.queues[1].entries[0].position, 1);
  assert.deepEqual(listQueues(store, admin, 'support').queues.map((queue) => queue.service.id), ['support']);
});

test('an empty service has no next entry and an empty store has no queues', () => {
  assert.deepEqual(getQueue(makeStore(), admin, 'ctap').entries, []);
  assert.equal(getQueue(makeStore(), admin, 'ctap').nextEntryId, null);
  assert.deepEqual(listQueues(createStore(), admin), { queues: [], totalWaiting: 0 });
});

test('queue results cannot mutate the stored entry or service', () => {
  const store = makeStore([makeEntry()]);
  const queue = getQueue(store, admin, 'ctap');
  queue.entries[0].status = 'left';
  queue.service.name = 'Changed';
  assert.equal(store.queueEntries.get('entry-1')?.status, 'queued');
  assert.equal(store.services.get('ctap')?.name, 'CTAP Pickup');
});

test('queue operations reject unauthenticated and non-admin users', () => {
  const store = makeStore([makeEntry()]);
  expectApiError(() => listQueues(store, undefined), 401, 'UNAUTHENTICATED');
  expectApiError(() => getQueue(store, student, 'ctap'), 403, 'FORBIDDEN');
  expectApiError(() => serveNext(store, student, 'ctap', 'entry-1'), 403, 'FORBIDDEN');
  assert.equal(store.queueEntries.get('entry-1')?.status, 'queued');
});

test('queue operations reject unknown services and malformed IDs', () => {
  const store = makeStore();
  expectApiError(() => getQueue(store, admin, 'missing'), 404, 'SERVICE_NOT_FOUND');
  expectApiError(() => listQueues(store, admin, ''), 400, 'INVALID_INPUT');
  expectApiError(() => getQueue(store, admin, 42), 400, 'INVALID_INPUT');
  expectApiError(() => serveNext(store, admin, 'missing', 'entry-1'), 404, 'SERVICE_NOT_FOUND');
});

test('starting next updates exactly one entry, records start time, and renumbers the queue', () => {
  const store = makeStore([makeEntry(), makeEntry({ id: 'entry-2', userId: 'student-2' })]);
  const timestamp = new Date('2026-10-22T10:10:00.000Z');
  const result = serveNext(store, admin, 'ctap', 'entry-1', timestamp);
  assert.equal(result.started.status, 'serving');
  assert.equal(result.started.serviceStartedAt, timestamp.toISOString());
  assert.equal(result.started.endedAt, null);
  assert.equal(result.started.completedAt, null);
  assert.equal(result.started.serviceName, 'CTAP Pickup');
  assert.equal(store.queueEntries.size, 2);
  assert.equal(store.queueEntries.get('entry-2')?.status, 'queued');
  assert.equal(result.queue.entries[0].id, 'entry-2');
  assert.equal(result.queue.entries[0].position, 1);
  assert.equal(result.queue.inService[0].id, 'entry-1');
  result.started.status = 'left';
  result.queue.inService[0].status = 'left';
  assert.equal(store.queueEntries.get('entry-1')?.status, 'serving');
});

test('a repeated or stale request cannot serve a different user', () => {
  const store = makeStore([makeEntry(), makeEntry({ id: 'entry-2' })]);
  serveNext(store, admin, 'ctap', 'entry-1');
  expectApiError(() => serveNext(store, admin, 'ctap', 'entry-1'), 409, 'QUEUE_CHANGED');
  assert.equal(store.queueEntries.get('entry-2')?.status, 'queued');
});

test('server selection rejects an arbitrary user and a newly stale queue', () => {
  const store = makeStore([makeEntry(), makeEntry({ id: 'entry-2' })]);
  expectApiError(() => serveNext(store, admin, 'ctap', 'entry-2'), 409, 'QUEUE_CHANGED');
  store.queueEntries.set('urgent', makeEntry({ id: 'urgent', priority: 3 }));
  expectApiError(() => serveNext(store, admin, 'ctap', 'entry-1'), 409, 'QUEUE_CHANGED');
  assert.equal(store.queueEntries.get('entry-1')?.status, 'queued');
});

test('serving an empty queue returns a conflict', () => {
  expectApiError(() => serveNext(makeStore(), admin, 'ctap', 'entry-1'), 409, 'QUEUE_EMPTY');
});

test('serve validation accepts only a bounded expected entry ID', () => {
  assert.equal(validateServeNextBody({ expectedEntryId: 'entry-1' }), 'entry-1');
  const invalid = [undefined, null, [], 'entry-1', {}, { expectedEntryId: 1 },
    { expectedEntryId: '' }, { expectedEntryId: 'a'.repeat(101) },
    { expectedEntryId: 'entry 1' }, { expectedEntryId: 'entry-1', userId: 'student-2' }];
  for (const body of invalid) expectApiError(() => validateServeNextBody(body), 400, 'INVALID_INPUT');
});

test('queue filter validation rejects duplicate, unknown, and oversized values', () => {
  assert.equal(validateQueueQuery({}), undefined);
  assert.equal(validateQueueQuery({ serviceId: 'ctap' }), 'ctap');
  for (const query of [{ userId: 'other' }, { serviceId: ['ctap', 'support'] }, { serviceId: 'a'.repeat(101) }]) {
    expectApiError(() => validateQueueQuery(query), 400, 'INVALID_INPUT');
  }
});

test('completion preserves the service start and records completion exactly once', () => {
  const store = makeStore([makeEntry()]);
  serveNext(store, admin, 'ctap', 'entry-1', new Date('2026-10-22T10:10:00Z'));
  const result = completeService(store, admin, 'entry-1', new Date('2026-10-22T10:20:00Z'));
  assert.equal(result.completed.status, 'served');
  assert.equal(result.completed.serviceStartedAt, '2026-10-22T10:10:00.000Z');
  assert.equal(result.completed.completedAt, '2026-10-22T10:20:00.000Z');
  assert.equal(result.completed.endedAt, result.completed.completedAt);
  assert.deepEqual(result.queue.inService, []);
  expectApiError(() => completeService(store, admin, 'entry-1'), 409, 'NOT_IN_SERVICE');
  result.completed.status = 'left';
  assert.equal(store.queueEntries.get('entry-1')?.status, 'served');
});

test('completion rejects non-admin access, unknown IDs, and visits not in service', () => {
  const store = makeStore([makeEntry()]);
  expectApiError(() => completeService(store, undefined, 'entry-1'), 401, 'UNAUTHENTICATED');
  expectApiError(() => completeService(store, student, 'entry-1'), 403, 'FORBIDDEN');
  expectApiError(() => completeService(store, admin, 'missing'), 404, 'ENTRY_NOT_FOUND');
  expectApiError(() => completeService(store, admin, 'entry-1'), 409, 'NOT_IN_SERVICE');
  expectApiError(() => completeService(store, admin, ''), 400, 'INVALID_INPUT');
});

test('invalid transition timestamps cannot corrupt a queue record', () => {
  const store = makeStore([makeEntry()]);
  expectApiError(() => serveNext(store, admin, 'ctap', 'entry-1', new Date('2026-10-22T09:00:00Z')), 409, 'INVALID_QUEUE_TIMES');
  assert.equal(store.queueEntries.get('entry-1')?.status, 'queued');
  serveNext(store, admin, 'ctap', 'entry-1', new Date('2026-10-22T10:10:00Z'));
  expectApiError(() => completeService(store, admin, 'entry-1', new Date('2026-10-22T10:05:00Z')), 409, 'INVALID_QUEUE_TIMES');
  assert.equal(store.queueEntries.get('entry-1')?.status, 'serving');
  store.queueEntries.get('entry-1')!.serviceStartedAt = null;
  expectApiError(() => completeService(store, admin, 'entry-1'), 409, 'INVALID_QUEUE_TIMES');
});

test('completion bodies cannot supply outcomes or timestamps', () => {
  validateCompletionBody(undefined);
  validateCompletionBody({});
  for (const body of [null, [], 'done', { completedAt: '2026-10-22T00:00:00Z' }]) {
    expectApiError(() => validateCompletionBody(body), 400, 'INVALID_INPUT');
  }
});
