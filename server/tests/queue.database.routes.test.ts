import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { test, type TestContext } from 'node:test';
import express from 'express';
import type { Pool } from 'pg';
import { identityMiddleware } from '../src/middleware/identity.ts';
import { errorHandler } from '../src/middleware/errors.ts';
import { ApiError } from '../src/shared/ApiError.ts';
import type { QueueEntry, QueueView } from '../src/shared/models.ts';
import { createPostgresQueueRouter } from '../src/modules/queue/queue.database.routes.ts';
import type { createPostgresQueueRepository } from '../src/modules/queue/queue.repository.ts';
import { request, stopServer } from './helpers.ts';

const serviceId = '22222222-2222-4222-8222-222222222222';
const entryId = '33333333-3333-4333-8333-333333333333';
const userId = '11111111-1111-4111-8111-111111111111';
const joinedAt = new Date('2026-11-06T16:00:00Z');
const row = {
  id: entryId, serviceId, userId, priority: 0, joinedAt, status: 'queued',
  serviceStartedAt: null, serviceName: 'CTAP', userName: null, position: 1,
};
const entry: QueueEntry = {
  id: entryId, serviceId, userId, priority: 0, status: 'queued',
  joinedAt: joinedAt.toISOString(), serviceName: 'CTAP',
  serviceStartedAt: null, completedAt: null, endedAt: null,
};
const queue: QueueView = {
  service: { id: serviceId, name: 'CTAP' }, entries: [{ ...entry, position: 1 }],
  waitingCount: 1, nextEntryId: entryId, inService: [],
};

async function fixture(t: TestContext) {
  const state = { active: true, serving: false, serviceExists: true, empty: false, conflict: false };
  const calls: { method: string; args: unknown[] }[] = [];
  const repository: ReturnType<typeof createPostgresQueueRepository> = {
    async listWaiting(id) { calls.push({ method: 'listWaiting', args: [id] }); return state.empty ? [] : queue.entries; },
    async join(...args) {
      calls.push({ method: 'join', args });
      if (state.conflict) throw new ApiError(409, 'ALREADY_IN_QUEUE', 'Already waiting.');
      return entry;
    },
    async leave(...args) { calls.push({ method: 'leave', args }); return { ...entry, status: 'left' }; },
    async startService(...args) { calls.push({ method: 'startService', args }); return { started: { ...entry, status: 'serving' }, queue }; },
    async completeService(...args) { calls.push({ method: 'completeService', args }); return { completed: { ...entry, status: 'served' }, queue }; },
    async setQueueStatus(id, status) {
      calls.push({ method: 'setQueueStatus', args: [id, status] });
      return { id: serviceId, serviceId: id, status, updatedAt: joinedAt.toISOString() };
    },
  };
  const database = { async query(sql: string, values?: unknown[]) {
    calls.push({ method: 'query', args: [values] });
    if (sql.includes('SELECT id FROM services')) return { rows: [{ id: serviceId }] };
    if (sql.includes('SELECT id, name FROM services')) return { rows: state.serviceExists ? [queue.service] : [] };
    if (sql.includes('e.user_id = $1')) return { rows: state.active ? [{ ...row, ...(state.serving ? { status: 'serving', serviceStartedAt: joinedAt, position: null } : {}) }] : [] };
    if (sql.includes("e.status = 'serving'")) return { rows: state.serving ? [{ ...row, status: 'serving', serviceStartedAt: joinedAt }] : [] };
    throw new Error(`Unexpected query: ${sql}`);
  } } as unknown as Pool;
  const app = express();
  app.use(express.json());
  app.use(identityMiddleware(req => {
    const token = req.headers.authorization;
    return token === 'Bearer admin' ? { userId, role: 'admin' }
      : token === 'Bearer student' ? { userId, role: 'user' } : null;
  }));
  app.use(createPostgresQueueRouter(database, repository));
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => stopServer(server));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { state, calls, send: (path: string, options: Parameters<typeof request>[2] = {}) => request(baseUrl, path, options) };
}

