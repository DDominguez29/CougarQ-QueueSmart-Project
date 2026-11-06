
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

import {
  createDatabasePool,
  getDatabaseConfig,
  initializeSchema,
} from '../src/data/database.ts';

import {
  createPostgresQueueRepository,
} from '../src/modules/queue/queue.repository.ts';

test('queue repository reads and persists entries in PostgreSQL', async (t) => {
  // Use the separate test database.
  const config = getDatabaseConfig({
    DATABASE_URL: process.env.TEST_DATABASE_URL,
  });

  const admin = createDatabasePool(config);

  // Create an isolated schema for this test.
  const schema = `queue_test_${randomUUID().replaceAll('-', '')}`;

  await admin.query(`CREATE SCHEMA ${schema}`);

  const db = createDatabasePool({
    ...config,
    options: `-c search_path=${schema}`,
  });

  // Clean up after testing.
  t.after(async () => {
    await db.end();

    try {
      await admin.query(
        `DROP SCHEMA IF EXISTS ${schema} CASCADE`,
      );
    } finally {
      await admin.end();
    }
  });

  await initializeSchema(db);

  // ---------------------------------------
  // SETUP: Create two test students
  // ---------------------------------------

  const users = await db.query<{ id: string }>(
    `INSERT INTO user_credentials
       (email, password_hash)
     VALUES
       ('first@cougarnet.uh.edu', 'test-hash'),
       ('second@cougarnet.uh.edu', 'test-hash')
     RETURNING id`,
  );

  await db.query(
    `INSERT INTO user_profiles
       (user_id, full_name)
     VALUES ($1, $2)`,
    [users.rows[0].id, 'First Student'],
  );

  // ---------------------------------------
  // SETUP: Create a service and queue
  // ---------------------------------------

  const service = await db.query<{ id: string }>(
    `INSERT INTO services
       (name, description, expected_duration_minutes)
     VALUES
       ('Advising', 'Academic advising', 10)
     RETURNING id`,
  );

  const serviceId = service.rows[0].id;

  const queue = await db.query<{ id: string }>(
    `INSERT INTO queues (service_id)
     VALUES ($1)
     RETURNING id`,
    [serviceId],
  );

  // Insert two students with different priorities.
  for (const [index, user] of users.rows.entries()) {
    await db.query(
      `INSERT INTO queue_entries
         (queue_id, user_id, priority, service_name_snapshot)
       VALUES ($1, $2, $3, $4)`,
      [
        queue.rows[0].id,
        user.id,
        index === 0 ? 1 : 5,
        'Advising',
      ],
    );
  }

  const repository = createPostgresQueueRepository(db);

  // ---------------------------------------
  // TEST 1: Retrieve waiting students
  // ---------------------------------------

  const waiting = await repository.listWaiting(serviceId);

  assert.equal(waiting.length, 2);

  // Higher-priority student should appear first.
  assert.equal(waiting[0].userId, users.rows[1].id);
  assert.equal(waiting[0].position, 1);

  assert.equal(waiting[1].position, 2);
  assert.equal(waiting[1].userName, 'First Student');

  assert.equal(waiting[0].status, 'queued');

  // ---------------------------------------
  // TEST 2: Join an open queue
  // ---------------------------------------

  const newUser = await db.query<{ id: string }>(
    `INSERT INTO user_credentials
       (email, password_hash)
     VALUES
       ('joiner@cougarnet.uh.edu', 'test-hash')
     RETURNING id`,
  );

  const userId = newUser.rows[0].id;

  const joined = await repository.join(userId, serviceId);

  assert.equal(joined.userId, userId);
  assert.equal(joined.serviceId, serviceId);
  assert.equal(joined.status, 'queued');

  // ---------------------------------------
  // TEST 3: Verify database persistence
  // ---------------------------------------

  const persisted = await db.query<{
    id: string;
    user_id: string;
    status: string;
  }>(
    `SELECT id, user_id, status
     FROM queue_entries
     WHERE id = $1`,
    [joined.id],
  );

  assert.equal(persisted.rows.length, 1);
  assert.equal(persisted.rows[0].user_id, userId);
  assert.equal(persisted.rows[0].status, 'queued');

  // ---------------------------------------
  // TEST 4: Verify updated positions
  // ---------------------------------------

  const updatedWaiting =
    await repository.listWaiting(serviceId);

  assert.equal(updatedWaiting.length, 3);

  assert.deepEqual(
    updatedWaiting.map((entry) => entry.position),
    [1, 2, 3],
  );

  // ---------------------------------------
  // TEST 5: Prevent duplicate joins
  // ---------------------------------------

  await assert.rejects(
    repository.join(userId, serviceId),
    {
      status: 409,
      code: 'ALREADY_IN_QUEUE',
    },
  );

  // Confirm the failed join created no duplicate.
  const duplicates = await db.query<{
    count: number;
  }>(
    `SELECT COUNT(*)::integer AS count
     FROM queue_entries
     WHERE user_id = $1`,
    [userId],
  );

  assert.equal(duplicates.rows[0].count, 1);

  // ---------------------------------------
  // TEST 6: Close the queue
  // ---------------------------------------

  await db.query(
    `UPDATE queues
     SET status = 'closed'
     WHERE id = $1`,
    [queue.rows[0].id],
  );

  const anotherUser = await db.query<{ id: string }>(
    `INSERT INTO user_credentials
       (email, password_hash)
     VALUES
       ('another@cougarnet.uh.edu', 'test-hash')
     RETURNING id`,
  );

  // ---------------------------------------
  // TEST 7: Reject joins to closed queues
  // ---------------------------------------

  await assert.rejects(
    repository.join(anotherUser.rows[0].id, serviceId),
    {
      status: 409,
      code: 'QUEUE_CLOSED',
    },
  );

  // Make sure the closed queue was not modified.
  const finalWaiting =
    await repository.listWaiting(serviceId);

  assert.equal(finalWaiting.length, 3);
});
