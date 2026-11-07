import express from 'express';
import type { Pool } from 'pg';

import { createStore, type Store } from './data/store.ts';
import { checkDatabaseConnection } from './data/database.ts';
import { errorHandler, notFound } from './middleware/errors.ts';
import { createAuthRouter } from './modules/auth/auth.routes.ts';
import { createWaitTimeRouter } from './modules/wait-time/wait-time.routes.ts';
import { createIdentityResolver } from './modules/auth/auth.middleware.ts';
import { createMemoryAuthRepository, createPostgresAuthRepository } from './modules/auth/auth.repository.ts';
import { identityMiddleware, type IdentityResolver } from './middleware/identity.ts';

import { createHistoryRouter } from './modules/history/history.routes.ts';
import { createAdminQueueRouter } from './modules/queue/queue.routes.ts';
import { createReportsRouter } from './modules/reports/reports.routes.ts';
import { createServicesRouter } from './modules/services/services.routes.ts';
import { createMemoryServiceRepository, createPostgresServiceRepository } from './modules/services/services.repository.ts';
import { createNotificationsRouter } from './modules/notifications/notifications.routes.ts';
import { createPostgresNotificationRepository } from './modules/notifications/notifications.postgres.ts';
import { createUserQueueRouter } from './modules/queue/queue.user.routes.ts';

import { createPostgresQueueRouter } from './modules/queue/queue.database.routes.ts';

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
  const accounts = options.database
    ? createPostgresAuthRepository(options.database)
    : createMemoryAuthRepository(store);

  app.use('/api/auth', createAuthRouter(accounts));

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

  app.use('/api', identityMiddleware(options.resolveIdentity ?? createIdentityResolver(accounts)));

  app.use('/api/wait-time', createWaitTimeRouter(store, services, options.database));

  app.use('/api/services', createServicesRouter(store, services));
  app.use('/api/history', createHistoryRouter(store, services, options.database));
  app.use('/api/notifications', createNotificationsRouter(
    store,
    options.database ? createPostgresNotificationRepository(options.database) : undefined,
  ));
  app.use('/api/admin/reports', createReportsRouter(store, services, options.database));
  // Production uses PostgreSQL for queue operations.
  // Database-free unit tests retain the original memory-backed routes.
  if (options.database) {
    app.use('/api', createPostgresQueueRouter(options.database));
  } else {
    app.use('/api', createAdminQueueRouter(store, services));
    app.use('/api', createUserQueueRouter(store, services));
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
