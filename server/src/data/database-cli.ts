import {
  checkDatabaseConnection, ConfigurationError, createDatabasePool,
  databaseErrorMessage, initializeSchema,
} from './database.ts';
import { seedDatabaseAccounts } from './seed-accounts.ts';
import { seedDatabaseServices } from './seed-services.ts';

async function main() {
  const command = process.argv[2];
  if (command !== 'check' && command !== 'setup' && command !== 'seed') {
    throw new ConfigurationError('Use npm run db:check, npm run db:setup, or npm run db:seed.');
  }
  const database = createDatabasePool();
  try {
    await checkDatabaseConnection(database);
    if (command === 'setup') {
      const result = await initializeSchema(database);
      console.log(result === 'created'
        ? 'QueueSmart schema created: 7 tables and 2 views.'
        : 'QueueSmart schema already exists. No changes made.');
    } else if (command === 'seed') {
      console.log(`Demo accounts added: ${await seedDatabaseAccounts(database)}. Existing accounts were preserved.`);
      console.log(`Demo services added: ${await seedDatabaseServices(database)}. Existing services and queue status were preserved.`);
    } else {
      console.log('PostgreSQL connection successful.');
    }
  } finally {
    await database.end();
  }
}

main().catch((error: unknown) => {
  console.error(databaseErrorMessage(error));
  process.exitCode = 1;
});
