import { loadServiceCatalog } from '../services/services.catalog.ts';
import { createMemoryServiceRepository, type ServiceRepository } from '../services/services.repository.ts';
import { Router } from 'express';
import type { Store } from '../../data/store.ts';
import { ApiError } from '../../shared/ApiError.ts';
import { getAuth, requireAuth } from '../auth/auth.middleware.ts';
import { estimateForEntry, estimateForNewEntry } from './wait-time.service.ts';

export function createWaitTimeRouter(store: Store, repository: ServiceRepository = createMemoryServiceRepository(store.services)) {
  const router = Router();
  router.use(requireAuth(store));

  router.get('/services', async (_request, response) => {
    const catalog = await loadServiceCatalog(store, repository);
    const estimates = [...catalog.services.keys()].map((id) => estimateForNewEntry(catalog, id));
    response.json({ data: { estimates } });
  });

  router.get('/services/:serviceId', async (request, response) => {
    response.json({ data: estimateForNewEntry(await loadServiceCatalog(store, repository), request.params.serviceId) });
  });

  router.get('/entries/:entryId', async (request, response) => {
    const { userId, role } = getAuth(response);
    const entry = store.queueEntries.get(request.params.entryId);
    if (entry && role !== 'admin' && entry.userId !== userId) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not have access to this queue entry.');
    }
    response.json({ data: estimateForEntry(await loadServiceCatalog(store, repository), request.params.entryId) });
  });

  return router;
}
