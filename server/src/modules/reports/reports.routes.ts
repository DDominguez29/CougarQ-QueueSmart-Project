
import { Router } from 'express';
import type { Pool } from 'pg';
import type { Store } from '../../data/store.ts';
import {
  getIdentity,
  requireAdministrator,
} from '../../middleware/identity.ts';
import { loadServiceCatalog } from '../services/services.catalog.ts';
import {
  createMemoryServiceRepository,
  type ServiceRepository,
} from '../services/services.repository.ts';
import { getAdminReport } from './reports.service.ts';

export function createReportsRouter(
  store: Store,
  repository: ServiceRepository =
    createMemoryServiceRepository(store.services),
  database?: Pool,
) {
  const router = Router();

  router.get('/', async (request, response) => {
    const actor = requireAdministrator(
      getIdentity(response),
    );

    const catalog = await loadServiceCatalog(
      store, repository, database,
    );

    response.json({
      data: getAdminReport(
        catalog,
        actor,
        request.query,
      ),
    });
  });

  return router;
}
