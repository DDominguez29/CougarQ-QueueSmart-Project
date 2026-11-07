
import { Router } from 'express';
import type { Store } from '../../data/store.ts';
import { getIdentity, requireIdentity } from '../../middleware/identity.ts';
import { ApiError } from '../../shared/ApiError.ts';
import { validateId } from '../../shared/validation.ts';
import { createPostgresNotificationRepository } from './notifications.postgres.ts';

type NotificationRepository = ReturnType<
  typeof createPostgresNotificationRepository
>;

function notificationId(value: unknown, postgres: boolean): string {
  const id = validateId(value, 'notificationId');
  if (postgres && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ApiError(400, 'INVALID_INPUT', 'A valid notification ID is required.');
  }
  return id;
}

export function createNotificationsRouter(
  store: Store,
  repository?: NotificationRepository
) {
  const router = Router();

  router.use((_request, response, next) => {
    requireIdentity(getIdentity(response));
    response.set('Cache-Control', 'no-store');
    next();
  });

  // Get notifications for the signed-in user
  router.get('/', async (request, response, next) => {
    try {
      if (Object.keys(request.query).length) {
        throw new ApiError(
          400,
          'INVALID_INPUT',
          'Notifications do not accept query filters.'
        );
      }

      const { userId } = requireIdentity(getIdentity(response));

      const notifications = repository
        ? await repository.list(userId)
        : store.notifications.list(userId);

      response.json({ data: notifications });
    } catch (error) {
      next(error);
    }
  });

  // Dismiss a notification
  router.delete('/:notificationId', async (request, response, next) => {
    try {
      const { userId } = requireIdentity(getIdentity(response));
      const id = notificationId(request.params.notificationId, Boolean(repository));

      if (repository) {
        await repository.remove(userId, id);
      } else {
        store.notifications.remove(userId, id);
      }

      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  // Mark a notification as viewed
  router.patch('/:notificationId/viewed', async (request, response, next) => {
    try {
      if (!repository) {
        throw new ApiError(
          503,
          'DATABASE_REQUIRED',
          'Marking notifications as viewed requires PostgreSQL.'
        );
      }

      const { userId } = requireIdentity(getIdentity(response));
      const id = notificationId(request.params.notificationId, true);

      await repository.markViewed(userId, id);

      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
