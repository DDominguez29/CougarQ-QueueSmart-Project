import { Router, type RequestHandler } from 'express';

import type { Store } from '../../data/store.ts';
import {
  getIdentity,
  requireAdministrator,
} from '../../middleware/identity.ts';
import {
  completeService,
  getMyActiveQueue,
  getQueue,
  joinQueue,
  leaveQueue,
  listQueues,
  serveNext,
} from './queue.service.ts';
import {
  validateCompletionBody,
  validateQueueQuery,
  validateServeNextBody,
} from './queue.validation.ts';

export function createAdminQueueRouter(store: Store) {
  const router = Router();

  const adminOnly: RequestHandler = (
    _request,
    response,
    next,
  ) => {
    requireAdministrator(getIdentity(response));
    next();
  };

  // Student/user queue actions.
  router.post(
    '/services/:serviceId/queue/join',
    (request, response) => {
      const result = joinQueue(
        store,
        getIdentity(response),
        request.params.serviceId,
      );

      response.status(201).json({
        data: result,
      });
    },
  );

  router.get('/queue/me', (_request, response) => {
    const result = getMyActiveQueue(
      store,
      getIdentity(response),
    );

    response.json({
      data: result,
    });
  });

  router.post(
    '/queue/:entryId/leave',
    (request, response) => {
      const result = leaveQueue(
        store,
        getIdentity(response),
        request.params.entryId,
      );

      response.json({
        data: result,
      });
    },
  );

  // Existing administrator queue actions.
  router.get(
    '/admin/queue',
    adminOnly,
    (request, response) => {
      const serviceId = validateQueueQuery(
        request.query,
      );

      response.json({
        data: listQueues(
          store,
          getIdentity(response),
          serviceId,
        ),
      });
    },
  );

  router.get(
    '/services/:serviceId/queue',
    adminOnly,
    (request, response) => {
      validateQueueQuery(request.query);

      response.json({
        data: getQueue(
          store,
          getIdentity(response),
          request.params.serviceId,
        ),
      });
    },
  );

  router.post(
    '/services/:serviceId/queue/serve-next',
    adminOnly,
    (request, response) => {
      const expectedEntryId =
        validateServeNextBody(request.body);

      response.json({
        data: serveNext(
          store,
          getIdentity(response),
          request.params.serviceId,
          expectedEntryId,
        ),
      });
    },
  );

  router.post(
    '/queue/:entryId/complete',
    adminOnly,
    (request, response) => {
      validateCompletionBody(request.body);

      response.json({
        data: completeService(
          store,
          getIdentity(response),
          request.params.entryId,
        ),
      });
    },
  );

  return router;
}
