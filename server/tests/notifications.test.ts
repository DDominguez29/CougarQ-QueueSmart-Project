import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { test, type TestContext } from 'node:test';
import { createApp } from '../src/app.ts';
import { createIdentityResolver } from '../src/modules/auth/auth.middleware.ts';
import { createUser } from '../src/modules/auth/auth.service.ts';
import { createNotificationStore } from '../src/modules/notifications/notifications.service.ts';
import { makeStore } from './fixtures.ts';
import { request, stopServer } from './helpers.ts';

const item = (userId = 'u1', queueEntryId = 'e1') => ({ userId, queueEntryId, serviceName: 'Advising' });

test('join stores event, unique ID, timestamp and returns defensive copy', () => {
  const store = createNotificationStore();
  const notification = store.notifyJoined(item());
  assert.ok(notification);
  assert.equal(notification.type, 'joined');
  assert.match(notification.message, /Advising/);
  assert.ok(!Number.isNaN(Date.parse(notification.createdAt)));
  notification.message = 'tampered';
  assert.notEqual(store.list('u1')[0].message, 'tampered');
  assert.notEqual(store.notifyJoined(item('u1', 'e2'))?.id, notification.id);
});

test('only first two waiting users alerted; no premature alert', () => {
  const store = createNotificationStore();
  const entries = [item('u1', 'e1'), item('u2', 'e2'), item('u3', 'e3')];
  assert.equal(store.notifyQueueChanged(entries).length, 2);
  assert.equal(store.list('u3').length, 0);
  assert.match(store.list('u1')[0].message, /next/);
  assert.match(store.list('u2')[0].message, /one person/);
  assert.equal(store.notifyQueueChanged(entries.slice(1)).length, 1);
  assert.equal(store.list('u3').length, 1);
});

test('duplicates suppressed even after dismissal; rejoin gets fresh alerts', () => {
  const store = createNotificationStore();
  const notification = store.notifyJoined(item());
  assert.ok(notification);
  store.remove('u1', notification.id);
  assert.equal(store.notifyJoined(item()), null);
  store.notifyQueueChanged([item()]);
  assert.deepEqual(store.notifyQueueChanged([item()]), []);
  assert.ok(store.notifyJoined(item('u1', 'new-visit')));
});

test('empty queues and users without messages', () => {
  const store = createNotificationStore();
  assert.deepEqual(store.notifyQueueChanged([]), []);
  assert.deepEqual(store.list('missing'), []);
});

test('ownership, newest first, defensive list copy, delete', () => {
  const store = createNotificationStore();
  const first = store.notifyJoined(item());
  const second = store.notifyJoined(item('u1', 'e2'));
  assert.ok(first && second);
  store.notifyJoined(item('u2', 'e3'));
  assert.deepEqual(store.list('u1').map((notification) => notification.id), [second.id, first.id]);
  const result = store.list('u1');
  result[0].message = 'wrong';
  assert.notEqual(store.list('u1')[0].message, 'wrong');
  assert.throws(() => store.remove('u2', first.id), { status: 404 });
  store.remove('u1', first.id);
  assert.equal(store.list('u1').length, 1);
  assert.throws(() => store.remove('u1', first.id), { status: 404 });
});

for (const field of ['userId', 'queueEntryId', 'serviceName']) {
  for (const [label, value] of Object.entries({ missing: undefined, blank: ' ', number: 5, long: 'x'.repeat(129) })) {
    test(`reject ${label} ${field} without mutation`, () => {
      const store = createNotificationStore();
      assert.throws(() => store.notifyJoined({ ...item(), [field]: value }), { status: 400 });
      assert.deepEqual(store.list('u1'), []);
    });
  }
}

test('length boundaries, trimming and invalid containers', () => {
  const store = createNotificationStore();
  assert.ok(store.notifyJoined({ userId: 'x'.repeat(128), queueEntryId: 'y'.repeat(128), serviceName: 'z'.repeat(100) }));
  assert.equal(store.notifyJoined({ ...item(), userId: ' u1 ' })?.userId, 'u1');
  for (const bad of [null, [], 'bad']) assert.throws(() => store.notifyJoined(bad), { status: 400 });
  assert.throws(() => store.notifyQueueChanged(null), { status: 400 });
  assert.throws(() => store.notifyQueueChanged([item(), item()]), { status: 400 });
  assert.throws(() => store.list(null), { status: 400 });
  assert.throws(() => store.remove('u1', ''), { status: 400 });
});

test('invalid batch is atomic', () => {
  const store = createNotificationStore();
  assert.throws(() => store.notifyQueueChanged([item(), {}]));
  assert.deepEqual(store.list('u1'), []);
});

test('notifications are isolated between shared app stores', () => {
  const first = makeStore();
  const second = makeStore();
  first.notifications.notifyJoined(item());
  assert.equal(first.notifications.list('u1').length, 1);
  assert.deepEqual(second.notifications.list('u1'), []);
});

async function authenticatedApp(t: TestContext) {
  const store = makeStore();
  const accounts = [
    { fullName: 'First Student', email: 'first@cougarnet.uh.edu', role: 'user' },
    { fullName: 'Second Student', email: 'second@cougarnet.uh.edu', role: 'user' },
    { fullName: 'Bookstore Admin', email: 'admin@uh.edu', role: 'admin' },
  ] as const;
  for (const { role, ...account } of accounts) createUser(store, { ...account, password: 'Cougar123' }, role);
  const server = createApp(store, { resolveIdentity: createIdentityResolver(store) }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => stopServer(server));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const tokens: string[] = [];
  for (const account of accounts) {
    const login = await request(baseUrl, '/api/auth/login', { method: 'POST', body: { email: account.email, password: 'Cougar123' } });
    assert.equal(login.status, 200);
    tokens.push(login.body.data.token);
  }
  return { store, baseUrl, first: tokens[0], second: tokens[1], admin: tokens[2] };
}

