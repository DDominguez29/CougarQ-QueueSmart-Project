import express from 'express';
import { createStore, type Store } from './data/store.ts';
import { errorHandler, notFound } from './middleware/errors.ts';

export function createApp(store: Store = createStore()) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  // Mount feature routers here, passing this same store into each router factory.
  app.locals.store = store;

  app.get('/api/health', (_request, response) => {
    response.json({ data: { status: 'ok' } });
  });

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
