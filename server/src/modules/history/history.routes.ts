
import { Router } from 'express';
import type { Pool } from 'pg';
import type { Store } from '../../data/store.ts';

import {
  getIdentity,
  requireIdentity,
} from '../../middleware/identity.ts';

import { ApiError } from '../../shared/ApiError.ts';

import { loadServiceCatalog } from '../services/services.catalog.ts';

import {
  createMemoryServiceRepository,
  type ServiceRepository,
} from '../services/services.repository.ts';

import { getUserHistory } from './history.service.ts';

export function createHistoryRouter(
  store: Store,
  repository: ServiceRepository =
    createMemoryServiceRepository(store.services),
  database?: Pool,
) {
  const router = Router();

  // Retrieve history for the authenticated user.
  router.get('/me', async (request, response) => {
    const actor = requireIdentity(
      getIdentity(response),
    );

    // Reject unexpected query parameters.
    if (Object.keys(request.query).length > 0) {
      throw new ApiError(
        400,
        'INVALID_INPUT',
        'History does not accept query parameters.',
      );
    }

    // Load the current services and queue entries.
    // PostgreSQL is used when a database is configured.
    // Memory remains available for database-free tests.
    const catalog = await loadServiceCatalog(
      store,
      repository,
      database,
    );

    // Return only this user's completed or canceled visits.
    const history = getUserHistory(catalog, actor);

    response.json({
      data: history,
    });
  });

  return router;
}
