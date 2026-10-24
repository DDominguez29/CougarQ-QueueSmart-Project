import { randomUUID } from 'node:crypto';

import type { Store } from '../../data/store.ts';
import type { Service } from '../../shared/models.ts';

import { ApiError } from '../../shared/ApiError.ts';
import {
  validateServiceInput,
  type ServiceInput,
} from './services.validation.ts';

export function listServices(store: Store): Service[] {
  return Array.from(store.services.values()).sort(
    (a, b) => b.priority - a.priority,
  );
}

export function createService(
  store: Store,
  input: unknown,
): Service {
  const validated = validateServiceInput(input);

  const service: Service = {
    id: randomUUID(),
    name: validated.name,
    description: validated.description,
    expectedDurationMinutes:
      validated.expectedDurationMinutes,
    priority: validated.priority,
  };

  store.services.set(service.id, service);

  return service;
}

export function updateService(
  store: Store,
  id: string,
  input: unknown,
): Service {
  const existingService = store.services.get(id);

  if (!existingService) {
    throw new ApiError(
      404,
      'SERVICE_NOT_FOUND',
      'Service not found.',
    );
  }

  const validated: ServiceInput =
    validateServiceInput(input);

  const updatedService: Service = {
    ...existingService,
    name: validated.name,
    description: validated.description,
    expectedDurationMinutes:
      validated.expectedDurationMinutes,
    priority: validated.priority,
  };

  store.services.set(id, updatedService);

  return updatedService;
}