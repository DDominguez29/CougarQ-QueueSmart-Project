import { loadServiceCatalog } from '../services/services.catalog.ts';
import { createMemoryServiceRepository, type ServiceRepository } from '../services/services.repository.ts';
import { Router } from 'express';
import type { Store } from '../../data/store.ts';
import { getIdentity, requireIdentity } from '../../middleware/identity.ts';
import { ApiError } from '../../shared/ApiError.ts';
import { getUserHistory } from './history.service.ts';

export function createHistoryRouter(store: Store, repository: ServiceRepository = createMemoryServiceRepository(store.services)) {
  const router = Router();
  router.get('/me', async (request, response) => {
    const actor = requireIdentity(getIdentity(response));
    if (Object.keys(request.query).length) {
      throw new ApiError(400, 'INVALID_INPUT', 'History does not accept query parameters.');
    }
    response.json({ data: getUserHistory(await loadServiceCatalog(store, repository), actor) });
  });
  return router;
}
