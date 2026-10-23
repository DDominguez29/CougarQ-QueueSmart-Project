import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { test, type TestContext } from 'node:test';
import { createApp } from '../src/app.ts';
import type { Store } from '../src/data/store.ts';
import type { IdentityResolver } from '../src/middleware/identity.ts';
import { storeDate } from '../src/modules/reports/reports.validation.ts';
import { admin, student, makeEntry, makeStore } from './fixtures.ts';

// Known credentials exist only in these tests. Production has no default resolver.
const testIdentity: IdentityResolver = (request) => {
  if (request.headers.authorization === 'Bearer test-admin') return admin;
  if (request.headers.authorization === 'Bearer test-student') return student;
  return null;
};

async function startApp(t: TestContext, store: Store, resolveIdentity: IdentityResolver | null = testIdentity) {
  const server = createApp(store, { resolveIdentity: resolveIdentity ?? undefined }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
}

const adminHeaders = { Authorization: 'Bearer test-admin', 'Content-Type': 'application/json' };
const studentHeaders = { Authorization: 'Bearer test-student' };

test('admin queue API returns service queues and accepts a service filter', async (t) => {
  const url = await startApp(t, makeStore([makeEntry()]));
  const response = await fetch(`${url}/admin/queue?serviceId=ctap`, { headers: adminHeaders });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: {
    queues: [{ service: { id: 'ctap', name: 'CTAP Pickup' }, entries: [{ ...makeEntry(), position: 1 }], waitingCount: 1, nextEntryId: 'entry-1', inService: [] }],
    totalWaiting: 1,
  } });
  const single = await fetch(`${url}/services/ctap/queue`, { headers: adminHeaders });
  assert.equal(single.status, 200);
});

test('all feature APIs deny access without an auth integration', async (t) => {
  const url = await startApp(t, makeStore(), null);
  for (const path of ['/admin/queue', '/services/ctap/queue', '/history/me', '/admin/reports']) {
    const response = await fetch(`${url}${path}`, { headers: adminHeaders });
    assert.equal(response.status, 401);
  }
});

test('client supplied roles and user IDs cannot grant administrator access', async (t) => {
  const url = await startApp(t, makeStore([makeEntry()]));
  const response = await fetch(`${url}/services/ctap/queue/serve-next`, {
    method: 'POST', headers: { ...studentHeaders, 'Content-Type': 'application/json', 'X-Role': 'admin' },
    body: JSON.stringify({ expectedEntryId: 'entry-1', role: 'admin' }),
  });
  assert.equal(response.status, 403);
});

test('two concurrent serve requests for the same entry only serve one user', async (t) => {
  const store = makeStore([makeEntry(), makeEntry({ id: 'entry-2' })]);
  const url = await startApp(t, store);
  const responses = await Promise.all([1, 2].map(() => fetch(`${url}/services/ctap/queue/serve-next`, {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({ expectedEntryId: 'entry-1' }),
  })));
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
  assert.equal(store.queueEntries.get('entry-1')?.status, 'serving');
  assert.equal(store.queueEntries.get('entry-2')?.status, 'queued');
  const activeHistory = await fetch(`${url}/history/me`, { headers: studentHeaders });
  assert.deepEqual(await activeHistory.json(), { data: [] });
  const date = storeDate(new Date(store.queueEntries.get('entry-1')!.serviceStartedAt!));
  const reportUrl = `${url}/admin/reports?startDate=${date}&endDate=${date}`;
  const beforeCompletion = await fetch(reportUrl, { headers: adminHeaders });
  const beforeBody = await beforeCompletion.json() as { data: { summary: { servedVisits: number } } };
  assert.equal(beforeBody.data.summary.servedVisits, 0);
  const completion = await fetch(`${url}/queue/entry-1/complete`, { method: 'POST', headers: adminHeaders });
  assert.equal(completion.status, 200);
  const completedDate = storeDate(new Date(store.queueEntries.get('entry-1')!.completedAt!));
  const afterCompletion = await fetch(`${url}/admin/reports?startDate=${completedDate}&endDate=${completedDate}`, { headers: adminHeaders });
  const afterBody = await afterCompletion.json() as { data: { summary: { servedVisits: number; measuredWaitVisits: number } } };
  assert.equal(afterBody.data.summary.servedVisits, 1);
  assert.equal(afterBody.data.summary.measuredWaitVisits, 1);
  const history = await fetch(`${url}/history/me`, { headers: studentHeaders });
  const body = await history.json() as { data: { id: string }[] };
  assert.deepEqual(body.data.map((entry) => entry.id), ['entry-1']);
});

