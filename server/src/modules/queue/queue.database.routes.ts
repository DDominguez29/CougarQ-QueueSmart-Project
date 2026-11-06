
import { Router, type RequestHandler } from 'express';
import type { Pool } from 'pg';

import { ApiError } from '../../shared/ApiError.ts';
import type {
  QueueEntry,
  QueueOverview,
  QueueView,
  UserQueue,
} from '../../shared/models.ts';

import {
  getIdentity,
  requireAdministrator,
  requireIdentity,
} from '../../middleware/identity.ts';

import {
  validateCompletionBody,
  validateQueueQuery,
  validateServeNextBody,
} from './queue.validation.ts';

import { createPostgresQueueRepository } from './queue.repository.ts';

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireUuid(value: unknown): string {
  if (typeof value !== 'string' || !uuidPattern.test(value)) {
    throw new ApiError(400, 'INVALID_INPUT', 'A valid ID is required.');
  }
  return value;
}

function requireEmptyBody(body: unknown): void {
  if (
    body !== undefined &&
    (body === null ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).length !== 0)
  ) {
    throw new ApiError(
      400,
      'INVALID_INPUT',
      'This action accepts an empty body only.',
    );
  }
}

type EntryRow = {
  id: string;
  userId: string;
  serviceId: string;
  priority: number;
  joinedAt: Date;
  status: 'queued' | 'serving';
  serviceStartedAt: Date | null;
  serviceName: string;
  userName: string | null;
  position: number | null;
};

function mapEntry(row: EntryRow): QueueEntry {
  return {
    id: row.id,
    userId: row.userId,
    serviceId: row.serviceId,
    priority: row.priority,
    joinedAt: row.joinedAt.toISOString(),
    status: row.status,
    serviceStartedAt:
      row.serviceStartedAt?.toISOString() ?? null,
    completedAt: null,
    endedAt: null,
    serviceName: row.serviceName,
    userName: row.userName ?? undefined,
  };
}

