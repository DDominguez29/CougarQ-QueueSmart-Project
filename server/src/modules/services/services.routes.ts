import { Router } from 'express';

import type { Store } from '../../data/store.ts';

import {
  getIdentity,
  requireAdministrator,
} from '../../middleware/identity.ts';

import {
  createService,
  listServices,
  updateService,
} from './services.service.ts';

export function createServicesRouter(store: Store) {
  const router = Router();

  // Anyone can view available services.
  router.get('/', (_request, response) => {
    const services = listServices(store);

    response.json({
      data: services,
    });
  });

  // Only administrators can create services.
  router.post('/', (request, response) => {
    requireAdministrator(getIdentity(response));

    const service = createService(
      store,
      request.body,
    );

    response.status(201).json({
      data: service,
    });
  });

  // Only administrators can update services.
  router.put('/:id', (request, response) => {
    requireAdministrator(getIdentity(response));

    const service = updateService(
      store,
      request.params.id,
      request.body,
    );

    response.json({
      data: service,
    });
  });

  return router;
}