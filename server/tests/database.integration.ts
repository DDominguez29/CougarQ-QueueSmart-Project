import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import {
  checkDatabaseConnection, createDatabasePool, getDatabaseConfig, initializeSchema,
} from '../src/data/database.ts';
import type { Service, QueueEntry, QueueOverview, AdminReport, HistoryItem } from '../src/shared/models.ts';
import { startBackend, stopBackend } from '../src/start.ts';
import { createPostgresServiceRepository } from '../src/modules/services/services.repository.ts';
import { seedDatabaseServices, DATABASE_DEMO_SERVICES } from '../src/data/seed-services.ts';

// Explicit opt-in. Never silently reuse DATABASE_URL for integration tests.
const config = getDatabaseConfig({ DATABASE_URL: process.env.TEST_DATABASE_URL });

test('PostgreSQL connectivity and application startup', async (t) => {
  const admin = createDatabasePool(config);
  const schema = `queuesmart_test_${randomUUID().replaceAll('-', '')}`;
  const database = createDatabasePool({ ...config, options: `-c search_path=${schema}` });
  t.after(async () => {
    await database.end();
    try {
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    } finally {
      await admin.end();
    }
  });
  await admin.query(`CREATE SCHEMA ${schema}`);

  await t.test('connects and initializes a fresh schema', async () => {
    await checkDatabaseConnection(database);
    assert.equal(await initializeSchema(database), 'created');
    const { rows } = await database.query("SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema = $1 AND table_type = 'BASE TABLE'", [schema]);
    assert.equal(rows[0].count, 7);
  });

  await t.test('setup preserves data when the schema was already installed in pgAdmin', async () => {
    await database.query('INSERT INTO services (name, description, expected_duration_minutes) VALUES ($1, $2, $3)', ['Saved Service', 'Must survive setup.', 2.5]);
    assert.equal(await initializeSchema(database), 'existing');
    const { rows } = await database.query('SELECT name FROM services');
    assert.deepEqual(rows, [{ name: 'Saved Service' }]);
    await database.query('DELETE FROM services');
  });

  await t.test('schema constraint checks execute against PostgreSQL', async () => {
    const client = await database.connect();
    try {
      await client.query(await readFile(new URL('./schema.test.sql', import.meta.url), 'utf8'));
      const { rows } = await client.query('SELECT count(*)::int AS count FROM user_credentials');
      assert.equal(rows[0].count, 0);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });

  await t.test('backend checks PostgreSQL before listening and exposes live database health', async () => {
    const serverPool = createDatabasePool({ ...config, options: `-c search_path=${schema}` });
    let poolEnded = false;
    const server = await startBackend(serverPool, 0).catch(async (error: unknown) => {
      await serverPool.end();
      throw error;
    });
    try {
      const { port } = server.address() as AddressInfo;
      const response = await fetch(`http://127.0.0.1:${port}/api/health/db`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { data: { status: 'ok', database: 'connected' } });
      // Simulate a lost database while HTTP stays up: readiness must fail closed.
      await serverPool.end();
      poolEnded = true;
      const unavailable = await fetch(`http://127.0.0.1:${port}/api/health/db`);
      assert.equal(unavailable.status, 503);
      assert.deepEqual(await unavailable.json(), {
        error: { code: 'DATABASE_UNAVAILABLE', message: 'PostgreSQL is unavailable.' },
      });
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      if (!poolEnded) await serverPool.end();
    }
  });

  await t.test('graceful shutdown closes HTTP and releases database connections', async () => {
    const pool = createDatabasePool({ ...config, options: `-c search_path=${schema}` });
    const server = await startBackend(pool, 0);
    await stopBackend(server, pool);
    assert.equal(server.listening, false);
    assert.equal(pool.totalCount, 0);
  });

  await t.test('failed database connection prevents HTTP startup', async () => {
    // Keep host/auth settings from the explicit test URL, but change only the DB.
    const missing = new URL(config.connectionString!);
    missing.pathname = `/missing_${randomUUID().replaceAll('-', '')}`;
    const missingPool = createDatabasePool({ ...config, connectionString: missing.toString() });
    try {
      await assert.rejects(startBackend(missingPool, 0), { code: '3D000' });
    } finally {
      await missingPool.end();
    }
  });

  await t.test('service API persists SQL changes across backend restarts and shares its catalog', async () => {
    const serverConfig = { ...config, options: `-c search_path=${schema}` };
    let pool = createDatabasePool(serverConfig);
    let server = await startBackend(pool, 0);
    let baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    async function request<T = unknown>(path: string, method = 'GET', body?: unknown, token?: string) {
      const response = await fetch(`${baseUrl}/api${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: response.status, body: await response.json() as { data: T } };
    }
    async function login(email: string, password: string): Promise<string> {
      const result = await request<{ token: string }>('/auth/login', 'POST', { email, password });
      assert.equal(result.status, 200);
      return result.body.data.token;
    }
    try {
      let adminToken = await login('admin@uh.edu', 'Admin123');
      const studentToken = await login('student@cougarnet.uh.edu', 'Cougar123');
      const input = { name: "Books'); DROP TABLE services; --", description: 'Saved through the API.', expectedDurationMinutes: 2.5, priority: 4 };
      assert.equal((await request('/services', 'POST', input)).status, 401);
      assert.equal((await request('/services', 'POST', input, studentToken)).status, 403);
      for (const invalid of [
        { ...input, name: ' ' }, { ...input, description: 'x'.repeat(501) },
        { ...input, expectedDurationMinutes: 0 }, { ...input, priority: 2.5 },
        { ...input, priority: 2_147_483_648 },
      ]) {
        assert.equal((await request('/services', 'POST', invalid, adminToken)).status, 400);
      }
      const created = await request<Service>('/services', 'POST', input, adminToken);
      assert.equal(created.status, 201);
      const service = created.body.data;
      assert.deepEqual(service, { id: service.id, ...input });
      const queue = await database.query('SELECT status FROM queues WHERE service_id = $1', [service.id]);
      assert.deepEqual(queue.rows, [{ status: 'open' }]);
      assert.equal((await request(`/services/${service.id}`, 'PUT', input, studentToken)).status, 403);
      assert.equal((await request('/services/not-a-uuid', 'PUT', input, adminToken)).status, 404);
      assert.equal((await request(`/services/${randomUUID()}`, 'PUT', input, adminToken)).status, 404);

      // A queue join must recognize a service that exists only in PostgreSQL.
      const joined = await request<QueueEntry>(`/services/${service.id}/queue`, 'POST', {}, studentToken);
      assert.equal(joined.status, 201);
      assert.equal(joined.body.data.serviceName, input.name);
      const updated = { ...input, name: 'Updated Persisted Service', expectedDurationMinutes: 7.5, priority: 9 };
      const saved = await request<Service>(`/services/${service.id}`, 'PUT', updated, adminToken);
      assert.equal(saved.status, 200);
      assert.deepEqual(saved.body.data, { id: service.id, ...updated });
      assert.deepEqual((await request(`/wait-time/services/${service.id}`, 'GET', undefined, studentToken)).body.data,
        { serviceId: service.id, peopleAhead: 1, estimatedWaitMinutes: 8, serviceMinutes: 7.5 });
      const queues = await request<QueueOverview>('/admin/queue', 'GET', undefined, adminToken);
      assert.equal(queues.body.data.queues.find((item) => item.service.id === service.id)!.service.name, updated.name);
      const reports = await request<AdminReport>('/admin/reports', 'GET', undefined, adminToken);
      assert(reports.body.data.services.some((item: { id: string; name: string }) => item.id === service.id && item.name === updated.name));
      assert.equal((await request(`/queue/${joined.body.data.id}`, 'DELETE', {}, studentToken)).status, 200);
      const history = await request<HistoryItem[]>('/history/me', 'GET', undefined, studentToken);
      assert.equal(history.body.data[0].serviceName, input.name);

      // Verify edits made outside this process are visible on the next request.
      await database.query('UPDATE services SET name = $2 WHERE id = $1', [service.id, 'Edited in PostgreSQL']);
      assert.equal((await request<Service[]>('/services')).body.data.find((item) => item.id === service.id)!.name, 'Edited in PostgreSQL');
      await stopBackend(server, pool);
      pool = createDatabasePool(serverConfig);
      server = await startBackend(pool, 0);
      baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const persisted = (await request<Service[]>('/services')).body.data;
      assert.deepEqual(persisted, [{ id: service.id, ...updated, name: 'Edited in PostgreSQL' }]);
      // Sessions remain in memory until Member 2 migrates them; sign in again.
      adminToken = await login('admin@uh.edu', 'Admin123');
      const lower = await request<Service>('/services', 'POST', { ...input, name: 'Lower Priority', priority: 1 }, adminToken);
      assert.equal(lower.status, 201);
      assert.deepEqual((await request<Service[]>('/services')).body.data.map((item: { id: string }) => item.id), [service.id, lower.body.data.id]);
    } finally {
      await stopBackend(server, pool);
    }
  });

  await t.test('service and queue creation roll back together if queue creation fails', async () => {
    const repository = createPostgresServiceRepository(database);
    const before = await repository.list();
    await database.query('ALTER TABLE queues ADD CONSTRAINT test_reject_new_queue CHECK (false) NOT VALID');
    try {
      await assert.rejects(repository.create({ name: 'Must Roll Back', description: 'Atomic test.', expectedDurationMinutes: 3, priority: 0 }), { code: '23514' });
      assert.deepEqual(await repository.list(), before);
    } finally {
      await database.query('ALTER TABLE queues DROP CONSTRAINT test_reject_new_queue');
    }
  });

  await t.test('demo service seeds preserve edits and queue closure when repeated', async () => {
    assert.equal(await seedDatabaseServices(database), 3);
    const first = DATABASE_DEMO_SERVICES[0];
    await database.query('UPDATE services SET name = $2 WHERE id = $1', [first.id, 'Keep This Edit']);
    await database.query('UPDATE queues SET status = $2 WHERE service_id = $1', [first.id, 'closed']);
    assert.equal(await seedDatabaseServices(database), 0);
    const { rows } = await database.query('SELECT name, status FROM services JOIN queues ON services.id = queues.service_id WHERE services.id = $1', [first.id]);
    assert.deepEqual(rows, [{ name: 'Keep This Edit', status: 'closed' }]);
    const count = await database.query('SELECT count(*)::int AS count FROM queues WHERE service_id = ANY($1::uuid[])', [DATABASE_DEMO_SERVICES.map((service) => service.id)]);
    assert.equal(count.rows[0].count, 3);
  });

  await t.test('partial schemas are rejected without overwriting existing tables', async () => {
    await database.query('DROP VIEW queue_positions');
    await assert.rejects(initializeSchema(database), /partial QueueSmart schema/);
    const { rows } = await database.query('SELECT count(*)::int AS count FROM services');
    assert(rows[0].count > 0);
  });
});
