import test from 'node:test';
import assert from 'node:assert/strict';

import { createPostgresNotificationRepository } from '../src/modules/notifications/notifications.postgres.ts';
import type { SqlConnection } from '../src/modules/notifications/notifications.postgres.ts';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';
const ENTRY_ID = '33333333-3333-4333-8333-333333333333';
const NOTIFICATION_ID = '44444444-4444-4444-8444-444444444444';

type QueryCall = { sql: string; params: unknown[] | undefined };

function mockDatabase(
  handler: (sql: string, params: unknown[] | undefined) => unknown[] | Promise<unknown[]>,
): { db: SqlConnection; calls: QueryCall[] } {
  const calls: QueryCall[] = [];
  const db = {
    async query(sql: string, params?: unknown[]) {
      calls.push({ sql, params });
      const rows = await handler(sql, params);
      return { rows, rowCount: rows.length };
    },
  } as unknown as SqlConnection;
  return { db, calls };
}

function notificationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: NOTIFICATION_ID,
    user_id: USER_ID,
    queue_entry_id: ENTRY_ID,
    service_name_snapshot: 'Book Checkout',
    type: 'joined',
    message: 'You joined the Book Checkout queue.',
    created_at: new Date('2026-11-05T16:00:00.000Z'),
    ...overrides,
  };
}

test('PostgreSQL notifications: list filters by authenticated user and excludes dismissed alerts', async () => {
  const { db, calls } = mockDatabase(() => [notificationRow()]);
  const repository = createPostgresNotificationRepository(db);

  const items = await repository.list(USER_ID);

  assert.equal(items.length, 1);
  assert.deepEqual(items[0], {
    id: NOTIFICATION_ID,
    userId: USER_ID,
    queueEntryId: ENTRY_ID,
    serviceName: 'Book Checkout',
    type: 'joined',
    message: 'You joined the Book Checkout queue.',
    createdAt: '2026-11-05T16:00:00.000Z',
  });
  assert.deepEqual(calls[0].params, [USER_ID]);
  assert.match(calls[0].sql, /WHERE n\.user_id = \$1 AND n\.dismissed_at IS NULL/);
  assert.match(calls[0].sql, /ORDER BY n\.created_at DESC/);
});

test('PostgreSQL notifications: list returns an empty array when there are no visible alerts', async () => {
  const { db } = mockDatabase(() => []);
  assert.deepEqual(await createPostgresNotificationRepository(db).list(USER_ID), []);
});

test('PostgreSQL notifications: dismiss uses owner and id, preserving the row', async () => {
  const { db, calls } = mockDatabase(() => [{ id: NOTIFICATION_ID }]);
  await createPostgresNotificationRepository(db).remove(USER_ID, NOTIFICATION_ID);
  assert.deepEqual(calls[0].params, [NOTIFICATION_ID, USER_ID]);
  assert.match(calls[0].sql, /UPDATE notifications/);
  assert.match(calls[0].sql, /SET dismissed_at = CURRENT_TIMESTAMP/);
  assert.match(calls[0].sql, /id = \$1 AND user_id = \$2 AND dismissed_at IS NULL/);
});

test('PostgreSQL notifications: dismissing an absent or another user’s alert yields 404', async () => {
  const { db, calls } = mockDatabase(() => []);
  await assert.rejects(
    createPostgresNotificationRepository(db).remove(OTHER_USER_ID, NOTIFICATION_ID),
    (error: unknown) => error instanceof Error && 'status' in error
      ? (error as Error & { status: number }).status === 404
      : error instanceof Error && error.message === 'Notification not found.',
  );
  assert.deepEqual(calls[0].params, [NOTIFICATION_ID, OTHER_USER_ID]);
});

test('PostgreSQL notifications: markViewed changes the status and records viewed_at', async () => {
  const { db, calls } = mockDatabase(() => [{ id: NOTIFICATION_ID }]);
  await createPostgresNotificationRepository(db).markViewed(USER_ID, NOTIFICATION_ID);
  assert.deepEqual(calls[0].params, [NOTIFICATION_ID, USER_ID]);
  assert.match(calls[0].sql, /status = 'viewed'/);
  assert.match(calls[0].sql, /viewed_at = COALESCE\(viewed_at, CURRENT_TIMESTAMP\)/);
  assert.match(calls[0].sql, /dismissed_at IS NULL/);
});

test('PostgreSQL notifications: marking another user’s or missing alert viewed yields 404', async () => {
  const { db } = mockDatabase(() => []);
  await assert.rejects(
    createPostgresNotificationRepository(db).markViewed(OTHER_USER_ID, NOTIFICATION_ID),
    { message: 'Notification not found.' },
  );
});

test('PostgreSQL notifications: emit inserts a queue event and maps the returned row', async () => {
  const { db, calls } = mockDatabase(() => [notificationRow({ created_at: '2026-11-05T16:00:00.000Z' })]);
  const item = await createPostgresNotificationRepository(db).emit(
    USER_ID, ENTRY_ID, 'joined', 'You joined the Book Checkout queue.',
  );
  assert.equal(item?.id, NOTIFICATION_ID);
  assert.equal(item?.serviceName, 'Book Checkout');
  assert.equal(item?.createdAt, '2026-11-05T16:00:00.000Z');
  assert.deepEqual(calls[0].params, [USER_ID, ENTRY_ID, 'joined', 'You joined the Book Checkout queue.']);
  assert.match(calls[0].sql, /ON CONFLICT \(user_id, queue_entry_id, type\) DO NOTHING/);
});

test('PostgreSQL notifications: emit returns null when a duplicate event is suppressed', async () => {
  // Simulates PostgreSQL returning zero inserted rows after ON CONFLICT DO NOTHING.
  const { db } = mockDatabase(() => []);
  const result = await createPostgresNotificationRepository(db).emit(
    USER_ID, ENTRY_ID, 'near_turn', 'You are next.',
  );
  assert.equal(result, null);
});

test('PostgreSQL notifications: query failures are not silently ignored', async () => {
  const database = {
    async query() { throw new Error('Database unavailable'); },
  } as unknown as SqlConnection;
  await assert.rejects(
    createPostgresNotificationRepository(database).list(USER_ID),
    { message: 'Database unavailable' },
  );
});
