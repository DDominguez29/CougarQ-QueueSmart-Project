import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

import {
  createDatabasePool,
  getDatabaseConfig,
  initializeSchema,
} from '../src/data/database.ts';
import { createPostgresQueueRepository } from '../src/modules/queue/queue.repository.ts';

test('queue repository reads, joins, and leaves entries in PostgreSQL', async (t) => {
  // Never use the application's main database for this test.
  const config = getDatabaseConfig({
    DATABASE_URL: process.env.TEST_DATABASE_URL,
  });
  const admin = createDatabasePool(config);
  const schema = `queue_test_${randomUUID().replaceAll('-', '')}`;
  await admin.query(`CREATE SCHEMA ${schema}`);

  const db = createDatabasePool({
    ...config,
    options: `-c search_path=${schema}`,
  });

  t.after(async () => {
    await db.end();
    try {
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    } finally {
      await admin.end();
    }
  });

  await initializeSchema(db);

  // Arrange: two students, an advising service, and its queue.
  const users = await db.query<{ id: string }>(
    `INSERT INTO user_credentials (email, password_hash)
     VALUES
       ('first@cougarnet.uh.edu', 'test-hash'),
       ('second@cougarnet.uh.edu', 'test-hash')
     RETURNING id`,
  );

  await db.query(
    'INSERT INTO user_profiles (user_id, full_name) VALUES ($1, $2)',
    [users.rows[0].id, 'First Student'],
  );

  const service = await db.query<{ id: string }>(
    `INSERT INTO services (name, description, expected_duration_minutes)
     VALUES ('Advising', 'Academic advising', 10)
     RETURNING id`,
  );
  const serviceId = service.rows[0].id;

  const queue = await db.query<{ id: string }>(
    'INSERT INTO queues (service_id) VALUES ($1) RETURNING id',
    [serviceId],
  );
  const queueId = queue.rows[0].id;

  for (const [index, user] of users.rows.entries()) {
    await db.query(
      `INSERT INTO queue_entries
         (queue_id, user_id, priority, service_name_snapshot)
       VALUES ($1, $2, $3, $4)`,
      [queueId, user.id, index === 0 ? 1 : 5, 'Advising'],
    );
  }

  const repository = createPostgresQueueRepository(db);

  // 1. Priority ordering and reading profile names.
  const waiting = await repository.listWaiting(serviceId);
  assert.equal(waiting.length, 2);
  assert.equal(waiting[0].userId, users.rows[1].id);
  assert.equal(waiting[0].position, 1);
  assert.equal(waiting[1].position, 2);
  assert.equal(waiting[1].userName, 'First Student');
  assert.equal(waiting[0].status, 'queued');

  // 2. Join an open queue.
  const newUser = await db.query<{ id: string }>(
    `INSERT INTO user_credentials (email, password_hash)
     VALUES ('joiner@cougarnet.uh.edu', 'test-hash')
     RETURNING id`,
  );
  const userId = newUser.rows[0].id;
  const joined = await repository.join(userId, serviceId);
  assert.equal(joined.userId, userId);
  assert.equal(joined.serviceId, serviceId);
  assert.equal(joined.status, 'queued');

  // 3. The new entry is actually persisted in PostgreSQL.
  const persisted = await db.query<{ id: string; user_id: string; status: string }>(
    'SELECT id, user_id, status FROM queue_entries WHERE id = $1',
    [joined.id],
  );
  assert.equal(persisted.rows.length, 1);
  assert.equal(persisted.rows[0].user_id, userId);
  assert.equal(persisted.rows[0].status, 'queued');

  // 4. Positions include the newly joined student.
  const updatedWaiting = await repository.listWaiting(serviceId);
  assert.equal(updatedWaiting.length, 3);
  assert.deepEqual(updatedWaiting.map((entry) => entry.position), [1, 2, 3]);

  // 5. The schema prevents a second active entry for the same student.
  await assert.rejects(
    repository.join(userId, serviceId),
    { status: 409, code: 'ALREADY_IN_QUEUE' },
  );
  const duplicates = await db.query<{ count: number }>(
    'SELECT COUNT(*)::integer AS count FROM queue_entries WHERE user_id = $1',
    [userId],
  );
  assert.equal(duplicates.rows[0].count, 1);

  // 6. Closing a queue blocks new joins.
  await db.query("UPDATE queues SET status = 'closed' WHERE id = $1", [queueId]);
  const anotherUser = await db.query<{ id: string }>(
    `INSERT INTO user_credentials (email, password_hash)
     VALUES ('another@cougarnet.uh.edu', 'test-hash')
     RETURNING id`,
  );
  await assert.rejects(
    repository.join(anotherUser.rows[0].id, serviceId),
    { status: 409, code: 'QUEUE_CLOSED' },
  );
  assert.equal((await repository.listWaiting(serviceId)).length, 3);

  // 7. Another student cannot leave someone else's entry.
  await assert.rejects(
    repository.leave(anotherUser.rows[0].id, joined.id),
    { status: 404, code: 'ENTRY_NOT_FOUND' },
  );

  // 8. The owner can leave even when the queue is closed.
  const left = await repository.leave(userId, joined.id);
  assert.equal(left.userId, userId);
  assert.equal(left.status, 'left');
  assert.ok(left.endedAt);
  assert.ok(Date.parse(left.endedAt!) >= Date.parse(joined.joinedAt));

  // 9. The canceled entry remains in SQL but disappears from the waiting list.
  const saved = await db.query<{ status: string; ended_at: Date }>(
    'SELECT status, ended_at FROM queue_entries WHERE id = $1',
    [joined.id],
  );
  assert.equal(saved.rows[0].status, 'left');
  assert.ok(saved.rows[0].ended_at);
  const remaining = await repository.listWaiting(serviceId);
  assert.equal(remaining.length, 2);

  // 10. The same entry cannot be canceled again.
  await assert.rejects(
    repository.leave(userId, joined.id),
    { status: 409, code: 'NOT_WAITING' },
  );

  // 11. The student may rejoin later, and the canceled visit stays in history.
  await db.query("UPDATE queues SET status = 'open' WHERE id = $1", [queueId]);
  const rejoined = await repository.join(userId, serviceId);
  assert.notEqual(rejoined.id, joined.id);
  assert.equal(rejoined.status, 'queued');

  const history = await db.query<{ count: number }>(
    `SELECT COUNT(*)::integer AS count
     FROM queue_entries
     WHERE user_id = $1 AND status = 'left'`,
    [userId],
  );
  assert.equal(history.rows[0].count, 1);

  // 12. Once service has started, leaving must fail without altering the entry.
  await db.query(
    `UPDATE queue_entries
     SET status = 'serving', service_started_at = GREATEST(CURRENT_TIMESTAMP, joined_at)
     WHERE id = $1`,
    [rejoined.id],
  );
  await assert.rejects(
    repository.leave(userId, rejoined.id),
    { status: 409, code: 'NOT_WAITING' },
  );
  const serving = await db.query<{ status: string }>(
    'SELECT status FROM queue_entries WHERE id = $1',
    [rejoined.id],
  );
  assert.equal(serving.rows[0].status, 'serving');
});
