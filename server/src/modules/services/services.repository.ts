import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { Service } from '../../shared/models.ts';
import type { ServiceInput } from './services.validation.ts';

export interface ServiceRepository {
  list(): Promise<Service[]>;
  create(input: ServiceInput): Promise<Service>;
  update(id: string, input: ServiceInput): Promise<Service | undefined>;
}

const columns = `id, name, description,
  expected_duration_minutes AS "expectedDurationMinutes", priority`;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createPostgresServiceRepository(database: Pool): ServiceRepository {
  return {
    async list() {
      const { rows } = await database.query<Service>(
        `SELECT ${columns} FROM services ORDER BY priority DESC, created_at, id`,
      );
      return rows;
    },
    async create(input) {
      // One SQL statement commits both records together or neither record.
      const { rows } = await database.query<Service>(`
        WITH new_service AS (
          INSERT INTO services (name, description, expected_duration_minutes, priority)
          VALUES ($1, $2, $3, $4) RETURNING *
        ), new_queue AS (
          INSERT INTO queues (service_id) SELECT id FROM new_service RETURNING service_id
        )
        SELECT ${columns} FROM new_service
        WHERE id IN (SELECT service_id FROM new_queue)`,
      [input.name, input.description, input.expectedDurationMinutes, input.priority]);
      return rows[0];
    },
    async update(id, input) {
      // Keep missing/invalid IDs a 404 rather than a PostgreSQL cast error.
      if (!uuidPattern.test(id)) return undefined;
      const { rows } = await database.query<Service>(`
        UPDATE services SET name = $2, description = $3,
          expected_duration_minutes = $4, priority = $5
        WHERE id = $1 RETURNING ${columns}`,
      [id, input.name, input.description, input.expectedDurationMinutes, input.priority]);
      return rows[0];
    },
  };
}

// Database-free adapter for unit tests; production uses PostgreSQL.
export function createMemoryServiceRepository(services: Map<string, Service>): ServiceRepository {
  return {
    async list() {
      return [...services.values()].sort((a, b) => b.priority - a.priority).map((service) => ({ ...service }));
    },
    async create(input) {
      const service = { id: randomUUID(), ...input };
      services.set(service.id, service);
      return { ...service };
    },
    async update(id, input) {
      if (!services.has(id)) return undefined;
      const service = { id, ...input };
      services.set(id, service);
      return { ...service };
    },
  };
}
