import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import { createDatabasePool, getDatabaseConfig, initializeSchema } from '../src/data/database.ts';
import { DEMO_ACCOUNTS } from '../src/data/seed.ts';
import { seedDatabaseAccounts } from '../src/data/seed-accounts.ts';
import { createPostgresAuthRepository } from '../src/modules/auth/auth.repository.ts';
import { SESSION_TTL_MS, hashToken, login, resolveSession, verifyPassword } from '../src/modules/auth/auth.service.ts';
import { startBackend, stopBackend } from '../src/start.ts';

// Explicit opt-in. Never silently reuse DATABASE_URL for integration tests.
const config = getDatabaseConfig({ DATABASE_URL: process.env.TEST_DATABASE_URL });

const student = {
  fullName: 'Denzel Maldonado',
  email: 'DMaldonado@CougarNet.UH.edu',
  password: 'Cougar2026',
  phone: '(713) 555-0142',
};

test('authentication and profiles persist in PostgreSQL', async (t) => {
  const admin = createDatabasePool(config);
  const schema = `queuesmart_auth_${randomUUID().replaceAll('-', '')}`;
  const serverConfig = { ...config, options: `-c search_path=${schema}` };
  const database = createDatabasePool(serverConfig);
  t.after(async () => {
    await database.end();
    try {
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    } finally {
      await admin.end();
    }
  });
  await admin.query(`CREATE SCHEMA ${schema}`);
  assert.equal(await initializeSchema(database), 'created');

  let pool = createDatabasePool(serverConfig);
  let server = await startBackend(pool, 0);
  let baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  t.after(() => stopBackend(server, pool).catch(() => {}));

  async function request<T = unknown>(path: string, method = 'GET', body?: unknown, token?: string) {
    const response = await fetch(`${baseUrl}/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, body: (text ? JSON.parse(text) : null) as { data: T; error?: { code: string } } };
  }

  let token = '';
  let userId = '';

  await t.test('registration saves credentials and profile in separate tables', async () => {
    const response = await request<{ user: { id: string; email: string; phone: string; role: string } }>(
      '/auth/register', 'POST', student,
    );
    assert.equal(response.status, 201);
    const user = response.body.data.user;
    userId = user.id;
    assert.equal(user.email, 'dmaldonado@cougarnet.uh.edu');
    assert.equal(user.role, 'user');
    assert.equal(user.phone, '(713) 555-0142');
    assert.equal('passwordHash' in user, false);

    const credentials = await database.query('SELECT email, password_hash, role FROM user_credentials WHERE id = $1', [userId]);
    assert.equal(credentials.rows[0].email, 'dmaldonado@cougarnet.uh.edu');
    assert.equal(credentials.rows[0].role, 'user');
    assert.notEqual(credentials.rows[0].password_hash, student.password);
    assert.match(credentials.rows[0].password_hash, /^[0-9a-f]{32}:[0-9a-f]{128}$/);
    assert.equal(verifyPassword(student.password, credentials.rows[0].password_hash), true);

    const profile = await database.query('SELECT full_name, phone FROM user_profiles WHERE user_id = $1', [userId]);
    assert.deepEqual(profile.rows, [{ full_name: 'Denzel Maldonado', phone: '(713) 555-0142' }]);
  });

  await t.test('email stays unique regardless of capitalization', async () => {
    const duplicate = await request('/auth/register', 'POST', { ...student, email: 'dmaldonado@COUGARNET.uh.edu' });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.error?.code, 'EMAIL_TAKEN');
    const { rows } = await database.query('SELECT count(*)::int AS count FROM user_credentials');
    assert.equal(rows[0].count, 1);
  });

  await t.test('invalid registrations are rejected before reaching the database', async () => {
    const other = { ...student, email: 'other@cougarnet.uh.edu' };
    for (const invalid of [
      { ...other, fullName: '' },
      { ...other, fullName: 'A'.repeat(61) },
      { ...other, email: 'someone@gmail.com' },
      { ...other, password: 'short1' },
      { ...other, password: 12345678 },
      { ...other, phone: 'not a phone' },
    ]) {
      const response = await request('/auth/register', 'POST', invalid);
      assert.equal(response.status, 400);
      assert.equal(response.body.error?.code, 'VALIDATION_ERROR');
    }
    const { rows } = await database.query('SELECT count(*)::int AS count FROM user_credentials');
    assert.equal(rows[0].count, 1);
  });

  await t.test('a failed profile insert rolls back the credentials row', async () => {
    await database.query('ALTER TABLE user_profiles ADD CONSTRAINT test_reject_profile CHECK (false) NOT VALID');
    try {
      const response = await request('/auth/register', 'POST', { ...student, email: 'rollback@cougarnet.uh.edu' });
      assert.equal(response.status, 500);
      const { rows } = await database.query("SELECT count(*)::int AS count FROM user_credentials WHERE email = 'rollback@cougarnet.uh.edu'");
      assert.equal(rows[0].count, 0);
    } finally {
      await database.query('ALTER TABLE user_profiles DROP CONSTRAINT test_reject_profile');
    }
  });

  await t.test('login stores only a token digest and returns the profile', async () => {
    const wrong = await request('/auth/login', 'POST', { email: student.email, password: 'Wrong12345' });
    assert.equal(wrong.status, 401);
    const response = await request<{ token: string; user: { fullName: string } }>(
      '/auth/login', 'POST', { email: student.email, password: student.password },
    );
    assert.equal(response.status, 200);
    token = response.body.data.token;
    assert.equal(response.body.data.user.fullName, 'Denzel Maldonado');

    const { rows } = await database.query('SELECT token_hash, user_id, expires_at - created_at AS length FROM sessions');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].token_hash, hashToken(token));
    assert.notEqual(rows[0].token_hash, token);
    assert.equal(rows[0].user_id, userId);
    assert.equal(rows[0].length.hours, SESSION_TTL_MS / 3_600_000);
  });

  await t.test('profile retrieval reads from the database', async () => {
    const me = await request<{ user: { id: string; fullName: string; phone: string } }>('/auth/me', 'GET', undefined, token);
    assert.equal(me.status, 200);
    assert.equal(me.body.data.user.id, userId);
    assert.equal(me.body.data.user.phone, '(713) 555-0142');

    await database.query("UPDATE user_profiles SET full_name = 'Denzel M' WHERE user_id = $1", [userId]);
    const updated = await request<{ user: { fullName: string } }>('/auth/me', 'GET', undefined, token);
    assert.equal(updated.body.data.user.fullName, 'Denzel M');
  });

  await t.test('sessions survive a backend restart', async () => {
    await stopBackend(server, pool);
    pool = createDatabasePool(serverConfig);
    server = await startBackend(pool, 0);
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const me = await request('/auth/me', 'GET', undefined, token);
    assert.equal(me.status, 200);
  });

  await t.test('the signed-in name is used when joining a queue', async () => {
    const { rows } = await database.query<{ id: string }>(`
      WITH service AS (
        INSERT INTO services (name, description, expected_duration_minutes)
        VALUES ('Auth Test Lane', 'Used by the auth tests.', 3) RETURNING id
      ), queue AS (INSERT INTO queues (service_id) SELECT id FROM service)
      SELECT id FROM service`);
    const joined = await request<{ userName: string; userId: string }>(`/services/${rows[0].id}/queue`, 'POST', {}, token);
    assert.equal(joined.status, 201);
    assert.equal(joined.body.data.userId, userId);
    assert.equal(joined.body.data.userName, 'Denzel M');
  });

  await t.test('logout deletes the session row', async () => {
    assert.equal((await request('/auth/logout', 'POST', undefined, token)).status, 204);
    const { rows } = await database.query('SELECT count(*)::int AS count FROM sessions');
    assert.equal(rows[0].count, 0);
    assert.equal((await request('/auth/me', 'GET', undefined, token)).status, 401);
  });

  await t.test('expired sessions are rejected and removed', async () => {
    const accounts = createPostgresAuthRepository(database);
    const start = Date.now();
    const { token: old } = await login(accounts, { email: 'dmaldonado@cougarnet.uh.edu', password: student.password }, start);
    assert.ok(await resolveSession(accounts, old, start + SESSION_TTL_MS - 1));
    assert.equal(await resolveSession(accounts, old, start + SESSION_TTL_MS), undefined);
    const { rows } = await database.query('SELECT count(*)::int AS count FROM sessions WHERE token_hash = $1', [hashToken(old)]);
    assert.equal(rows[0].count, 0);
    assert.equal(await accounts.findById('not-a-uuid'), undefined);
    assert.equal(await accounts.findById(randomUUID()), undefined);
  });

  await t.test('demo accounts seed once and keep existing passwords', async () => {
    assert.equal(await seedDatabaseAccounts(database), DEMO_ACCOUNTS.length);
    await database.query("UPDATE user_credentials SET password_hash = 'abc:def' WHERE email = 'admin@uh.edu'");
    assert.equal(await seedDatabaseAccounts(database), 0);
    const { rows } = await database.query("SELECT password_hash, role FROM user_credentials WHERE email = 'admin@uh.edu'");
    assert.deepEqual(rows, [{ password_hash: 'abc:def', role: 'admin' }]);
  });

  await t.test('roles from the database control admin access', async () => {
    await database.query('DELETE FROM user_credentials WHERE email = $1', ['admin@uh.edu']);
    await seedDatabaseAccounts(database);
    const adminLogin = await request<{ token: string; user: { role: string } }>(
      '/auth/login', 'POST', { email: 'admin@uh.edu', password: 'Admin123' },
    );
    assert.equal(adminLogin.body.data.user.role, 'admin');
    const studentLogin = await request<{ token: string }>(
      '/auth/login', 'POST', { email: 'student@cougarnet.uh.edu', password: 'Cougar123' },
    );
    assert.equal((await request('/admin/queue', 'GET', undefined, adminLogin.body.data.token)).status, 200);
    assert.equal((await request('/admin/queue', 'GET', undefined, studentLogin.body.data.token)).status, 403);
    assert.equal((await request('/admin/queue')).status, 401);
  });

  await t.test('database constraints back up the backend validation', async () => {
    await assert.rejects(
      database.query("INSERT INTO user_credentials (email, password_hash) VALUES ('Upper@uh.edu', 'x:y')"),
      { code: '23514' },
    );
    await assert.rejects(
      database.query("INSERT INTO user_credentials (email, password_hash, role) VALUES ('x@uh.edu', 'x:y', 'owner')"),
      { code: '23514' },
    );
    await assert.rejects(
      database.query('INSERT INTO user_profiles (user_id, full_name) VALUES ($1, $2)', [userId, 'Duplicate Profile']),
      { code: '23505' },
    );
    await assert.rejects(
      database.query('INSERT INTO user_profiles (user_id, full_name) VALUES ($1, $2)', [randomUUID(), 'No Account']),
      { code: '23503' },
    );
  });
});
