import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getUserHistory } from '../src/modules/history/history.service.ts';
import { completeService, serveNext } from '../src/modules/queue/queue.service.ts';
import { admin, student, makeEntry, makeStore, expectApiError } from './fixtures.ts';

test('history contains only the authenticated user completed visits, newest first', () => {
  const store = makeStore([
    makeEntry({ id: 'older', status: 'served', endedAt: '2026-10-22T10:10:00.000Z' }),
    makeEntry({ id: 'newer', status: 'left', endedAt: '2026-10-22T11:00:00.000Z' }),
    makeEntry({ id: 'active' }),
    makeEntry({ id: 'someone-else', userId: 'student-2', status: 'served' }),
  ]);
  const history = getUserHistory(store, student);
  assert.deepEqual(history.map((entry) => entry.id), ['newer', 'older']);
  assert.equal(history[0].serviceName, 'CTAP Pickup');
  assert.deepEqual(getUserHistory(store, admin), []);
});

test('history requires an authenticated identity and returns an empty list for a new user', () => {
  expectApiError(() => getUserHistory(makeStore(), undefined), 401, 'UNAUTHENTICATED');
  assert.deepEqual(getUserHistory(makeStore(), student), []);
});

test('repeated visits to the same service remain separate records', () => {
  const store = makeStore([
    makeEntry({ id: 'visit-1', status: 'left', endedAt: '2026-10-22T10:10:00.000Z' }),
    makeEntry({ id: 'visit-2', status: 'served', endedAt: '2026-10-22T10:20:00.000Z' }),
  ]);
  assert.equal(getUserHistory(store, student).length, 2);
});

test('a visit enters history only after completion, with its actual queue wait', () => {
  const store = makeStore([makeEntry()]);
  assert.deepEqual(getUserHistory(store, student), []);
  serveNext(store, admin, 'ctap', 'entry-1', new Date('2026-10-22T10:10:00.000Z'));
  assert.deepEqual(getUserHistory(store, student), []);
  completeService(store, admin, 'entry-1', new Date('2026-10-22T10:25:00.000Z'));
  assert.equal(getUserHistory(store, student)[0].status, 'served');
  assert.equal(getUserHistory(store, student)[0].waitMinutes, 10);
});

test('history preserves the service snapshot after renaming or deleting the service', () => {
  const store = makeStore([makeEntry({ serviceName: 'Original CTAP name' })]);
  serveNext(store, admin, 'ctap', 'entry-1');
  completeService(store, admin, 'entry-1');
  store.services.delete('ctap');
  assert.equal(getUserHistory(store, student)[0].serviceName, 'Original CTAP name');
});

test('legacy history without a service or end time remains readable', () => {
  const store = makeStore([
    makeEntry({ id: 'older', status: 'left', serviceId: 'deleted', joinedAt: '2026-10-22T09:00:00.000Z' }),
    makeEntry({ id: 'newer', status: 'served' }),
  ]);
  assert.deepEqual(getUserHistory(store, student).map((entry) => entry.id), ['newer', 'older']);
  assert.equal(getUserHistory(store, student)[1].serviceName, 'Service no longer available');
});

test('returned history cannot mutate stored records', () => {
  const store = makeStore([makeEntry({ status: 'served' })]);
  getUserHistory(store, student)[0].status = 'left';
  assert.equal(store.queueEntries.get('entry-1')?.status, 'served');
});
