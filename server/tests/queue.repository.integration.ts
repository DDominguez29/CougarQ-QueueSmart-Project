
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

test('queue repository reads, joins, and leaves entries in PostgreSQL', async (t) => {
  // Use the separate test database.
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
      await admin.query(
        `DROP SCHEMA IF EXISTS ${schema} CASCADE`,
      );
    } finally {
      await admin.end();
    }
  });

  await initializeSchema(db);

  // Create two test students.
  const users = await db.query<{ id: string }>(
    `INSERT INTO user_credentials (email, password_hash)
     VALUES
       ('first@cougarnet.uh.edu', 'test-hash'),
       ('second@cougarnet.uh.edu', 'test-hash')
     RETURNING id`,
  );

  await db.query(
    `INSERT INTO user_profiles (user_id, full_name)
     VALUES ($1, $2)`,
    [users.rows[0].id, 'First Student'],
  );

  // Create a service.
  const service = await db.query<{ id: string }>(
    `INSERT INTO services
       (name, description, expected_duration_minutes)
     VALUES ('Advising', 'Academic advising', 10)
     RETURNING id`,
  );

  const serviceId = service.rows[0].id;

  // Create its queue.
  const queue = await db.query<{ id: string }>(
    `INSERT INTO queues (service_id)
     VALUES ($1)
     RETURNING id`,
    [serviceId],
  );

  const queueId = queue.rows[0].id;

  // Insert students with different priorities.
  for (const [index, user] of users.rows.entries()) {
    await db.query(
      `INSERT INTO queue_entries
         (queue_id, user_id, priority, service_name_snapshot)
       VALUES ($1, $2, $3, $4)`,
      [
        queueId,
        user.id,
        index === 0 ? 1 : 5,
        'Advising',
      ],
    );
  }

  const repository = createPostgresQueueRepository(db);

  // TEST 1: Retrieve waiting students by priority.
  const waiting = await repository.listWaiting(serviceId);

  assert.equal(waiting.length, 2);
  assert.equal(waiting[0].userId, users.rows[1].id);
  assert.equal(waiting[0].position, 1);
  assert.equal(waiting[1].position, 2);
  assert.equal(waiting[1].userName, 'First Student');
  assert.equal(waiting[0].status, 'queued');

  // TEST 2: Join an open queue.
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

  // TEST 3: Verify PostgreSQL persistence.
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

  // TEST 4: Queue positions update.
  const updatedWaiting = await repository.listWaiting(serviceId);

  assert.equal(updatedWaiting.length, 3);
  assert.deepEqual(
    updatedWaiting.map((entry) => entry.position),
    [1, 2, 3],
  );

  // TEST 5: Duplicate joins are rejected.
  await assert.rejects(
    repository.join(userId, serviceId),
    {
      status: 409,
      code: 'ALREADY_IN_QUEUE',
    },
  );

  const duplicates = await db.query<{ count: number }>(
    `SELECT COUNT(*)::integer AS count
     FROM queue_entries
     WHERE user_id = $1`,
    [userId],
  );

  assert.equal(duplicates.rows[0].count, 1);

  // TEST 6: Closed queues reject new joins.
  await db.query(
    `UPDATE queues SET status = 'closed' WHERE id = $1`,
    [queueId],
  );

  const anotherUser = await db.query<{ id: string }>(
    `INSERT INTO user_credentials (email, password_hash)
     VALUES ('another@cougarnet.uh.edu', 'test-hash')
     RETURNING id`,
  );

  await assert.rejects(
    repository.join(anotherUser.rows[0].id, serviceId),
    {
      status: 409,
      code: 'QUEUE_CLOSED',
    },
  );

  assert.equal(
    (await repository.listWaiting(serviceId)).length,
    3,
  );

  // TEST 7: Students cannot leave another user's entry.
  await assert.rejects(
    repository.leave(anotherUser.rows[0].id, joined.id),
    {
      status: 404,
      code: 'ENTRY_NOT_FOUND',
    },
  );

  // TEST 8: Students can leave their own waiting queue.
  const left = await repository.leave(userId, joined.id);

  assert.equal(left.userId, userId);
  assert.equal(left.status, 'left');
  assert.ok(left.endedAt);
  assert.ok(
    Date.parse(left.endedAt!) >= Date.parse(joined.joinedAt),
  );

  // TEST 9: Cancellation persists in PostgreSQL.
  const saved = await db.query<{
    status: string;
    ended_at: Date;
  }>(
    `SELECT status, ended_at
     FROM queue_entries
     WHERE id = $1`,
    [joined.id],
  );

  assert.equal(saved.rows[0].status, 'left');
  assert.ok(saved.rows[0].ended_at);

  const remaining = await repository.listWaiting(serviceId);
  assert.equal(remaining.length, 2);

  // TEST 10: An entry cannot be canceled twice.
  await assert.rejects(
    repository.leave(userId, joined.id),
    {
      status: 409,
      code: 'NOT_WAITING',
    },
  );

  // TEST 11: A student can rejoin after leaving.
  await db.query(
    `UPDATE queues SET status = 'open' WHERE id = $1`,
    [queueId],
  );

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

  // TEST 12: A student cannot leave after service begins.
  await db.query(
    `UPDATE queue_entries
     SET status = 'serving',
         service_started_at = GREATEST(
           CURRENT_TIMESTAMP,
           joined_at
         )
     WHERE id = $1`,
    [rejoined.id],
  );

  await assert.rejects(
    repository.leave(userId, rejoined.id),
    {
      status: 409,
      code: 'NOT_WAITING',
    },
  );

  const serving = await db.query<{ status: string }>(
    `SELECT status
     FROM queue_entries
     WHERE id = $1`,
    [rejoined.id],
  );

  assert.equal(serving.rows[0].status, 'serving');
});

