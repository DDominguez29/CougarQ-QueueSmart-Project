
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

test('administrators can open and close PostgreSQL queues', async (t) => {
  const config = getDatabaseConfig({
    DATABASE_URL: process.env.TEST_DATABASE_URL,
  });

  const admin = createDatabasePool(config);
  const schema =
    `queue_status_${randomUUID().replaceAll('-', '')}`;

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

  // Create two students.
  const users = await db.query<{ id: string }>(
    `INSERT INTO user_credentials (email, password_hash)
     VALUES
       ('student1@cougarnet.uh.edu', 'test-hash'),
       ('student2@cougarnet.uh.edu', 'test-hash')
     RETURNING id`,
  );

  // Create a service.
  const service = await db.query<{ id: string }>(
    `INSERT INTO services
       (name, description, expected_duration_minutes)
     VALUES ('Advising', 'Student advising', 10)
     RETURNING id`,
  );

  const serviceId = service.rows[0].id;

  // Create an open queue.
  await db.query(
    'INSERT INTO queues (service_id) VALUES ($1)',
    [serviceId],
  );

  const repository = createPostgresQueueRepository(db);

  // Test 1: A student can join an open queue.
  const first = await repository.join(
    users.rows[0].id,
    serviceId,
  );

  assert.equal(first.status, 'queued');

  // Test 2: An administrator can close the queue.
  const closed = await repository.setQueueStatus(
    serviceId,
    'closed',
  );

  assert.equal(closed.status, 'closed');
  assert.equal(closed.serviceId, serviceId);
  assert.ok(closed.updatedAt);

  // Test 3: Closure is saved to PostgreSQL.
  const savedClosed = await db.query<{ status: string }>(
    'SELECT status FROM queues WHERE service_id = $1',
    [serviceId],
  );

  assert.equal(savedClosed.rows[0].status, 'closed');

  // Test 4: New students cannot join a closed queue.
  await assert.rejects(
    repository.join(users.rows[1].id, serviceId),
    {
      status: 409,
      code: 'QUEUE_CLOSED',
    },
  );

  // Test 5: Existing waiting students remain in the queue.
  const waiting = await repository.listWaiting(serviceId);

  assert.equal(waiting.length, 1);
  assert.equal(waiting[0].id, first.id);

  // Test 6: Administrators can still serve existing
  // students even when new joins are disabled.
  const started = await repository.startService(
    serviceId,
    first.id,
  );

  assert.equal(started.started.status, 'serving');

  const completed = await repository.completeService(
    first.id,
  );

  assert.equal(completed.completed.status, 'served');

  // Test 7: Reopen the queue.
  const opened = await repository.setQueueStatus(
    serviceId,
    'open',
  );

  assert.equal(opened.status, 'open');

  // Test 8: A new student can now join.
  const second = await repository.join(
    users.rows[1].id,
    serviceId,
  );

  assert.equal(second.status, 'queued');

  // Test 9: Reopening persists in the database.
  const savedOpen = await db.query<{ status: string }>(
    'SELECT status FROM queues WHERE service_id = $1',
    [serviceId],
  );

  assert.equal(savedOpen.rows[0].status, 'open');

  // Test 10: Invalid service IDs are rejected.
  await assert.rejects(
    repository.setQueueStatus('invalid-id', 'closed'),
    {
      status: 400,
      code: 'INVALID_INPUT',
    },
  );

  // Test 11: Nonexistent queues return 404.
  await assert.rejects(
    repository.setQueueStatus(randomUUID(), 'closed'),
    {
      status: 404,
      code: 'QUEUE_NOT_FOUND',
    },
  );

  // Test 12: Invalid queue statuses are rejected.
  await assert.rejects(
    repository.setQueueStatus(
      serviceId,
      'paused' as 'open',
    ),
    {
      status: 400,
      code: 'INVALID_INPUT',
    },
  );
});
