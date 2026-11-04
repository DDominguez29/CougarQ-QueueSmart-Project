import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import type { PoolConfig } from 'pg';

export class ConfigurationError extends Error {}

export function getDatabaseConfig(environment: NodeJS.ProcessEnv = process.env): PoolConfig {
  const connectionString = environment.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new ConfigurationError('DATABASE_URL is required. Copy .env.example to .env and enter your PostgreSQL settings.');
  }

  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new ConfigurationError('DATABASE_URL must be a valid PostgreSQL connection URL.');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.pathname.length <= 1) {
    throw new ConfigurationError('DATABASE_URL must specify a PostgreSQL host and database name.');
  }

  return {
    connectionString,
    max: 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
    statement_timeout: 10_000,
    application_name: 'queuesmart',
  };
}

// Return helpful messages without printing connection URLs or passwords.
export function databaseErrorMessage(error: unknown): string {
  if (error instanceof ConfigurationError) return error.message;
  const code = error instanceof Error && 'code' in error ? error.code : undefined;
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
    return 'PostgreSQL is not reachable. Check the server, host, and port in .env.';
  }
  if (code === '28P01' || code === '28000') {
    return 'PostgreSQL authentication failed. Check the username and password in .env.';
  }
  if (code === '3D000') return 'The PostgreSQL database does not exist. Create it in pgAdmin first.';
  if (code === 'EADDRINUSE') return 'The backend port is already in use. Stop the other server or change PORT.';
  return 'Database or backend startup failed. Check PostgreSQL settings and server logs.';
}

export function createDatabasePool(config: PoolConfig = getDatabaseConfig()): Pool {
  const pool = new Pool(config);
  pool.on('error', (error) => {
    console.error('PostgreSQL pool:', databaseErrorMessage(error));
  });
  return pool;
}

export async function checkDatabaseConnection(database: Pool): Promise<void> {
  await database.query('SELECT 1');
}

const schemaObjects = [
  'user_credentials', 'user_profiles', 'services', 'queues', 'queue_entries',
  'notifications', 'sessions', 'queue_positions', 'user_queue_history',
];

// Bootstrap only. Existing installations require migrations for future changes.
export async function initializeSchema(database: Pool): Promise<'created' | 'existing'> {
  const client = await database.connect();
  try {
    // Session lock keeps two setup commands from racing through the preflight.
    await client.query('SELECT pg_advisory_lock(174402, 1)');
    const { rows } = await client.query<{ name: string; exists: boolean }>(
      'SELECT name, to_regclass(name) IS NOT NULL AS exists FROM unnest($1::text[]) AS objects(name)',
      [schemaObjects],
    );
    if (rows.every((row) => row.exists)) return 'existing';
    if (rows.some((row) => row.exists)) {
      throw new ConfigurationError('Database contains a partial QueueSmart schema. Inspect it in pgAdmin; setup will not overwrite existing objects.');
    }
    const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
    await client.query(schema);
    return 'created';
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock(174402, 1)');
      client.release();
    } catch {
      client.release(true);
    }
  }
}
