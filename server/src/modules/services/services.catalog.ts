
import type { Pool } from 'pg';
import type { Store } from '../../data/store.ts';
import type { QueueEntry } from '../../shared/models.ts';
import type { ServiceRepository } from './services.repository.ts';

type DatabaseEntry = {
  id: string;
  userId: string;
  userName: string | null;
  serviceId: string;
  serviceName: string;
  priority: number;
  status: QueueEntry['status'];
  joinedAt: Date;
  serviceStartedAt: Date | null;
  completedAt: Date | null;
  endedAt: Date | null;
};

// Build a fresh snapshot of service and queue data.
// In-memory unit tests retain the original Store behavior.
export async function loadServiceCatalog(
  store: Store,
  repository: ServiceRepository,
  database?: Pool,
): Promise<Store> {
  const services = await repository.list();

  const catalog: Store = {
    ...store,
    services: new Map(
      services.map((service) => [service.id, service]),
    ),
  };

  if (!database) {
    return catalog;
  }

  const { rows } = await database.query<DatabaseEntry>(
    `SELECT
       e.id,
       e.user_id AS "userId",
       p.full_name AS "userName",
       q.service_id AS "serviceId",
       e.service_name_snapshot AS "serviceName",
       e.priority,
       e.status,
       e.joined_at AS "joinedAt",
       e.service_started_at AS "serviceStartedAt",
       e.completed_at AS "completedAt",
       e.ended_at AS "endedAt"
     FROM queue_entries e
     JOIN queues q ON q.id = e.queue_id
     LEFT JOIN user_profiles p ON p.user_id = e.user_id`,
  );

  const entries: QueueEntry[] = rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    userName: row.userName ?? undefined,
    serviceId: row.serviceId,
    serviceName: row.serviceName,
    priority: row.priority,
    status: row.status,
    joinedAt: row.joinedAt.toISOString(),
    serviceStartedAt:
      row.serviceStartedAt?.toISOString() ?? null,
    completedAt:
      row.completedAt?.toISOString() ?? null,
    endedAt: row.endedAt?.toISOString() ?? null,
  }));

  return {
    ...catalog,
    queueEntries: new Map(
      entries.map((entry) => [entry.id, entry]),
    ),
  };
}
