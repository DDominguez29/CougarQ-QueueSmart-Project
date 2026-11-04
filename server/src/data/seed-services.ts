import type { Pool } from 'pg';
import { DEMO_SERVICES } from './seed.ts';

export const DATABASE_DEMO_SERVICES = DEMO_SERVICES.map((service, index) => ({
  ...service, id: `51cdf35c-72b9-4ec8-94a3-${String(index + 1).padStart(12, '0')}`,
}));

// Explicit demo setup. Stable IDs prevent duplicates and preserve edited values.
export async function seedDatabaseServices(database: Pool): Promise<number> {
  const client = await database.connect();
  let added = 0;
  try {
    await client.query('BEGIN');
    for (const service of DATABASE_DEMO_SERVICES) {
      const result = await client.query(`
        INSERT INTO services (id, name, description, expected_duration_minutes, priority)
        VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
      [service.id, service.name, service.description, service.expectedDurationMinutes, service.priority]);
      added += result.rowCount ?? 0;
      await client.query(`
        INSERT INTO queues (service_id) VALUES ($1)
        ON CONFLICT (service_id) DO NOTHING`, [service.id]);
    }
    await client.query('COMMIT');
    return added;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