test('database queue routes enforce login and administrator permissions before storage access', async t => {
  const { send, calls } = await fixture(t);
  for (const [path, method] of [
    ['/admin/queue', 'GET'], [`/services/${serviceId}/queue`, 'GET'],
    [`/services/${serviceId}/queue/serve-next`, 'POST'], [`/queue/${entryId}/complete`, 'POST'],
    [`/services/${serviceId}/queue/status`, 'PATCH'],
  ]) {
    assert.equal((await send(path, { method })).status, 401);
    assert.equal((await send(path, { method, token: 'student' })).status, 403);
  }
  for (const [path, method] of [['/queue/me', 'GET'], [`/services/${serviceId}/queue`, 'POST'], [`/queue/${entryId}`, 'DELETE']]) {
    assert.equal((await send(path, { method })).status, 401);
  }
  assert.equal(calls.length, 0);
});

test('database queue routes return complete, filtered, empty, and serving queue views', async t => {
  const { send, state } = await fixture(t);
  assert.deepEqual((await send('/admin/queue', { token: 'admin' })).body.data, { queues: [queue], totalWaiting: 1 });
  assert.deepEqual((await send(`/admin/queue?serviceId=${serviceId}`, { token: 'admin' })).body.data.queues, [queue]);
  state.serving = true;
  state.empty = true;
  const result = await send(`/services/${serviceId}/queue`, { token: 'admin' });
  assert.equal(result.status, 200);
  assert.equal(result.body.data.nextEntryId, null);
  assert.equal(result.body.data.inService[0].status, 'serving');
  assert.equal(result.body.data.inService[0].serviceStartedAt, joinedAt.toISOString());
  state.serviceExists = false;
  assert.equal((await send(`/services/${serviceId}/queue`, { token: 'admin' })).status, 404);
  assert.equal((await send('/services/invalid/queue', { token: 'admin' })).status, 400);
  assert.equal((await send('/admin/queue?userId=someone', { token: 'admin' })).status, 400);
});

test('database queue routes return the authenticated visit without allowing an owner override', async t => {
  const { send, state, calls } = await fixture(t);
  assert.deepEqual((await send('/queue/me', { token: 'student' })).body.data, { entry, position: 1 });
  assert.deepEqual(calls.at(-1)?.args, [[userId]]);
  state.serving = true;
  const serving = await send('/queue/me', { token: 'student' });
  assert.equal(serving.body.data.entry.status, 'serving');
  assert.equal(serving.body.data.position, null);
  state.active = false;
  assert.deepEqual((await send('/queue/me', { token: 'student' })).body.data, { entry: null, position: null });
});

test('database queue routes validate mutations and forward verified identity and expected visit', async t => {
  const { send, calls, state } = await fixture(t);
  assert.equal((await send(`/services/${serviceId}/queue`, { method: 'POST', token: 'student', body: {} })).status, 201);
  assert.deepEqual(calls.at(-1), { method: 'join', args: [userId, serviceId] });
  assert.equal((await send(`/queue/${entryId}`, { method: 'DELETE', token: 'student' })).body.data.status, 'left');
  assert.deepEqual(calls.at(-1), { method: 'leave', args: [userId, entryId] });
  assert.equal((await send(`/services/${serviceId}/queue/serve-next`, { method: 'POST', token: 'admin', body: { expectedEntryId: entryId } })).body.data.started.status, 'serving');
  assert.deepEqual(calls.at(-1), { method: 'startService', args: [serviceId, entryId] });
  assert.equal((await send(`/queue/${entryId}/complete`, { method: 'POST', token: 'admin', body: {} })).body.data.completed.status, 'served');
  for (const status of ['open', 'closed']) {
    assert.equal((await send(`/services/${serviceId}/queue/status`, { method: 'PATCH', token: 'admin', body: { status } })).body.data.status, status);
  }
  for (const body of [null, [], { userId: 'spoofed' }]) {
    assert.equal((await send(`/services/${serviceId}/queue`, { method: 'POST', token: 'student', body })).status, 400);
  }
  for (const body of [null, [], {}, { status: 'invalid' }, { status: 'open', extra: true }]) {
    assert.equal((await send(`/services/${serviceId}/queue/status`, { method: 'PATCH', token: 'admin', body })).status, 400);
  }
  state.conflict = true;
  const conflict = await send(`/services/${serviceId}/queue`, { method: 'POST', token: 'student' });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.error.code, 'ALREADY_IN_QUEUE');
});
