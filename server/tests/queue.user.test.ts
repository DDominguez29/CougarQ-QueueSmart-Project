import assert from 'node:assert/strict';
import { test } from 'node:test';
import { notifyQueueChanged } from '../src/modules/notifications/notifications.service.ts';
import { serveNext } from '../src/modules/queue/queue.service.ts';
import { getUserQueue, joinQueue, leaveQueue } from '../src/modules/queue/queue.user.service.ts';
import { admin, student, expectApiError, makeEntry, makeStore } from './fixtures.ts';

test('join validates identity/service and generates the visit fields on the server', () => {
  const store = makeStore();
  expectApiError(() => joinQueue(store, undefined, 'ctap'), 401, 'UNAUTHENTICATED');
  expectApiError(() => joinQueue(store, student, 'missing'), 404, 'SERVICE_NOT_FOUND');
  expectApiError(() => joinQueue(store, student, '../ctap'), 400, 'INVALID_INPUT');
  const entry = joinQueue(store, student, 'ctap');
  assert.equal(entry.userId, student.userId);
  assert.equal(entry.serviceName, 'CTAP Pickup');
  assert.equal(entry.priority, store.services.get('ctap')!.priority);
  assert.equal(entry.status, 'queued');
  assert.ok(Number.isFinite(Date.parse(entry.joinedAt)));
  entry.status = 'left';
  assert.equal(store.queueEntries.get(entry.id)!.status, 'queued');
});

test('one active visit per user includes both waiting and in-service visits', () => {
  for (const status of ['queued', 'serving'] as const) {
    const store = makeStore([makeEntry({ status })]);
    expectApiError(() => joinQueue(store, student, 'support'), 409, 'ALREADY_IN_QUEUE');
    assert.equal(store.queueEntries.size, 1);
  }
});

test('current queue uses the admin service ordering and returns defensive copies', () => {
  const store = makeStore([
    makeEntry({ id: 'own', priority: 1 }),
    makeEntry({ id: 'urgent', userId: 'other', priority: 3 }),
    makeEntry({ id: 'other-service', userId: 'third', serviceId: 'support', priority: 5 }),
  ]);
  const current = getUserQueue(store, student);
  assert.equal(current.entry?.id, 'own');
  assert.equal(current.position, 2);
  current.entry!.status = 'left';
  assert.equal(store.queueEntries.get('own')!.status, 'queued');
  expectApiError(() => getUserQueue(store, undefined), 401, 'UNAUTHENTICATED');
});

test('leave requires ownership and waiting status and retains the history record', () => {
  const store = makeStore([makeEntry()]);
  expectApiError(() => leaveQueue(store, undefined, 'entry-1'), 401, 'UNAUTHENTICATED');
  expectApiError(() => leaveQueue(store, admin, 'entry-1'), 404, 'ENTRY_NOT_FOUND');
  const left = leaveQueue(store, student, 'entry-1');
  assert.equal(left.status, 'left');
  assert.ok(left.endedAt);
  assert.equal(store.queueEntries.size, 1);
  assert.deepEqual(getUserQueue(store, student), { entry: null, position: null });
  expectApiError(() => leaveQueue(store, student, 'entry-1'), 409, 'NOT_WAITING');
  assert.notEqual(joinQueue(store, student, 'ctap').id, 'entry-1');
});

test('starting service alerts the newly near-turn user and does not recreate dismissed alerts', () => {
  const entries = [1, 2, 3].map((index) => makeEntry({ id: `entry-${index}`, userId: `user-${index}` }));
  const store = makeStore(entries);
  notifyQueueChanged(store, 'ctap');
  assert.equal(store.notifications.list('user-3').length, 0);
  const dismissed = store.notifications.list('user-2')[0];
  store.notifications.remove('user-2', dismissed.id);
  serveNext(store, admin, 'ctap', 'entry-1');
  assert.equal(store.notifications.list('user-3').length, 1);
  assert.equal(store.notifications.list('user-2').length, 0);
  notifyQueueChanged(store, 'ctap');
  assert.equal(store.notifications.list('user-3').length, 1);
});

test('leaving alerts the next waiting user, excludes finished entries, and keeps services separate', () => {
  const entries = [1, 2, 3].map((index) => makeEntry({ id: `entry-${index}`, userId: `user-${index}` }));
  const store = makeStore([
    ...entries,
    makeEntry({ id: 'completed', userId: 'finished', status: 'served', priority: 99 }),
    makeEntry({ id: 'support', userId: 'support-user', serviceId: 'support' }),
  ]);
  notifyQueueChanged(store, 'ctap');
  leaveQueue(store, { userId: 'user-1', role: 'user' }, 'entry-1');
  assert.equal(store.notifications.list('user-3').length, 1);
  assert.equal(store.notifications.list('finished').length, 0);
  assert.equal(store.notifications.list('support-user').length, 0);
  assert.equal(getUserQueue(store, { userId: 'user-3', role: 'user' }).position, 2);
});
