
import type { Pool, PoolClient } from 'pg';
import { ApiError } from '../../shared/ApiError.ts';
import {
  createPostgresNotificationRepository,
  notifyPostgresQueueChanged,
} from '../notifications/notifications.postgres.ts';
import type {
  CompleteServiceResult,
  QueueEntry,
  QueueView,
  ServeNextResult,
} from '../../shared/models.ts';

type WaitingRow = {
  id: string;
  userId: string;
  serviceId: string;
  priority: number;
  joinedAt: Date;
  status: 'queued';
  endedAt: Date | null;
  serviceName: string;
  userName: string | null;
  serviceStartedAt: Date | null;
  completedAt: Date | null;
  position: number;
};

type JoinedRow = {
  id: string;
  userId: string;
  serviceId: string;
  priority: number;
  joinedAt: Date;
  status: 'queued';
  endedAt: Date | null;
  serviceStartedAt: Date | null;
  completedAt: Date | null;
  serviceName: string;
  userName: string | null;
};

type LeftRow = {
  id: string;
  userId: string;
  serviceId: string;
  priority: number;
  joinedAt: Date;
  status: 'left';
  endedAt: Date;
  serviceStartedAt: Date | null;
  completedAt: Date | null;
  serviceName: string;
  userName: string | null;
};

type EntryRow = {
  id: string;
  userId: string;
  serviceId: string;
  priority: number;
  joinedAt: Date;
  status: 'queued' | 'serving' | 'served' | 'left';
  endedAt: Date | null;
  serviceStartedAt: Date | null;
  completedAt: Date | null;
  serviceName: string;
  userName: string | null;
};

