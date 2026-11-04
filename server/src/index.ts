import { ConfigurationError, createDatabasePool, databaseErrorMessage } from './data/database.ts';
import { startBackend, stopBackend } from './start.ts';

async function main() {
  const port = Number(process.env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigurationError('PORT must be an integer between 1 and 65535.');
  }
  const database = createDatabasePool();
  const server = await startBackend(database, port).catch(async (error: unknown) => {
    await database.end();
    throw error;
  });
  console.log('PostgreSQL connection established.');
  console.log(`QueueSmart API running at http://127.0.0.1:${port}/api`);

  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    stopBackend(server, database).catch((error: unknown) => {
      console.error(databaseErrorMessage(error));
      process.exitCode = 1;
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch((error: unknown) => {
  console.error(databaseErrorMessage(error));
  process.exitCode = 1;
});
