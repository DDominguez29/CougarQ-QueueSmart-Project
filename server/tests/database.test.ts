import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ConfigurationError, createDatabasePool, databaseErrorMessage, getDatabaseConfig,
} from '../src/data/database.ts';

test('database configuration requires an explicit valid PostgreSQL database URL', () => {
  for (const value of [undefined, '', ' ', 'not-a-url', 'https://localhost/queuesmart', 'postgresql://localhost']) {
    assert.throws(() => getDatabaseConfig({ DATABASE_URL: value }), ConfigurationError);
  }
  const config = getDatabaseConfig({ DATABASE_URL: 'postgresql://student:example@localhost:5432/queuesmart' });
  assert.equal(config.max, 10);
  assert.equal(config.connectionTimeoutMillis, 5_000);
  assert.equal(config.statement_timeout, 10_000);
  assert.match(config.connectionString!, /^postgresql:/);
});

test('database error messages are actionable and never repeat sensitive errors', () => {
  const secret = 'postgresql://student:do-not-log-this@localhost/queuesmart';
  for (const code of ['ECONNREFUSED', 'ENOTFOUND', '28P01', '28000', '3D000', 'EADDRINUSE', 'unknown']) {
    const message = databaseErrorMessage(Object.assign(new Error(secret), { code }));
    assert(!message.includes(secret));
    assert(!message.includes('do-not-log-this'));
  }
  assert.match(databaseErrorMessage(new ConfigurationError('DATABASE_URL is required')), /DATABASE_URL/);
  assert.match(databaseErrorMessage(null), /failed/);
  assert.match(databaseErrorMessage(Object.assign(new Error(), { code: '28P01' })), /authentication/);
});

test('pool creation is lazy and registers an idle-connection error handler', async () => {
  const pool = createDatabasePool(getDatabaseConfig({ DATABASE_URL: 'postgresql://localhost/queuesmart' }));
  try {
    assert.equal(pool.totalCount, 0);
    assert.equal(pool.listenerCount('error'), 1);
  } finally {
    await pool.end();
  }
});
