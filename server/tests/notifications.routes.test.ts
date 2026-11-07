import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import express from 'express';
import { createStore } from '../src/data/store.ts';
import { identityMiddleware } from '../src/middleware/identity.ts';
import { errorHandler } from '../src/middleware/errors.ts';
import { ApiError } from '../src/shared/ApiError.ts';
import { createNotificationsRouter } from '../src/modules/notifications/notifications.routes.ts';
import type { createPostgresNotificationRepository } from '../src/modules/notifications/notifications.postgres.ts';
import { request, stopServer } from './helpers.ts';

test('SQL notification routes enforce ownership, handle viewed/dismissed alerts, and propagate errors', async t => {
  const calls: unknown[][] = [];
  const id = '11111111-1111-4111-8111-111111111111';
  const missingId = '22222222-2222-4222-8222-222222222222';
  const item = { id, userId: 'owner', queueEntryId: 'visit', serviceName: 'CTAP', type: 'joined' as const, message: 'Joined', createdAt: new Date().toISOString() };
  let visible = true;
  const repository: ReturnType<typeof createPostgresNotificationRepository> = {
    async list(owner) { calls.push(['list', owner]); return visible ? [item] : []; },
    async remove(owner, id) { calls.push(['remove', owner, id]); visible = false; },
    async markViewed(owner, id) {
      calls.push(['viewed', owner, id]);
      if (id === missingId) throw new ApiError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.');
    },
    async emit() { throw new Error('HTTP routes must not create arbitrary events'); },
  };
  const app = express();
  app.use(identityMiddleware(req => req.headers.authorization ? { userId: 'owner', role: 'user' } : null));
  app.use('/api/notifications', createNotificationsRouter(createStore(), repository));
  app.use('/api/memory-notifications', createNotificationsRouter(createStore()));
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => stopServer(server));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  assert.equal((await request(url, '/api/notifications')).status, 401);
  assert.equal(calls.length, 0);
  assert.deepEqual((await request(url, '/api/notifications', { token: 'owner' })).body.data, [item]);
  assert.equal((await request(url, `/api/notifications/${id}/viewed`, { token: 'owner', method: 'PATCH' })).status, 204);
  assert.deepEqual(calls.at(-1), ['viewed', 'owner', id]);
  assert.equal((await request(url, `/api/notifications/${missingId}/viewed`, { token: 'owner', method: 'PATCH' })).status, 404);
  assert.equal((await request(url, '/api/notifications/not-a-uuid/viewed', { token: 'owner', method: 'PATCH' })).status, 400);
  assert.equal((await request(url, '/api/notifications/not-a-uuid', { token: 'owner', method: 'DELETE' })).status, 400);
  assert.equal((await request(url, `/api/notifications/${id}`, { token: 'owner', method: 'DELETE' })).status, 204);
  assert.deepEqual(calls.at(-1), ['remove', 'owner', id]);
  assert.deepEqual((await request(url, '/api/notifications', { token: 'owner' })).body.data, []);
  assert.equal((await request(url, '/api/memory-notifications/notice/viewed', { token: 'owner', method: 'PATCH' })).status, 503);
});
