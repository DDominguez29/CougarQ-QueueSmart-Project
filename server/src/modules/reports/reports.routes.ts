import { loadServiceCatalog } from '../services/services.catalog.ts';
import { createMemoryServiceRepository, type ServiceRepository } from '../services/services.repository.ts';
import { Router } from 'express';
import type { Store } from '../../data/store.ts';
import { getIdentity, requireAdministrator } from '../../middleware/identity.ts';
import { getAdminReport } from './reports.service.ts';

export function createReportsRouter(store: Store, repository: ServiceRepository = createMemoryServiceRepository(store.services)) {
  const router = Router();
  router.get('/', async (request, response) => {
    requireAdministrator(getIdentity(response));
    response.json({ data: getAdminReport(await loadServiceCatalog(store, repository), getIdentity(response), request.query) });
  });
  return router;
}
