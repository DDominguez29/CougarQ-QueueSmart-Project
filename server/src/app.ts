import express from 'express';
import type { Pool } from 'pg';

import { createStore, type Store } from './data/store.ts';
import { checkDatabaseConnection } from './data/database.ts';
import { errorHandler, notFound } from './middleware/errors.ts';
import { createAuthRouter } from './modules/auth/auth.routes.ts';
import { createWaitTimeRouter } from './modules/wait-time/wait-time.routes.ts';
import { identityMiddleware, type IdentityResolver } from './middleware/identity.ts';

import { createHistoryRouter } from './modules/history/history.routes.ts';
import { createAdminQueueRouter } from './modules/queue/queue.routes.ts';
import { createReportsRouter } from './modules/reports/reports.routes.ts';
import { createServicesRouter } from './modules/services/services.routes.ts';
import { createMemoryServiceRepository, createPostgresServiceRepository } from './modules/services/services.repository.ts';
import { createNotificationsRouter } from './modules/notifications/notifications.routes.ts';
import { createUserQueueRouter } from './modules/queue/queue.user.routes.ts';

export interface AppOptions {
  resolveIdentity?: IdentityResolver;
  database?: Pool;
}

export function createApp(store: Store = createStore(), options: AppOptions = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  app.locals.store = store;
  app.locals.database = options.database;
  const services = options.database
    ? createPostgresServiceRepository(options.database)
    : createMemoryServiceRepository(store.services);

  app.use('/api/auth', createAuthRouter(store));
  app.use('/api/wait-time', createWaitTimeRouter(store, services));

  app.get('/api/health', (_request, response) => {
    response.json({
      data: {
        status: 'ok',
      },
    });
  });

  app.get('/api/health/db', async (_request, response) => {
    try {
      if (!options.database) throw new Error('No database configured');
      await checkDatabaseConnection(options.database);
      response.json({ data: { status: 'ok', database: 'connected' } });
    } catch {
      response.status(503).json({
        error: { code: 'DATABASE_UNAVAILABLE', message: 'PostgreSQL is unavailable.' },
      });
    }
  });

  app.use('/api', identityMiddleware(options.resolveIdentity));

  app.use('/api/services', createServicesRouter(store, services));
  app.use('/api/history', createHistoryRouter(store, services));
  app.use('/api/notifications', createNotificationsRouter(store));
  app.use('/api/admin/reports', createReportsRouter(store, services));
  app.use('/api', createAdminQueueRouter(store, services));
  app.use('/api', createUserQueueRouter(store, services));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
