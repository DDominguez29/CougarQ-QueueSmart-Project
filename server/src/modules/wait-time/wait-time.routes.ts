
import { Router } from 'express';
import type { Pool } from 'pg';
import type { Store } from '../../data/store.ts';
import { ApiError } from '../../shared/ApiError.ts';

import {
  getIdentity,
  requireIdentity,
} from '../../middleware/identity.ts';

import { loadServiceCatalog } from '../services/services.catalog.ts';

import {
  createMemoryServiceRepository,
  type ServiceRepository,
} from '../services/services.repository.ts';

import {
  estimateForEntry,
  estimateForNewEntry,
} from './wait-time.service.ts';

export function createWaitTimeRouter(
  store: Store,
  repository: ServiceRepository =
    createMemoryServiceRepository(store.services),
  database?: Pool,
) {
  const router = Router();

  // Preserve the existing authentication system.
  router.use((_request, response, next) => {
    requireIdentity(getIdentity(response));
    next();
  });

  // Get wait estimates for all services.
  router.get('/services', async (_request, response) => {
    const catalog = await loadServiceCatalog(
      store,
      repository,
      database,
    );

    const estimates = [...catalog.services.keys()].map(
      (id) => estimateForNewEntry(catalog, id),
    );

    response.json({
      data: { estimates },
    });
  });

  // Get wait estimate for one service.
  router.get(
    '/services/:serviceId',
    async (request, response) => {
      const catalog = await loadServiceCatalog(
        store,
        repository,
        database,
      );

      const estimate = estimateForNewEntry(
        catalog,
        request.params.serviceId,
      );

      response.json({
        data: estimate,
      });
    },
  );

  // Get wait estimate for an existing queue entry.
  router.get(
    '/entries/:entryId',
    async (request, response) => {
      const { userId, role } = requireIdentity(
        getIdentity(response),
      );

      const catalog = await loadServiceCatalog(
        store,
        repository,
        database,
      );

      const entry = catalog.queueEntries.get(
        request.params.entryId,
      );

      // Students can only view their own entries.
      // Administrators can view any entry.
      if (
        entry &&
        role !== 'admin' &&
        entry.userId !== userId
      ) {
        throw new ApiError(
          403,
          'FORBIDDEN',
          'You do not have access to this queue entry.',
        );
      }

      const estimate = estimateForEntry(
        catalog,
        request.params.entryId,
      );

      response.json({
        data: estimate,
      });
    },
  );

  return router;
}
