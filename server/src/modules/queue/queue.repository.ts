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

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createPostgresQueueRepository(database: Pool) {
  return {
    // List waiting students in the database-defined priority order.
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
         LEFT JOIN user_profiles up ON up.user_id = qp.user_id
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
        serviceStartedAt: row.serviceStartedAt?.toISOString() ?? null,
        completedAt: row.completedAt?.toISOString() ?? null,
        position: row.position,
      }));
    },

    // Join an open queue using an authenticated user's database ID.
    async join(userId: string, serviceId: string): Promise<QueueEntry> {
      if (!uuidPattern.test(userId) || !uuidPattern.test(serviceId)) {
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
               (queue_id, user_id, priority, service_name_snapshot)
             SELECT id, $1::uuid, priority, name
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
           LEFT JOIN user_profiles p ON p.user_id = e.user_id`,
          [userId, serviceId],
        );
        entry = rows[0];
      } catch (error) {
        // The schema permits at most one queued/serving entry per user.
        if ((error as { code?: string }).code === '23505') {
          throw new ApiError(
            409,
            'ALREADY_IN_QUEUE',
            'You already have an active queue entry.',
          );
        }
        throw error;
      }

      if (!entry) {
        const { rows } = await database.query<{ status: string }>(
          'SELECT status FROM queues WHERE service_id = $1::uuid',
          [serviceId],
        );
        if (rows.length === 0) {
          throw new ApiError(404, 'QUEUE_NOT_FOUND', 'Queue not found.');
        }
        throw new ApiError(409, 'QUEUE_CLOSED', 'This queue is closed.');
      }

      return {
        id: entry.id,
        userId: entry.userId,
        serviceId: entry.serviceId,
        priority: entry.priority,
        joinedAt: entry.joinedAt.toISOString(),
        status: entry.status,
        endedAt: entry.endedAt?.toISOString() ?? null,
        serviceStartedAt: entry.serviceStartedAt?.toISOString() ?? null,
        completedAt: entry.completedAt?.toISOString() ?? null,
        serviceName: entry.serviceName,
        userName: entry.userName ?? undefined,
      };
    },

    // Cancel the caller's waiting visit, retaining it in SQL for history.
    async leave(userId: string, entryId: string): Promise<QueueEntry> {
      if (!uuidPattern.test(userId) || !uuidPattern.test(entryId)) {
        throw new ApiError(
          400,
          'INVALID_INPUT',
          'Valid user and entry IDs are required.',
        );
      }

      const { rows } = await database.query<LeftRow>(
        `WITH updated AS (
           UPDATE queue_entries AS e
           SET
             status = 'left',
             ended_at = GREATEST(CURRENT_TIMESTAMP, e.joined_at)
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
         LEFT JOIN user_profiles p ON p.user_id = u.user_id`,
        [userId, entryId],
      );

      const entry = rows[0];
      if (!entry) {
        const existing = await database.query<{ status: string }>(
          `SELECT status
           FROM queue_entries
           WHERE id = $1::uuid AND user_id = $2::uuid`,
          [entryId, userId],
        );

        if (existing.rows.length === 0) {
          throw new ApiError(404, 'ENTRY_NOT_FOUND', 'Queue entry not found.');
        }
        throw new ApiError(
          409,
          'NOT_WAITING',
          'Only a waiting visit can leave the queue.',
        );
      }

      return {
        id: entry.id,
        userId: entry.userId,
        serviceId: entry.serviceId,
        priority: entry.priority,
        joinedAt: entry.joinedAt.toISOString(),
        status: entry.status,
        endedAt: entry.endedAt.toISOString(),
        serviceStartedAt: entry.serviceStartedAt?.toISOString() ?? null,
        completedAt: entry.completedAt?.toISOString() ?? null,
        serviceName: entry.serviceName,
        userName: entry.userName ?? undefined,
      };
    },
  };
}
