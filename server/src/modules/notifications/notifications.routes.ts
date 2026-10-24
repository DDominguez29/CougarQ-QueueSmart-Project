import { Router } from 'express';
import type { Store } from '../../data/store.ts';
import { getIdentity, requireIdentity } from '../../middleware/identity.ts';
import { ApiError } from '../../shared/ApiError.ts';
import { validateId } from '../../shared/validation.ts';

export function createNotificationsRouter(store: Store) {
  const router = Router();
  router.use((_request, response, next) => {
    requireIdentity(getIdentity(response));
    response.set('Cache-Control', 'no-store');
    next();
  });

  router.get('/', (request, response) => {
    if (Object.keys(request.query).length) {
      throw new ApiError(400, 'INVALID_INPUT', 'Notifications do not accept user ID or other query filters.');
    }
    const { userId } = requireIdentity(getIdentity(response));
    response.json({ data: store.notifications.list(userId) });
  });

  router.delete('/:notificationId', (request, response) => {
    const { userId } = requireIdentity(getIdentity(response));
    store.notifications.remove(userId, validateId(request.params.notificationId, 'notificationId'));
    response.status(204).end();
  });

  return router;
}
