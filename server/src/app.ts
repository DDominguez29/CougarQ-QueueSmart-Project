import express from 'express';
import { createStore, type Store } from './data/store.ts';
import { errorHandler, notFound } from './middleware/errors.ts';
import { createAuthRouter } from './modules/auth/auth.routes.ts';
import { createWaitTimeRouter } from './modules/wait-time/wait-time.routes.ts';
import { identityMiddleware, type IdentityResolver } from './middleware/identity.ts';
import { createAdminQueueRouter } from './modules/queue/queue.routes.ts';
import { createHistoryRouter } from './modules/history/history.routes.ts';
import { createReportsRouter } from './modules/reports/reports.routes.ts';

export interface AppOptions {
  resolveIdentity?: IdentityResolver;
}

export function createApp(store: Store = createStore(), options: AppOptions = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  // Mount feature routers here, passing this same store into each router factory.
  app.locals.store = store;

  app.use('/api/auth', createAuthRouter(store));
  app.use('/api/wait-time', createWaitTimeRouter(store));

  app.get('/api/health', (_request, response) => {
    response.json({ data: { status: 'ok' } });
  });

  app.use('/api', identityMiddleware(options.resolveIdentity));
  app.use('/api/history', createHistoryRouter(store));
  app.use('/api/admin/reports', createReportsRouter(store));
  app.use('/api', createAdminQueueRouter(store));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
