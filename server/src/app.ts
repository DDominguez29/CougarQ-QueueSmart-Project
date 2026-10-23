import express from 'express';

import { createStore, type Store } from './data/store.ts';
import { errorHandler, notFound } from './middleware/errors.ts';
import { createServicesRouter } from './modules/services/services.routes.ts';

export function createApp(store: Store = createStore()) {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  app.locals.store = store;

  app.get('/api/health', (_request, response) => {
    response.json({
      data: {
        status: 'ok',
      },
    });
  });

  app.use('/api/services', createServicesRouter(store));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
