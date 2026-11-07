import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import { createDatabasePool, getDatabaseConfig, initializeSchema } from '../src/data/database.ts';
import { seedDatabaseAccounts } from '../src/data/seed-accounts.ts';
import { createPostgresServiceRepository } from '../src/modules/services/services.repository.ts';
import { createPostgresQueueRepository } from '../src/modules/queue/queue.repository.ts';
import type { NotificationItem } from '../src/modules/notifications/notifications.models.ts';
import type { QueueEntry } from '../src/shared/models.ts';
import { startBackend, stopBackend } from '../src/start.ts';
import { request } from './helpers.ts';

test('application queue events persist notifications through authenticated routes and restarts', async t => {
  const config = getDatabaseConfig({ DATABASE_URL: process.env.TEST_DATABASE_URL });
  const admin = createDatabasePool(config);
  const schema = `notification_app_${randomUUID().replaceAll('-', '')}`;
  const serverConfig = { ...config, options: `-c search_path=${schema}` };
  const database = createDatabasePool(serverConfig);
  await admin.query(`CREATE SCHEMA ${schema}`);
  t.after(async () => {
    await database.end();
    try { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); }
    finally { await admin.end(); }
  });
  await initializeSchema(database);
  await seedDatabaseAccounts(database);
  const service = await createPostgresServiceRepository(database).create({
    name: 'Notification Pickup', description: 'Integration test', priority: 1, expectedDurationMinutes: 4,
  });
  let pool = createDatabasePool(serverConfig);
  let server = await startBackend(pool, 0);
  let url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  t.after(() => stopBackend(server, pool));
  const api = (path: string, options: Parameters<typeof request>[2] = {}) => request(url, `/api${path}`, options);
  async function login(email: string, password = 'Cougar123') {
    const result = await api('/auth/login', { method: 'POST', body: { email, password } });
    assert.equal(result.status, 200);
    return result.body.data as { token: string; user: { id: string } };
  }
  const staff = await login('admin@uh.edu', 'Admin123');
  const first = await login('student@cougarnet.uh.edu');
  const students = [first];
  for (let i = 2; i <= 4; i++) {
    const email = `student${i}@cougarnet.uh.edu`;
    assert.equal((await api('/auth/register', { method: 'POST', body: {
      email, password: 'Cougar123', fullName: ['Second Student', 'Third Student', 'Fourth Student'][i - 2],
    } })).status, 201);
    students.push(await login(email));
  }
  async function join(index: number): Promise<QueueEntry> {
    const result = await api(`/services/${service.id}/queue`, { method: 'POST', token: students[index].token });
    assert.equal(result.status, 201);
    return result.body.data;
  }
  async function alerts(index: number): Promise<NotificationItem[]> {
    const result = await api('/notifications', { token: students[index].token });
    assert.equal(result.status, 200);
    return result.body.data;
  }
  async function start(entry: QueueEntry) {
    const result = await api(`/services/${service.id}/queue/serve-next`, {
      method: 'POST', token: staff.token, body: { expectedEntryId: entry.id },
    });
    assert.equal(result.status, 200);
  }
  let firstEntry: QueueEntry;
  let secondEntry: QueueEntry;
  let thirdEntry: QueueEntry;
  await t.test('joining creates confirmation and first-two readiness alerts', async () => {
    assert.equal((await api('/notifications')).status, 401);
    firstEntry = await join(0);
    const own = await alerts(0);
    assert.deepEqual(own.map(n => n.type).sort(), ['joined', 'near_turn']);
    assert(own.every(n => n.queueEntryId === firstEntry.id && n.serviceName === service.name));
    assert.deepEqual(await alerts(1), []);
    secondEntry = await join(1);
    thirdEntry = await join(2);
    assert.equal((await alerts(1)).filter(n => n.type === 'near_turn').length, 1);
    assert.deepEqual((await alerts(2)).map(n => n.type), ['joined']);
  });
  await t.test('viewing and dismissal are owner-scoped and persistent after restart', async () => {
    const own = await alerts(0);
    const joined = own.find(n => n.type === 'joined')!;
    const near = own.find(n => n.type === 'near_turn')!;
    for (const method of ['DELETE', 'PATCH']) {
      const path = `/notifications/${near.id}${method === 'PATCH' ? '/viewed' : ''}`;
      assert.equal((await api(path, { method, token: students[1].token })).status, 404);
    }
    assert.equal((await api('/notifications/not-a-uuid', { method: 'DELETE', token: first.token })).status, 400);
    assert.equal((await api(`/notifications/${joined.id}/viewed`, { method: 'PATCH', token: first.token })).status, 204);
    const viewed = await database.query('SELECT status, viewed_at FROM notifications WHERE id=$1', [joined.id]);
    assert.equal(viewed.rows[0].status, 'viewed');
    assert.ok(viewed.rows[0].viewed_at);
    assert.equal((await api(`/notifications/${near.id}`, { method: 'DELETE', token: first.token })).status, 204);
    await stopBackend(server, pool);
    pool = createDatabasePool(serverConfig);
    server = await startBackend(pool, 0);
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    assert.deepEqual((await alerts(0)).map(n => n.id), [joined.id]);
  });
  await t.test('starting service notifies the next waiting students without repeating events', async () => {
    await start(firstEntry);
    assert.deepEqual((await alerts(2)).map(n => n.type).sort(), ['joined', 'near_turn']);
    assert.equal((await alerts(0)).length, 1, 'Dismissed readiness alert stays dismissed');
    const repeat = await api(`/services/${service.id}/queue/serve-next`, {
      method: 'POST', token: staff.token, body: { expectedEntryId: firstEntry.id },
    });
    assert.equal(repeat.status, 409);
    assert.equal((await alerts(1)).length, 2);
  });
  await t.test('leaving promotes the next student, dismissal cannot regenerate an event, and fresh visits can notify again', async () => {
    const fourthEntry = await join(3);
    assert.deepEqual((await alerts(3)).map(n => n.type), ['joined']);
    assert.equal((await api(`/queue/${secondEntry.id}`, { method: 'DELETE', token: students[1].token })).status, 200);
    const near = (await alerts(3)).find(n => n.type === 'near_turn')!;
    assert.ok(near);
    assert.equal(near.queueEntryId, fourthEntry.id);
    assert.equal((await api(`/notifications/${near.id}`, { method: 'DELETE', token: students[3].token })).status, 204);
    await start(thirdEntry);
    assert.deepEqual((await alerts(3)).map(n => n.type), ['joined']);
    assert.equal((await api(`/queue/${firstEntry.id}/complete`, { method: 'POST', token: staff.token })).status, 200);
    const repeatVisit = await join(0);
    assert.notEqual(repeatVisit.id, firstEntry.id);
    assert.equal((await alerts(0)).filter(n => n.queueEntryId === repeatVisit.id).length, 2);
    const duplicates = await database.query(`SELECT 1 FROM notifications
      GROUP BY user_id, queue_entry_id, type HAVING count(*) > 1`);
    assert.equal(duplicates.rowCount, 0);
  });
  await t.test('failed alert persistence rolls back its queue join', async () => {
    const other = await createPostgresServiceRepository(database).create({
      name: 'Rollback Check', description: 'Atomic notifications', priority: 0, expectedDurationMinutes: 2,
    });
    await database.query('ALTER TABLE notifications ADD CONSTRAINT test_reject_alert CHECK (false) NOT VALID');
    try {
      await assert.rejects(createPostgresQueueRepository(database).join(students[1].user.id, other.id), { code: '23514' });
      const visits = await database.query('SELECT id FROM queue_entries WHERE user_id=$1 AND status IN (\'queued\', \'serving\')', [students[1].user.id]);
      assert.equal(visits.rowCount, 0);
    } finally {
      await database.query('ALTER TABLE notifications DROP CONSTRAINT test_reject_alert');
    }
  });
});
