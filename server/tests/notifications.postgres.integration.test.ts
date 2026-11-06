import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { Pool } from 'pg';
import { createPostgresNotificationRepository } from '../src/modules/notifications/notifications.postgres.ts';

// This file is deliberately skipped during ordinary unit-test runs unless
// TEST_DATABASE_URL is provided. Never point it at your application database.
const databaseUrl = process.env.TEST_DATABASE_URL?.trim();

test('PostgreSQL notifications persist, honor ownership, and suppress duplicate events', {
  skip: !databaseUrl ? 'Set TEST_DATABASE_URL to run real PostgreSQL tests' : false,
}, async () => {
  if (!databaseUrl) return;

  const databaseName = decodeURIComponent(new URL(databaseUrl).pathname.slice(1));
  if (databaseName !== 'queuesmart_test') {
    throw new Error('Safety check: TEST_DATABASE_URL must point to queuesmart_test.');
  }

  const ownerId = randomUUID();
  const otherUserId = randomUUID();
  const serviceId = randomUUID();
  const queueId = randomUUID();
  const entryId = randomUUID();
  const suffix = randomUUID().slice(0, 12);

  // Two different pools simulate separate application/database connections.
  const writer = new Pool({ connectionString: databaseUrl, max: 2 });
  const reader = new Pool({ connectionString: databaseUrl, max: 2 });

  try {
    // Insert a small set of valid records required by the foreign keys.
    await writer.query(
      `INSERT INTO user_credentials (id, email, password_hash, role)
       VALUES ($1, $2, $3, 'user'), ($4, $5, $3, 'user')`,
      [ownerId, `a4-${suffix}@cougarnet.uh.edu`, 'integration-test-hash-not-used',
        otherUserId, `a4-other-${suffix}@cougarnet.uh.edu`],
    );
    await writer.query(
      `INSERT INTO services (id, name, description, expected_duration_minutes, priority)
       VALUES ($1, 'A4 Integration Service', 'Test-only service', 10, 0)`,
      [serviceId],
    );
    await writer.query(
      `INSERT INTO queues (id, service_id, status)
       VALUES ($1, $2, 'open')`,
      [queueId, serviceId],
    );
    await writer.query(
      `INSERT INTO queue_entries (id, queue_id, user_id, service_name_snapshot)
       VALUES ($1, $2, $3, 'A4 Integration Service')`,
      [entryId, queueId, ownerId],
    );

    const writeNotifications = createPostgresNotificationRepository(writer);
    const readNotifications = createPostgresNotificationRepository(reader);

    const created = await writeNotifications.emit(
      ownerId, entryId, 'joined', 'You joined the A4 Integration Service queue.',
    );
    assert.ok(created, 'first event should insert a notification');
    assert.equal(created.userId, ownerId);
    assert.equal(created.queueEntryId, entryId);
    assert.equal(created.serviceName, 'A4 Integration Service');

    // The second pool retrieves the stored row without sharing an in-memory Map.
    const fromOtherConnection = await readNotifications.list(ownerId);
    assert.equal(fromOtherConnection.length, 1);
    assert.equal(fromOtherConnection[0]?.id, created.id);
    assert.deepEqual(await readNotifications.list(otherUserId), []);

    // Unique (user_id, queue_entry_id, type) prevents repeat events.
    const duplicate = await readNotifications.emit(ownerId, entryId, 'joined', 'Repeated event');
    assert.equal(duplicate, null);

    await readNotifications.markViewed(ownerId, created.id);
    const viewed = await writer.query<{ status: string; viewed_at: Date | null }>(
      'SELECT status, viewed_at FROM notifications WHERE id = $1', [created.id],
    );
    assert.equal(viewed.rows[0]?.status, 'viewed');
    assert.ok(viewed.rows[0]?.viewed_at);

    await assert.rejects(
      readNotifications.remove(otherUserId, created.id),
      (error: unknown) => error instanceof Error && error.message === 'Notification not found.',
    );
    assert.equal((await writeNotifications.list(ownerId)).length, 1);

    await writeNotifications.remove(ownerId, created.id);
    assert.deepEqual(await readNotifications.list(ownerId), []);

    const dismissed = await reader.query<{ dismissed_at: Date | null }>(
      'SELECT dismissed_at FROM notifications WHERE id = $1', [created.id],
    );
    assert.ok(dismissed.rows[0]?.dismissed_at, 'dismissal is persisted in SQL');

    // A dismissed event cannot be recreated by subsequent queue updates.
    assert.equal(await readNotifications.emit(ownerId, entryId, 'joined', 'Repeated after dismissal'), null);
    assert.deepEqual(await writeNotifications.list(ownerId), []);
  } finally {
    // Only delete rows created by this test; delete child records first.
    try {
      await writer.query('DELETE FROM notifications WHERE queue_entry_id = $1', [entryId]);
      await writer.query('DELETE FROM queue_entries WHERE id = $1', [entryId]);
      await writer.query('DELETE FROM queues WHERE id = $1', [queueId]);
      await writer.query('DELETE FROM services WHERE id = $1', [serviceId]);
      await writer.query('DELETE FROM user_credentials WHERE id = ANY($1::uuid[])', [[ownerId, otherUserId]]);
    } finally {
      await Promise.all([writer.end(), reader.end()]);
    }
  }
});