test('shared notification API verifies real sessions and isolates list/delete ownership', async (t) => {
  const { baseUrl, first, second, admin } = await authenticatedApp(t);
  const join = await request(baseUrl, '/api/services/ctap/queue', { method: 'POST', token: first });
  assert.equal(join.status, 201);
  const own = await request(baseUrl, '/api/notifications', { token: first });
  assert.equal(own.status, 200);
  assert.equal(own.body.data.length, 2);
  assert.ok(own.body.data.some((notification: { type: string }) => notification.type === 'joined'));
  assert.equal((await request(baseUrl, '/api/notifications', { token: second })).body.data.length, 0);
  assert.equal((await request(baseUrl, '/api/notifications', { token: admin })).body.data.length, 0);
  assert.equal((await request(baseUrl, '/api/notifications')).status, 401);
  assert.equal((await request(baseUrl, '/api/notifications', { token: 'invalid-session' })).status, 401);
  const path = `/api/notifications/${own.body.data[0].id}`;
  assert.equal((await request(baseUrl, path, { method: 'DELETE', token: second })).status, 404);
  assert.equal((await request(baseUrl, path, { method: 'DELETE', token: admin })).status, 404);
  assert.equal((await request(baseUrl, path, { method: 'DELETE', token: first })).status, 204);
  assert.equal((await request(baseUrl, path, { method: 'DELETE', token: first })).status, 404);
  assert.equal((await request(baseUrl, '/api/notifications?userId=other', { token: first })).status, 400);
  assert.equal((await request(baseUrl, '/api/notifications/bad.id', { method: 'DELETE', token: first })).status, 400);
  assert.equal((await request(baseUrl, '/api/notifications/%ZZ', { method: 'DELETE', token: first })).status, 400);
  assert.equal((await request(baseUrl, '/api/notifications', { token: first })).body.data.length, 1);
});

test('join/leave API retains history, prevents forged entries, and permits a fresh rejoin', async (t) => {
  const { baseUrl, first, second, store } = await authenticatedApp(t);
  assert.equal((await request(baseUrl, '/api/services/ctap/queue', { method: 'POST' })).status, 401);
  assert.equal((await request(baseUrl, '/api/services/ctap/queue', { method: 'POST', token: first, body: { userId: 'other', priority: 999 } })).status, 400);
  const results = await Promise.all([1, 2].map(() => request(baseUrl, '/api/services/ctap/queue', { method: 'POST', token: first })));
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
  const entry = results.find((result) => result.status === 201)!.body.data;
  assert.equal(store.queueEntries.size, 1);
  assert.equal((await request(baseUrl, '/api/queue/me', { token: first })).body.data.entry.id, entry.id);
  assert.deepEqual((await request(baseUrl, '/api/queue/me', { token: second })).body.data, { entry: null, position: null });
  const leavePath = `/api/queue/${entry.id}`;
  assert.equal((await request(baseUrl, leavePath, { method: 'DELETE', token: second })).status, 404);
  const left = await request(baseUrl, leavePath, { method: 'DELETE', token: first });
  assert.equal(left.status, 200);
  assert.equal(left.body.data.status, 'left');
  assert.ok(left.body.data.endedAt);
  assert.equal((await request(baseUrl, '/api/history/me', { token: first })).body.data[0].id, entry.id);
  assert.equal((await request(baseUrl, leavePath, { method: 'DELETE', token: first })).status, 409);
  const rejoin = await request(baseUrl, '/api/services/ctap/queue', { method: 'POST', token: first });
  assert.equal(rejoin.status, 201);
  assert.notEqual(rejoin.body.data.id, entry.id);
  assert.equal((await request(baseUrl, '/api/notifications', { token: first })).body.data.length, 4);
});

test('a real authenticated visit moves from join to service to completed history', async (t) => {
  const { baseUrl, first, admin } = await authenticatedApp(t);
  const joined = await request(baseUrl, '/api/services/ctap/queue', { method: 'POST', token: first });
  const id = joined.body.data.id;
  const servePath = '/api/services/ctap/queue/serve-next';
  assert.equal((await request(baseUrl, servePath, { method: 'POST', token: first, body: { expectedEntryId: id } })).status, 403);
  assert.equal((await request(baseUrl, servePath, { method: 'POST', token: admin, body: { expectedEntryId: id } })).status, 200);
  const active = await request(baseUrl, '/api/queue/me', { token: first });
  assert.equal(active.body.data.entry.status, 'serving');
  assert.equal(active.body.data.position, null);
  assert.equal((await request(baseUrl, `/api/queue/${id}`, { method: 'DELETE', token: first })).status, 409);
  assert.equal((await request(baseUrl, `/api/queue/${id}/complete`, { method: 'POST', token: admin })).status, 200);
  assert.deepEqual((await request(baseUrl, '/api/queue/me', { token: first })).body.data, { entry: null, position: null });
  assert.equal((await request(baseUrl, '/api/history/me', { token: first })).body.data[0].status, 'served');
});
