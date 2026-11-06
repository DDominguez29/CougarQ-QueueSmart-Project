
import type { Pool } from 'pg';
import { ApiError } from '../../shared/ApiError.ts';
import type { QueueEntry } from '../../shared/models.ts';

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

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createPostgresQueueRepository(database: Pool) {
  return {

    // Retrieve all waiting users for a service.
    async listWaiting(
      serviceId: string,
    ): Promise<(QueueEntry & { position: number })[]> {
      const { rows } = await database.query<WaitingRow>(
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
        endedAt: row.endedAt?.toISOString() ?? null,
        serviceName: row.serviceName,
        userName: row.userName ?? undefined,
        serviceStartedAt:
          row.serviceStartedAt?.toISOString() ?? null,
        completedAt:
          row.completedAt?.toISOString() ?? null,
        position: row.position,
      }));
    },

    // Add an authenticated user to an open queue.
    async join(
      userId: string,
      serviceId: string,
    ): Promise<QueueEntry> {

      if (!uuidPattern.test(userId) ||
          !uuidPattern.test(serviceId)) {
        throw new ApiError(
          400,
          'INVALID_INPUT',
          'A valid user ID and service ID are required.',
        );
      }

      let entry: JoinedRow | undefined;

      try {
        const { rows } = await database.query<JoinedRow>(
          `WITH target_queue AS (
             SELECT q.id, s.name, s.priority
             FROM queues q
             JOIN services s ON s.id = q.service_id
             WHERE q.service_id = $2::uuid
               AND q.status = 'open'
             FOR SHARE OF q
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

        entry = rows[0];

      } catch (error) {
        // PostgreSQL unique constraint violation.
        if ((error as { code?: string }).code === '23505') {
          throw new ApiError(
            409,
            'ALREADY_IN_QUEUE',
            'You already have an active queue entry.',
          );
        }

        throw error;
      }

      // No entry was inserted.
      if (!entry) {
        const { rows } = await database.query<{
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

      // Convert PostgreSQL timestamps to API-compatible strings.
      return {
        id: entry.id,
        userId: entry.userId,
        serviceId: entry.serviceId,
        priority: entry.priority,
        joinedAt: entry.joinedAt.toISOString(),
        status: entry.status,
        endedAt: entry.endedAt?.toISOString() ?? null,
        serviceStartedAt:
          entry.serviceStartedAt?.toISOString() ?? null,
        completedAt:
          entry.completedAt?.toISOString() ?? null,
        serviceName: entry.serviceName,
        userName: entry.userName ?? undefined,
      };
    },

  };
}
