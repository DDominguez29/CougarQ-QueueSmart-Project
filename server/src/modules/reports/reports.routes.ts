import { Router } from 'express';
import type { Store } from '../../data/store.ts';
import { getIdentity } from '../../middleware/identity.ts';
import { getAdminReport } from './reports.service.ts';

export function createReportsRouter(store: Store) {
  const router = Router();
  router.get('/', (request, response) => {
    response.json({ data: getAdminReport(store, getIdentity(response), request.query) });
  });
  return router;
}
