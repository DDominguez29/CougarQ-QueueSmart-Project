import type { Store } from '../../data/store.ts';
import type { ServiceRepository } from './services.repository.ts';

// Fresh per-request SQL data for existing synchronous queue/history calculations.
// Participation/auth stores remain shared until their own database migrations.
export async function loadServiceCatalog(store: Store, repository: ServiceRepository): Promise<Store> {
  const services = await repository.list();
  return { ...store, services: new Map(services.map((service) => [service.id, service])) };
}
