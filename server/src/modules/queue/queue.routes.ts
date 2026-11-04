import { loadServiceCatalog } from '../services/services.catalog.ts';
import { createMemoryServiceRepository, type ServiceRepository } from '../services/services.repository.ts';
import { Router, type RequestHandler } from 'express';
import type { Store } from '../../data/store.ts';
import { getIdentity, requireAdministrator } from '../../middleware/identity.ts';
import { completeService, getQueue, listQueues, serveNext } from './queue.service.ts';
import { validateCompletionBody, validateQueueQuery, validateServeNextBody } from './queue.validation.ts';

export function createAdminQueueRouter(store: Store, repository: ServiceRepository = createMemoryServiceRepository(store.services)) {
  const router = Router();
  const adminOnly: RequestHandler = (_request, response, next) => {
    requireAdministrator(getIdentity(response));
    next();
  };

  router.get('/admin/queue', adminOnly, async (request, response) => {
    const serviceId = validateQueueQuery(request.query);
    response.json({ data: listQueues(await loadServiceCatalog(store, repository), getIdentity(response), serviceId) });
  });

  router.get('/services/:serviceId/queue', adminOnly, async (request, response) => {
    validateQueueQuery(request.query);
    response.json({ data: getQueue(await loadServiceCatalog(store, repository), getIdentity(response), request.params.serviceId) });
  });

  router.post('/services/:serviceId/queue/serve-next', adminOnly, async (request, response) => {
    const expectedEntryId = validateServeNextBody(request.body);
    response.json({ data: serveNext(await loadServiceCatalog(store, repository), getIdentity(response), request.params.serviceId, expectedEntryId) });
  });

  router.post('/queue/:entryId/complete', adminOnly, async (request, response) => {
    validateCompletionBody(request.body);
    response.json({ data: completeService(await loadServiceCatalog(store, repository), getIdentity(response), request.params.entryId) });
  });

  return router;
}
