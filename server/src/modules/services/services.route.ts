import { Router } from 'express';

import type { Store } from '../../data/store.ts';

import {
  createService,
  listServices,
  updateService,
} from './services.service.ts';

export function createServicesRouter(store: Store) {
  const router = Router();

  router.get('/', (_request, response) => {
    const services = listServices(store);

    response.json({
      data: services,
    });
  });

  router.post('/', (request, response) => {
    const service = createService(
      store,
      request.body,
    );

    response.status(201).json({
      data: service,
    });
  });

  router.put('/:id', (request, response) => {
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