export function createPostgresQueueRouter(database: Pool) {
  const router = Router();
  const repository = createPostgresQueueRepository(database);

  const adminOnly: RequestHandler = (_req, res, next) => {
    requireAdministrator(getIdentity(res));
    next();
  };

  const signedIn: RequestHandler = (_req, res, next) => {
    requireIdentity(getIdentity(res));
    res.set('Cache-Control', 'no-store');
    next();
  };

  // Read an entire service queue from PostgreSQL.
  async function getQueue(serviceId: string): Promise<QueueView> {
    requireUuid(serviceId);

    const service = await database.query<{
      id: string;
      name: string;
    }>(
      'SELECT id, name FROM services WHERE id = $1',
      [serviceId],
    );

    if (!service.rows[0]) {
      throw new ApiError(
        404,
        'SERVICE_NOT_FOUND',
        'Service not found.',
      );
    }

    const waiting = await repository.listWaiting(serviceId);

    const serving = await database.query<EntryRow>(
      `SELECT
         e.id,
         e.user_id AS "userId",
         q.service_id AS "serviceId",
         e.priority,
         e.joined_at AS "joinedAt",
         e.status,
         e.service_started_at AS "serviceStartedAt",
         e.service_name_snapshot AS "serviceName",
         p.full_name AS "userName",
         NULL::integer AS position
       FROM queue_entries e
       JOIN queues q ON q.id = e.queue_id
       LEFT JOIN user_profiles p ON p.user_id = e.user_id
       WHERE q.service_id = $1
         AND e.status = 'serving'
       ORDER BY
         e.service_started_at,
         e.joined_at,
         e.arrival_sequence`,
      [serviceId],
    );

    return {
      service: service.rows[0],
      entries: waiting,
      waitingCount: waiting.length,
      nextEntryId: waiting[0]?.id ?? null,
      inService: serving.rows.map(mapEntry),
    };
  }

  // ADMIN: Retrieve every service queue or one filtered queue.
  router.get('/admin/queue', adminOnly, async (req, res) => {
    const serviceId = validateQueueQuery(req.query);

    let ids: string[];

    if (serviceId !== undefined) {
      ids = [requireUuid(serviceId)];
    } else {
      const result = await database.query<{ id: string }>(
        `SELECT id FROM services
         ORDER BY priority DESC, created_at, id`,
      );
      ids = result.rows.map((row) => row.id);
    }

    const queues = await Promise.all(ids.map(getQueue));

    const overview: QueueOverview = {
      queues,
      totalWaiting: queues.reduce(
        (total, queue) => total + queue.waitingCount,
        0,
      ),
    };

    res.json({ data: overview });
  });

  // ADMIN: Retrieve one service queue.
  router.get(
    '/services/:serviceId/queue',
    adminOnly,
    async (req, res) => {
      validateQueueQuery(req.query);
      const queue = await getQueue(
        requireUuid(req.params.serviceId),
      );
      res.json({ data: queue });
    },
  );

  // ADMIN: Start serving the next student.
  router.post(
    '/services/:serviceId/queue/serve-next',
    adminOnly,
    async (req, res) => {
      const expectedEntryId = validateServeNextBody(req.body);

      const result = await repository.startService(
        requireUuid(req.params.serviceId),
        requireUuid(expectedEntryId),
      );

      res.json({ data: result });
    },
  );

  // ADMIN: Complete an in-service visit.
  router.post(
    '/queue/:entryId/complete',
    adminOnly,
    async (req, res) => {
      validateCompletionBody(req.body);

      const result = await repository.completeService(
        requireUuid(req.params.entryId),
      );

      res.json({ data: result });
    },
  );

  // ADMIN: Open or close a service queue.
  router.patch(
    '/services/:serviceId/queue/status',
    adminOnly,
    async (req, res) => {
      const body: unknown = req.body;

      if (
        typeof body !== 'object' ||
        body === null ||
        Array.isArray(body) ||
        Object.keys(body).length !== 1 ||
        !('status' in body) ||
        (body.status !== 'open' && body.status !== 'closed')
      ) {
        throw new ApiError(
          400,
          'INVALID_INPUT',
          'Provide a status of open or closed.',
        );
      }

      const result = await repository.setQueueStatus(
        requireUuid(req.params.serviceId),
        body.status,
      );

      res.json({ data: result });
    },
  );

  // USER: Retrieve the current authenticated user's visit.
  router.get('/queue/me', signedIn, async (_req, res) => {
    const actor = requireIdentity(getIdentity(res));

    const result = await database.query<EntryRow>(
      `SELECT
         e.id,
         e.user_id AS "userId",
         q.service_id AS "serviceId",
         e.priority,
         e.joined_at AS "joinedAt",
         e.status,
         e.service_started_at AS "serviceStartedAt",
         e.service_name_snapshot AS "serviceName",
         p.full_name AS "userName",
         qp.position::integer AS position
       FROM queue_entries e
       JOIN queues q ON q.id = e.queue_id
       LEFT JOIN user_profiles p ON p.user_id = e.user_id
       LEFT JOIN queue_positions qp ON qp.id = e.id
       WHERE e.user_id = $1
         AND e.status IN ('queued', 'serving')
       ORDER BY e.joined_at DESC
       LIMIT 1`,
      [actor.userId],
    );

    const row = result.rows[0];

    const userQueue: UserQueue = row
      ? {
          entry: mapEntry(row),
          position: row.position,
        }
      : {
          entry: null,
          position: null,
        };

    res.json({ data: userQueue });
  });

  // USER: Join a queue.
  router.post(
    '/services/:serviceId/queue',
    signedIn,
    async (req, res) => {
      requireEmptyBody(req.body);

      const actor = requireIdentity(getIdentity(res));

      const entry = await repository.join(
        actor.userId,
        requireUuid(req.params.serviceId),
      );

      res.status(201).json({ data: entry });
    },
  );

  // USER: Leave a queue.
  router.delete(
    '/queue/:entryId',
    signedIn,
    async (req, res) => {
      requireEmptyBody(req.body);

      const actor = requireIdentity(getIdentity(res));

      const entry = await repository.leave(
        actor.userId,
        requireUuid(req.params.entryId),
      );

      res.json({ data: entry });
    },
  );

  return router;
}
