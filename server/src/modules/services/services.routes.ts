import { Router } from 'express';

import type { Store } from '../../data/store.ts';
import { createMemoryServiceRepository, type ServiceRepository } from './services.repository.ts';

import {
  getIdentity,
  requireAdministrator,
} from '../../middleware/identity.ts';

import {
  createService,
  listServices,
  updateService,
} from './services.service.ts';

export function createServicesRouter(store: Store, repository: ServiceRepository = createMemoryServiceRepository(store.services)) {
  const router = Router();

  // Anyone can view available services.
  router.get('/', async (_request, response) => {
    const services = await listServices(repository);
    response.set('Cache-Control', 'no-store');

    response.json({
      data: services,
    });
  });

  // Only administrators can create services.
  router.post('/', async (request, response) => {
    requireAdministrator(getIdentity(response));

    const service = await createService(
      repository,
      request.body,
    );

    response.status(201).json({
      data: service,
    });
  });

  // Only administrators can update services.
  router.put('/:id', async (request, response) => {
    requireAdministrator(getIdentity(response));

    const service = await updateService(
      repository,
      request.params.id,
      request.body,
    );

    response.json({
      data: service,
    });
  });

  return router;
}
