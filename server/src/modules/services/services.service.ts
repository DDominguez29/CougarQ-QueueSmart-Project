import { ApiError } from '../../shared/ApiError.ts';
import type { ServiceRepository } from './services.repository.ts';
import { validateServiceInput } from './services.validation.ts';

export function listServices(repository: ServiceRepository) {
  return repository.list();
}

export function createService(repository: ServiceRepository, input: unknown) {
  return repository.create(validateServiceInput(input));
}

export async function updateService(repository: ServiceRepository, id: string, input: unknown) {
  const service = await repository.update(id, validateServiceInput(input));
  if (!service) throw new ApiError(404, 'SERVICE_NOT_FOUND', 'Service not found.');
  return service;
}