// -----------------------------------------------------
// ADMINISTRATOR SERVICE OPERATIONS
// -----------------------------------------------------

test('administrator service transitions are atomic and persisted in PostgreSQL', async (t) => {
  const config = getDatabaseConfig({
    DATABASE_URL: process.env.TEST_DATABASE_URL,
  });

  const admin = createDatabasePool(config);
  const schema = `queue_admin_${randomUUID().replaceAll('-', '')}`;

  await admin.query(`CREATE SCHEMA ${schema}`);

  const db = createDatabasePool({
    ...config,
    options: `-c search_path=${schema}`,
  });

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

  // Create three test users.
  const users = await db.query<{ id: string }>(
    `INSERT INTO user_credentials
       (email, password_hash)
     VALUES
       ('admin-one@cougarnet.uh.edu', 'test-hash'),
       ('admin-two@cougarnet.uh.edu', 'test-hash'),
       ('admin-three@cougarnet.uh.edu', 'test-hash')
     RETURNING id`,
  );

  // Create the test service.
  const { rows: services } = await db.query<{ id: string }>(
    `INSERT INTO services
       (name, description, expected_duration_minutes, priority)
     VALUES ('Enrollment', 'Enrollment help', 10, 2)
     RETURNING id`,
  );

  const serviceId = services[0].id;

  await db.query(
    `INSERT INTO queues (service_id)
     VALUES ($1)`,
    [serviceId],
  );

  const repository = createPostgresQueueRepository(db);

  // Join three students.
  const first = await repository.join(
    users.rows[0].id,
    serviceId,
  );

  const second = await repository.join(
    users.rows[1].id,
    serviceId,
  );

  const third = await repository.join(
    users.rows[2].id,
    serviceId,
  );

  // TEST 13: Reject a stale administrator selection.
  await assert.rejects(
    repository.startService(serviceId, second.id),
    {
      status: 409,
      code: 'QUEUE_CHANGED',
    },
  );

  assert.equal(
    (await repository.listWaiting(serviceId)).length,
    3,
  );

  // TEST 14: Two concurrent admins cannot serve
  // the same queue entry twice.
  const attempts = await Promise.allSettled([
    repository.startService(serviceId, first.id),
    repository.startService(serviceId, first.id),
  ]);

  const successes = attempts.filter(
    (result) => result.status === 'fulfilled',
  );

  const failures = attempts.filter(
    (result) => result.status === 'rejected',
  );

  assert.equal(successes.length, 1);
  assert.equal(failures.length, 1);

  const success = successes[0];

  if (success.status !== 'fulfilled') {
    throw new Error('Expected one successful start');
  }

  assert.equal(success.value.started.status, 'serving');
  assert.equal(success.value.started.id, first.id);
  assert.ok(success.value.started.serviceStartedAt);
  assert.equal(success.value.queue.waitingCount, 2);
  assert.equal(success.value.queue.nextEntryId, second.id);

  assert.deepEqual(
    success.value.queue.inService.map((entry) => entry.id),
    [first.id],
  );

  const failed = failures[0];

  if (failed.status !== 'rejected') {
    throw new Error('Expected one stale request');
  }

  assert.equal(failed.reason.code, 'QUEUE_CHANGED');

  // TEST 15: Service start persists in PostgreSQL.
  const savedStart = await db.query<{
    status: string;
    service_started_at: Date;
  }>(
    `SELECT status, service_started_at
     FROM queue_entries
     WHERE id = $1`,
    [first.id],
  );

  assert.equal(savedStart.rows[0].status, 'serving');
  assert.ok(savedStart.rows[0].service_started_at);

  // TEST 16: A waiting entry cannot be completed.
  await assert.rejects(
    repository.completeService(second.id),
    {
      status: 409,
      code: 'NOT_IN_SERVICE',
    },
  );

  // TEST 17: Unknown entries return 404.
  await assert.rejects(
    repository.completeService(randomUUID()),
    {
      status: 404,
      code: 'ENTRY_NOT_FOUND',
    },
  );

  // TEST 18: Complete a currently serving student.
  const finished = await repository.completeService(first.id);

  assert.equal(finished.completed.id, first.id);
  assert.equal(finished.completed.status, 'served');
  assert.equal(
    finished.completed.completedAt,
    finished.completed.endedAt,
  );

  assert.ok(finished.completed.completedAt);
  assert.equal(finished.queue.inService.length, 0);
  assert.equal(finished.queue.waitingCount, 2);

  // TEST 19: Completion persists in SQL history.
  const savedCompletion = await db.query<{
    status: string;
    service_started_at: Date;
    completed_at: Date;
    ended_at: Date;
  }>(
    `SELECT
       status,
       service_started_at,
       completed_at,
       ended_at
     FROM queue_entries
     WHERE id = $1`,
    [first.id],
  );

  assert.equal(savedCompletion.rows[0].status, 'served');

  assert.ok(
    savedCompletion.rows[0].completed_at >=
      savedCompletion.rows[0].service_started_at,
  );

  assert.equal(
    savedCompletion.rows[0].completed_at.getTime(),
    savedCompletion.rows[0].ended_at.getTime(),
  );

  // TEST 20: Completed entries cannot be completed twice.
  await assert.rejects(
    repository.completeService(first.id),
    {
      status: 409,
      code: 'NOT_IN_SERVICE',
    },
  );

  // TEST 21: Concurrent completion requests are safe.
  const startedSecond = await repository.startService(
    serviceId,
    second.id,
  );

  assert.equal(startedSecond.started.status, 'serving');

  const completions = await Promise.allSettled([
    repository.completeService(second.id),
    repository.completeService(second.id),
  ]);

  assert.equal(
    completions.filter(
      (result) => result.status === 'fulfilled',
    ).length,
    1,
  );

  assert.equal(
    completions.filter(
      (result) => result.status === 'rejected',
    ).length,
    1,
  );

  const rejected = completions.find(
    (result) => result.status === 'rejected',
  );

  if (rejected?.status !== 'rejected') {
    throw new Error(
      'Expected duplicate completion to fail',
    );
  }

  assert.equal(rejected.reason.code, 'NOT_IN_SERVICE');

  // TEST 22: Serve the final student.
  await repository.startService(serviceId, third.id);
  await repository.completeService(third.id);

  // TEST 23: Empty queues cannot serve another student.
  await assert.rejects(
    repository.startService(serviceId, third.id),
    {
      status: 409,
      code: 'QUEUE_EMPTY',
    },
  );

  // TEST 24: Reject invalid service IDs.
  await assert.rejects(
    repository.startService('invalid-id', third.id),
    {
      status: 400,
      code: 'INVALID_INPUT',
    },
  );
});
