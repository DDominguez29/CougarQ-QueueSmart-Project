import { Router, type RequestHandler } from 'express';
import type { Store } from '../../data/store.ts';
import { getIdentity, requireIdentity } from '../../middleware/identity.ts';
import { ApiError } from '../../shared/ApiError.ts';
import { getUserQueue, joinQueue, leaveQueue } from './queue.user.service.ts';

function emptyBody(body: unknown) {
  if (body !== undefined && (body === null || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length)) {
    throw new ApiError(400, 'INVALID_INPUT', 'This action accepts an empty body only; user, priority, and timestamps come from the server.');
  }
}

export function createUserQueueRouter(store: Store) {
  const router = Router();
  const signedIn: RequestHandler = (_request, response, next) => {
    requireIdentity(getIdentity(response));
    response.set('Cache-Control', 'no-store');
    next();
  };
  router.get('/queue/me', signedIn, (_request, response) => {
    response.json({ data: getUserQueue(store, getIdentity(response)) });
  });
  router.post('/services/:serviceId/queue', signedIn, (request, response) => {
    emptyBody(request.body);
    response.status(201).json({ data: joinQueue(store, getIdentity(response), request.params.serviceId) });
  });
  router.delete('/queue/:entryId', signedIn, (request, response) => {
    emptyBody(request.body);
    response.json({ data: leaveQueue(store, getIdentity(response), request.params.entryId) });
  });
  return router;
}
