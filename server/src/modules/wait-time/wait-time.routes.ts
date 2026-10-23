import { Router } from 'express';
import type { Store } from '../../data/store.ts';
import { ApiError } from '../../shared/ApiError.ts';
import { getAuth, requireAuth } from '../auth/auth.middleware.ts';
import { estimateForEntry, estimateForNewEntry } from './wait-time.service.ts';

export function createWaitTimeRouter(store: Store) {
  const router = Router();
  router.use(requireAuth(store));

  router.get('/services', (_request, response) => {
    const estimates = [...store.services.keys()].map((id) => estimateForNewEntry(store, id));
    response.json({ data: { estimates } });
  });

  router.get('/services/:serviceId', (request, response) => {
    response.json({ data: estimateForNewEntry(store, request.params.serviceId) });
  });

  router.get('/entries/:entryId', (request, response) => {
    const { userId, role } = getAuth(response);
    const entry = store.queueEntries.get(request.params.entryId);
    if (entry && role !== 'admin' && entry.userId !== userId) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not have access to this queue entry.');
    }
    response.json({ data: estimateForEntry(store, request.params.entryId) });
  });

  return router;
}
