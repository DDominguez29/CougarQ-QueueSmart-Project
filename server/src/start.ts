import { once } from 'node:events';
import type { Server } from 'node:http';
import type { Pool } from 'pg';
import { createApp } from './app.ts';
import { checkDatabaseConnection } from './data/database.ts';
import { createStore } from './data/store.ts';

export async function startBackend(database: Pool, port: number): Promise<Server> {
  // Refuse to accept HTTP traffic when the configured database cannot connect.
  await checkDatabaseConnection(database);
  const server = createApp(createStore(), { database }).listen(port, '127.0.0.1');
  await once(server, 'listening');
  return server;
}

export async function stopBackend(server: Server, database: Pool): Promise<void> {
  const timeout = setTimeout(() => server.closeAllConnections(), 10_000);
  timeout.unref();
  try {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  } finally {
    clearTimeout(timeout);
    await database.end();
  }
}