test('serve API rejects missing, invalid, and unexpected fields', async (t) => {
  const url = await startApp(t, makeStore([makeEntry()]));
  for (const body of [{}, { expectedEntryId: 42 }, { expectedEntryId: 'entry-1', userId: 'other' }]) {
    const response = await fetch(`${url}/services/ctap/queue/serve-next`, {
      method: 'POST', headers: adminHeaders, body: JSON.stringify(body),
    });
    assert.equal(response.status, 400);
  }
});

test('queue API returns expected errors for unknown services, empty queues, and invalid filters', async (t) => {
  const url = await startApp(t, makeStore());
  const missing = await fetch(`${url}/services/missing/queue`, { headers: adminHeaders });
  assert.equal(missing.status, 404);
  const empty = await fetch(`${url}/services/ctap/queue/serve-next`, {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({ expectedEntryId: 'entry-1' }),
  });
  assert.equal(empty.status, 409);
  for (const query of ['serviceId=ctap&serviceId=support', 'serviceId=', 'role=admin']) {
    const invalid = await fetch(`${url}/admin/queue?${query}`, { headers: adminHeaders });
    assert.equal(invalid.status, 400);
  }
});

test('history API uses the authenticated user and rejects user ID overrides', async (t) => {
  const url = await startApp(t, makeStore([
    makeEntry({ status: 'served' }),
    makeEntry({ id: 'other', userId: 'student-2', status: 'left' }),
  ]));
  const own = await fetch(`${url}/history/me`, { headers: studentHeaders });
  assert.equal(own.status, 200);
  const ownBody = await own.json() as { data: { id: string }[] };
  assert.deepEqual(ownBody.data.map((entry) => entry.id), ['entry-1']);
  const override = await fetch(`${url}/history/me?userId=student-2`, { headers: studentHeaders });
  assert.equal(override.status, 400);
});

test('async authentication resolvers can supply a verified identity', async (t) => {
  const url = await startApp(t, makeStore(), async () => student);
  const response = await fetch(`${url}/history/me`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: [] });
});

test('authentication failures return a sanitized server error', async (t) => {
  t.mock.method(console, 'error', () => {});
  const url = await startApp(t, makeStore(), async () => { throw new Error('Internal session details'); });
  const response = await fetch(`${url}/history/me`);
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected server error occurred.' },
  });
});

test('reports API enforces admin access and validates filters', async (t) => {
  const url = await startApp(t, makeStore());
  const forbidden = await fetch(`${url}/admin/reports`, { headers: studentHeaders });
  assert.equal(forbidden.status, 403);
  const bad = await fetch(`${url}/admin/reports?startDate=2026-02-30`, { headers: adminHeaders });
  assert.equal(bad.status, 400);
  const response = await fetch(`${url}/admin/reports?startDate=2026-10-22&endDate=2026-10-22`, { headers: adminHeaders });
  assert.equal(response.status, 200);
  const body = await response.json() as { data: { summary: { servedVisits: number; averageWaitMinutes: number | null }; timeZone: string } };
  assert.equal(body.data.summary.servedVisits, 0);
  assert.equal(body.data.summary.averageWaitMinutes, null);
  assert.equal(body.data.timeZone, 'America/Chicago');
});

test('completion API rejects timestamp overrides and repeat completions', async (t) => {
  const store = makeStore([makeEntry({ status: 'serving', serviceStartedAt: '2026-10-22T10:10:00.000Z' })]);
  const url = await startApp(t, store);
  const forbidden = await fetch(`${url}/queue/entry-1/complete`, { method: 'POST', headers: studentHeaders });
  assert.equal(forbidden.status, 403);
  const bad = await fetch(`${url}/queue/entry-1/complete`, { method: 'POST', headers: adminHeaders, body: JSON.stringify({ completedAt: '2026-10-22' }) });
  assert.equal(bad.status, 400);
  const responses = await Promise.all([1, 2].map(() => fetch(`${url}/queue/entry-1/complete`, { method: 'POST', headers: adminHeaders })));
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
});