type QueueStatusRow = {
  id: string;
  serviceId: string;
  status: 'open' | 'closed';
  updatedAt: Date;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Convert a database record into the QueueEntry API model.
function toQueueEntry(row: EntryRow): QueueEntry {
  return {
    id: row.id,
    userId: row.userId,
    serviceId: row.serviceId,
    priority: row.priority,
    joinedAt: row.joinedAt.toISOString(),
    status: row.status,
    endedAt: row.endedAt?.toISOString() ?? null,
    serviceStartedAt:
      row.serviceStartedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    serviceName: row.serviceName,
    userName: row.userName ?? undefined,
  };
}

// Read the queue within the same transaction as a service update.
async function loadQueueView(
  client: PoolClient,
  serviceId: string,
): Promise<QueueView> {
  const { rows: services } = await client.query<{
    id: string;
    name: string;
  }>(
    'SELECT id, name FROM services WHERE id = $1::uuid',
    [serviceId],
  );

  const service = services[0];

  if (!service) {
    throw new ApiError(
      404,
      'SERVICE_NOT_FOUND',
      'Service not found.',
    );
  }

  const { rows: waiting } =
    await client.query<WaitingRow>(
      `SELECT
         qp.id,
         qp.user_id AS "userId",
         qp.service_id AS "serviceId",
         qp.priority,
         qp.joined_at AS "joinedAt",
         qp.status,
         qp.ended_at AS "endedAt",
         qp.service_started_at AS "serviceStartedAt",
         qp.completed_at AS "completedAt",
         qp.service_name_snapshot AS "serviceName",
         p.full_name AS "userName",
         qp.position::integer AS position
       FROM queue_positions qp
       LEFT JOIN user_profiles p
         ON p.user_id = qp.user_id
       WHERE qp.service_id = $1::uuid
       ORDER BY qp.position`,
      [serviceId],
    );

  const { rows: serving } =
    await client.query<EntryRow>(
      `SELECT
         e.id,
         e.user_id AS "userId",
         q.service_id AS "serviceId",
         e.priority,
         e.joined_at AS "joinedAt",
         e.status,
         e.ended_at AS "endedAt",
         e.service_started_at AS "serviceStartedAt",
         e.completed_at AS "completedAt",
         e.service_name_snapshot AS "serviceName",
         p.full_name AS "userName"
       FROM queue_entries e
       JOIN queues q ON q.id = e.queue_id
       LEFT JOIN user_profiles p
         ON p.user_id = e.user_id
       WHERE q.service_id = $1::uuid
         AND e.status = 'serving'
       ORDER BY
         e.service_started_at,
         e.joined_at,
         e.arrival_sequence`,
      [serviceId],
    );

  return {
    service: {
      id: service.id,
      name: service.name,
    },
    entries: waiting.map((row) => ({
      ...toQueueEntry(row),
      position: row.position,
    })),
    waitingCount: waiting.length,
    nextEntryId: waiting[0]?.id ?? null,
    inService: serving.map(toQueueEntry),
  };
}

// Retrieve an entry after its status has been updated.
async function loadEntry(
  client: PoolClient,
  entryId: string,
): Promise<QueueEntry> {
  const { rows } = await client.query<EntryRow>(
    `SELECT
       e.id,
       e.user_id AS "userId",
       q.service_id AS "serviceId",
       e.priority,
       e.joined_at AS "joinedAt",
       e.status,
       e.ended_at AS "endedAt",
       e.service_started_at AS "serviceStartedAt",
       e.completed_at AS "completedAt",
       e.service_name_snapshot AS "serviceName",
       p.full_name AS "userName"
     FROM queue_entries e
     JOIN queues q ON q.id = e.queue_id
     LEFT JOIN user_profiles p
       ON p.user_id = e.user_id
     WHERE e.id = $1::uuid`,
    [entryId],
  );

  if (!rows[0]) {
    throw new ApiError(
      404,
      'ENTRY_NOT_FOUND',
      'Queue entry not found.',
    );
  }

  return toQueueEntry(rows[0]);
}

export function createPostgresQueueRepository(
  database: Pool,
) {
  return {
    // -----------------------------------------
    // 1. LIST WAITING STUDENTS
    // -----------------------------------------

    async listWaiting(
      serviceId: string,
    ): Promise<(QueueEntry & { position: number })[]> {
      const { rows } =
        await database.query<WaitingRow>(
          `SELECT
             qp.id,
             qp.user_id AS "userId",
             qp.service_id AS "serviceId",
             qp.priority,
             qp.joined_at AS "joinedAt",
             qp.status,
             qp.ended_at AS "endedAt",
             qp.service_name_snapshot AS "serviceName",
             up.full_name AS "userName",
             qp.service_started_at AS "serviceStartedAt",
             qp.completed_at AS "completedAt",
             qp.position::integer AS position
           FROM queue_positions qp
           LEFT JOIN user_profiles up
             ON up.user_id = qp.user_id
           WHERE qp.service_id = $1
           ORDER BY qp.position`,
          [serviceId],
        );

      return rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        serviceId: row.serviceId,
        priority: row.priority,
        joinedAt: row.joinedAt.toISOString(),
        status: row.status,
        endedAt:
          row.endedAt?.toISOString() ?? null,
        serviceName: row.serviceName,
        userName: row.userName ?? undefined,
        serviceStartedAt:
          row.serviceStartedAt?.toISOString() ?? null,
        completedAt:
          row.completedAt?.toISOString() ?? null,
        position: row.position,
      }));
    },

    // -----------------------------------------
    // 2. JOIN AN OPEN QUEUE
    // -----------------------------------------

    async join(
      userId: string,
      serviceId: string,
    ): Promise<QueueEntry> {
      if (
        !uuidPattern.test(userId) ||
        !uuidPattern.test(serviceId)
      ) {
        throw new ApiError(
          400,
          'INVALID_INPUT',
          'A valid user ID and service ID are required.',
        );
      }

      const client = await database.connect();
      try {
        await client.query('BEGIN');
        const { rows } =
          await client.query<JoinedRow>(
            `WITH target_queue AS (
               SELECT q.id, s.name, s.priority
               FROM queues q
               JOIN services s
                 ON s.id = q.service_id
               WHERE q.service_id = $2::uuid
                 AND q.status = 'open'
               FOR UPDATE OF q
             ),
             inserted AS (
               INSERT INTO queue_entries
                 (
                   queue_id,
                   user_id,
                   priority,
                   service_name_snapshot
                 )
               SELECT
                 id,
                 $1::uuid,
                 priority,
                 name
               FROM target_queue
               RETURNING *
             )
             SELECT
               e.id,
               e.user_id AS "userId",
               q.service_id AS "serviceId",
               e.priority,
               e.joined_at AS "joinedAt",
               e.status,
               e.ended_at AS "endedAt",
               e.service_started_at AS "serviceStartedAt",
               e.completed_at AS "completedAt",
               e.service_name_snapshot AS "serviceName",
               p.full_name AS "userName"
             FROM inserted e
             JOIN queues q ON q.id = e.queue_id
             LEFT JOIN user_profiles p
               ON p.user_id = e.user_id`,
            [userId, serviceId],
          );

        const entry = rows[0];
        if (!entry) {
          const { rows } = await client.query<{
            status: string;
          }>(
            `SELECT status
             FROM queues
             WHERE service_id = $1::uuid`,
            [serviceId],
          );

          if (rows.length === 0) {
            throw new ApiError(
              404,
              'QUEUE_NOT_FOUND',
              'Queue not found.',
            );
          }

          throw new ApiError(
            409,
            'QUEUE_CLOSED',
            'This queue is closed.',
          );
        }

        await createPostgresNotificationRepository(client).emit(
          userId, entry.id, 'joined', `You joined the ${entry.serviceName} queue.`,
        );
        await notifyPostgresQueueChanged(client, serviceId);
        await client.query('COMMIT');
        return toQueueEntry(entry);
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        if ((error as { code?: string }).code === '23505') {
          throw new ApiError(409, 'ALREADY_IN_QUEUE', 'You already have an active queue entry.');
        }
        throw error;
      } finally {
        client.release();
      }
    },

    // -----------------------------------------
    // 3. LEAVE A QUEUE
    // -----------------------------------------

    async leave(
      userId: string,
      entryId: string,
    ): Promise<QueueEntry> {
      if (
        !uuidPattern.test(userId) ||
        !uuidPattern.test(entryId)
      ) {
        throw new ApiError(
          400,
          'INVALID_INPUT',
          'Valid user and entry IDs are required.',
        );
      }

      const client = await database.connect();
      try {
        await client.query('BEGIN');
        // Use the same queue-before-visit lock order as serve-next and join.
        await client.query(`
          SELECT q.id FROM queues q
          JOIN queue_entries e ON e.queue_id = q.id
          WHERE e.id = $1::uuid AND e.user_id = $2::uuid
          FOR UPDATE OF q
        `, [entryId, userId]);
        const { rows } =
          await client.query<LeftRow>(
            `WITH updated AS (
               UPDATE queue_entries AS e
               SET
                 status = 'left',
                 ended_at = GREATEST(
                   CURRENT_TIMESTAMP,
                   e.joined_at
                 )
               WHERE e.id = $2::uuid
                 AND e.user_id = $1::uuid
                 AND e.status = 'queued'
               RETURNING e.*
             )
             SELECT
               u.id,
               u.user_id AS "userId",
               q.service_id AS "serviceId",
               u.priority,
               u.joined_at AS "joinedAt",
               u.status,
               u.ended_at AS "endedAt",
               u.service_started_at AS "serviceStartedAt",
               u.completed_at AS "completedAt",
               u.service_name_snapshot AS "serviceName",
               p.full_name AS "userName"
             FROM updated u
             JOIN queues q ON q.id = u.queue_id
             LEFT JOIN user_profiles p
               ON p.user_id = u.user_id`,
            [userId, entryId],
          );

        const entry = rows[0];

        if (!entry) {
          const existing = await client.query<{
            status: string;
          }>(
            `SELECT status
             FROM queue_entries
             WHERE id = $1::uuid
               AND user_id = $2::uuid`,
            [entryId, userId],
          );

          if (existing.rows.length === 0) {
            throw new ApiError(
              404,
              'ENTRY_NOT_FOUND',
              'Queue entry not found.',
            );
          }

          throw new ApiError(
            409,
            'NOT_WAITING',
            'Only a waiting visit can leave the queue.',
          );
        }

        await notifyPostgresQueueChanged(client, entry.serviceId);
        await client.query('COMMIT');
        return toQueueEntry(entry);
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },

    // -----------------------------------------
    // 4. START SERVICE (ADMINISTRATOR)
    // -----------------------------------------

    async startService(
      serviceId: string,
      expectedEntryId: string,
    ): Promise<ServeNextResult> {
      if (
        !uuidPattern.test(serviceId) ||
        !uuidPattern.test(expectedEntryId)
      ) {
        throw new ApiError(
          400,
          'INVALID_INPUT',
          'Valid service and expected entry IDs are required.',
        );
      }

      const client = await database.connect();

      try {
        await client.query('BEGIN');

        // Lock the queue so competing administrators
        // cannot start the same visit simultaneously.
        const { rows: queues } = await client.query<{
          queueId: string;
        }>(
          `SELECT q.id AS "queueId"
           FROM queues q
           WHERE q.service_id = $1::uuid
           FOR UPDATE OF q`,
          [serviceId],
        );

        if (!queues[0]) {
          throw new ApiError(
            404,
            'SERVICE_NOT_FOUND',
            'Service not found.',
          );
        }

        // Get the next waiting student in priority order.
        const { rows: next } =
          await client.query<{ id: string }>(
            `SELECT id
             FROM queue_entries
             WHERE queue_id = $1::uuid
               AND status = 'queued'
             ORDER BY
               priority DESC,
               joined_at,
               arrival_sequence
             LIMIT 1
             FOR UPDATE`,
            [queues[0].queueId],
          );

        if (!next[0]) {
          throw new ApiError(
            409,
            'QUEUE_EMPTY',
            'There are no users waiting for this service.',
          );
        }

        // Prevent a stale request from selecting
        // the wrong student.
        if (next[0].id !== expectedEntryId) {
          throw new ApiError(
            409,
            'QUEUE_CHANGED',
            'The queue has changed. Refresh it before serving the next user.',
          );
        }

        const { rowCount } = await client.query(
          `UPDATE queue_entries
           SET
             status = 'serving',
             service_started_at = GREATEST(
               statement_timestamp(),
               joined_at
             )
           WHERE id = $1::uuid
             AND status = 'queued'`,
          [expectedEntryId],
        );

        if (rowCount !== 1) {
          throw new ApiError(
            409,
            'QUEUE_CHANGED',
            'The queue has changed. Refresh it before serving the next user.',
          );
        }

        const started = await loadEntry(
          client,
          expectedEntryId,
        );

        const queue = await loadQueueView(
          client,
          serviceId,
        );

        await notifyPostgresQueueChanged(client, serviceId);
        await client.query('COMMIT');

        return {
          started,
          queue,
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    // -----------------------------------------
    // 5. COMPLETE SERVICE (ADMINISTRATOR)
    // -----------------------------------------

    async completeService(
      entryId: string,
    ): Promise<CompleteServiceResult> {
      if (!uuidPattern.test(entryId)) {
        throw new ApiError(
          400,
          'INVALID_INPUT',
          'A valid queue entry ID is required.',
        );
      }

      const client = await database.connect();

      try {
        await client.query('BEGIN');

        const { rows } = await client.query<{
          serviceId: string;
          status: string;
        }>(
          `SELECT
             q.service_id AS "serviceId",
             e.status
           FROM queue_entries e
           JOIN queues q ON q.id = e.queue_id
           WHERE e.id = $1::uuid
           FOR UPDATE OF e`,
          [entryId],
        );

        const entry = rows[0];

        if (!entry) {
          throw new ApiError(
            404,
            'ENTRY_NOT_FOUND',
            'Queue entry not found.',
          );
        }

        // Only students currently being served
        // can be marked as completed.
        if (entry.status !== 'serving') {
          throw new ApiError(
            409,
            'NOT_IN_SERVICE',
            'Only a visit currently in service can be completed.',
          );
        }

        const { rowCount } = await client.query(
          `UPDATE queue_entries
           SET
             status = 'served',
             completed_at = GREATEST(
               statement_timestamp(),
               service_started_at,
               joined_at
             ),
             ended_at = GREATEST(
               statement_timestamp(),
               service_started_at,
               joined_at
             )
           WHERE id = $1::uuid
             AND status = 'serving'`,
          [entryId],
        );

        if (rowCount !== 1) {
          throw new ApiError(
            409,
            'NOT_IN_SERVICE',
            'Only a visit currently in service can be completed.',
          );
        }

        const completed = await loadEntry(
          client,
          entryId,
        );

        const queue = await loadQueueView(
          client,
          entry.serviceId,
        );

        await client.query('COMMIT');

        return {
          completed,
          queue,
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    // -----------------------------------------
    // 6. OPEN / CLOSE QUEUE (ADMINISTRATOR)
    // -----------------------------------------

    async setQueueStatus(
      serviceId: string,
      status: 'open' | 'closed',
    ): Promise<{
      id: string;
      serviceId: string;
      status: 'open' | 'closed';
      updatedAt: string;
    }> {
      if (!uuidPattern.test(serviceId)) {
        throw new ApiError(
          400,
          'INVALID_INPUT',
          'A valid service ID is required.',
        );
      }

      if (status !== 'open' && status !== 'closed') {
        throw new ApiError(
          400,
          'INVALID_INPUT',
          'Queue status must be open or closed.',
        );
      }

      // Update the queue status atomically.
      // Existing entries are preserved when closing.
      const { rows } =
        await database.query<QueueStatusRow>(
          `UPDATE queues
           SET status = $2
           WHERE service_id = $1::uuid
           RETURNING
             id,
             service_id AS "serviceId",
             status,
             updated_at AS "updatedAt"`,
          [serviceId, status],
        );

      const queue = rows[0];

      if (!queue) {
        throw new ApiError(
          404,
          'QUEUE_NOT_FOUND',
          'Queue not found.',
        );
      }

      return {
        id: queue.id,
        serviceId: queue.serviceId,
        status: queue.status,
        updatedAt: queue.updatedAt.toISOString(),
      };
    },
  };
}
