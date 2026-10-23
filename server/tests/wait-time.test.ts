import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, before, describe, test } from 'node:test';
import { createStore, type Store } from '../src/data/store.ts';
import { DEMO_SERVICES, seedDemoAccounts, seedDemoServices } from '../src/data/seed.ts';
import { login } from '../src/modules/auth/auth.service.ts';
import {
  compareQueueEntries,
  estimateForEntry,
  estimateForNewEntry,
  estimateWaitMinutes,
  getWaitingLine,
} from '../src/modules/wait-time/wait-time.service.ts';
import type { QueueEntry, QueueStatus } from '../src/shared/models.ts';
import { request, startServer, stopServer } from './helpers.ts';

// Seeded minutes: ctap-main 5, ctap-express 2, help-desk 4.
function seededStore() {
  const store = createStore();
  seedDemoServices(store);
  return store;
}

let counter = 0;
function addEntry(
  store: Store,
  options: {
    serviceId?: string;
    userId?: string;
    priority?: number;
    minute?: number;
    status?: QueueStatus;
  } = {},
) {
  counter += 1;
  const entry: QueueEntry = {
    id: `entry-${counter}`,
    userId: options.userId ?? `user-${counter}`,
    serviceId: options.serviceId ?? 'ctap-main',
    priority: options.priority ?? 1,
    joinedAt: new Date(Date.UTC(2026, 9, 22, 12, options.minute ?? counter)).toISOString(),
    status: options.status ?? 'queued',
    endedAt: null,
  };
  store.queueEntries.set(entry.id, entry);
  return entry;
}

describe('wait-time formula', () => {
  test('is zero when nobody is ahead', () => {
    assert.equal(estimateWaitMinutes([]), 0);
  });

  test('adds up the service time of each person ahead', () => {
    assert.equal(estimateWaitMinutes([5, 2, 4]), 11);
  });

  test('rounds partial minutes up', () => {
    assert.equal(estimateWaitMinutes([1.5, 2]), 4);
  });

  test('rejects durations that are not positive numbers', () => {
    assert.throws(() => estimateWaitMinutes([0]), { status: 400 });
    assert.throws(() => estimateWaitMinutes([5, -3]), { status: 400 });
    assert.throws(() => estimateWaitMinutes([Number.NaN]), { status: 400 });
  });
});

describe('seeded services', () => {
  test('match the three services the team agreed on', () => {
    assert.deepEqual(
      DEMO_SERVICES.map((service) => [service.name, service.expectedDurationMinutes]),
      [
        ['CTAP Main Lane', 5],
        ['CTAP Express', 2],
        ['Support Table Help Desk', 4],
      ],
    );
  });
});

describe('queue ordering', () => {
  test('puts higher priority first, then earlier arrivals', () => {
    const store = createStore();
    const late = addEntry(store, { minute: 5 });
    const early = addEntry(store, { minute: 1 });
    const urgent = addEntry(store, { priority: 3, minute: 9 });
    const sorted = [late, early, urgent].sort(compareQueueEntries);
    assert.deepEqual(sorted.map((entry) => entry.id), [urgent.id, early.id, late.id]);
  });

  test('uses one line for every service and skips finished entries', () => {
    const store = seededStore();
    const main = addEntry(store, { serviceId: 'ctap-main', minute: 1 });
    const express = addEntry(store, { serviceId: 'ctap-express', minute: 2 });
    addEntry(store, { status: 'served', minute: 3 });
    addEntry(store, { status: 'left', minute: 4 });
    const help = addEntry(store, { serviceId: 'help-desk', minute: 5 });
    assert.deepEqual(getWaitingLine(store).map((entry) => entry.id), [main.id, express.id, help.id]);
  });
});

describe('wait-time estimates', () => {
  test('a new person waits for everyone in line, whatever service they picked', () => {
    const store = seededStore();
    addEntry(store, { serviceId: 'ctap-main' });
    addEntry(store, { serviceId: 'ctap-express' });
    addEntry(store, { serviceId: 'help-desk' });

    const estimate = estimateForNewEntry(store, 'ctap-express');
    assert.equal(estimate.peopleAhead, 3);
    assert.equal(estimate.estimatedWaitMinutes, 11);
    assert.equal(estimate.serviceMinutes, 2);
  });

  test('throws for an unknown service', () => {
    assert.throws(() => estimateForNewEntry(seededStore(), 'missing'), { status: 404 });
  });

  test('gives position, wait, and stage for a waiting entry', () => {
    const store = seededStore();
    addEntry(store, { serviceId: 'ctap-main' });
    addEntry(store, { serviceId: 'ctap-main' });
    addEntry(store, { serviceId: 'ctap-express' });
    const mine = addEntry(store, { serviceId: 'help-desk' });

    const estimate = estimateForEntry(store, mine.id);
    assert.equal(estimate.position, 4);
    assert.equal(estimate.peopleAhead, 3);
    assert.equal(estimate.estimatedWaitMinutes, 12);
    assert.equal(estimate.stage, 'waiting');
  });

  test('marks someone almost ready when two or fewer are ahead', () => {
    const store = seededStore();
    addEntry(store);
    addEntry(store);
    const mine = addEntry(store);
    assert.equal(estimateForEntry(store, mine.id).stage, 'almost-ready');
  });

  test('the first person in line has no wait', () => {
    const store = seededStore();
    const first = addEntry(store);
    const estimate = estimateForEntry(store, first.id);
    assert.equal(estimate.position, 1);
    assert.equal(estimate.estimatedWaitMinutes, 0);
  });

  test('reports finished entries without a position', () => {
    const store = seededStore();
    const served = addEntry(store, { status: 'served' });
    const estimate = estimateForEntry(store, served.id);
    assert.equal(estimate.stage, 'served');
    assert.equal(estimate.position, null);
    assert.equal(estimate.estimatedWaitMinutes, 0);
  });

  test('throws for a missing entry', () => {
    assert.throws(() => estimateForEntry(createStore(), 'missing'), { status: 404 });
  });
});

describe('wait-time endpoints', () => {
  let server: Server;
  let baseUrl: string;
  let studentToken: string;
  let adminToken: string;
  let studentEntryId: string;
  let otherEntryId: string;

  before(async () => {
    const store = seededStore();
    seedDemoAccounts(store);
    studentToken = login(store, { email: 'student@cougarnet.uh.edu', password: 'Cougar123' }).token;
    adminToken = login(store, { email: 'admin@uh.edu', password: 'Admin123' }).token;
    const studentId = [...store.users.values()].find((user) => user.role === 'user')!.id;
    otherEntryId = addEntry(store, { userId: 'someone-else', serviceId: 'ctap-main' }).id;
    studentEntryId = addEntry(store, { userId: studentId, serviceId: 'ctap-express' }).id;
    ({ server, baseUrl } = await startServer(store));
  });

  after(() => stopServer(server));

  test('requires sign in', async () => {
    const response = await request(baseUrl, '/api/wait-time/services');
    assert.equal(response.status, 401);
  });

  test('lists an estimate for every service', async () => {
    const response = await request(baseUrl, '/api/wait-time/services', { token: studentToken });
    assert.equal(response.status, 200);
    assert.equal(response.body.data.estimates.length, 3);
    for (const estimate of response.body.data.estimates) {
      assert.equal(estimate.peopleAhead, 2);
      assert.equal(estimate.estimatedWaitMinutes, 7);
    }
  });

  test('estimates one service and returns 404 for unknown ones', async () => {
    const ok = await request(baseUrl, '/api/wait-time/services/help-desk', { token: studentToken });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.serviceMinutes, 4);

    const missing = await request(baseUrl, '/api/wait-time/services/nope', { token: studentToken });
    assert.equal(missing.status, 404);
  });

  test('lets owners and admins see an entry estimate, but not other students', async () => {
    const own = await request(baseUrl, `/api/wait-time/entries/${studentEntryId}`, { token: studentToken });
    assert.equal(own.status, 200);
    assert.equal(own.body.data.position, 2);
    assert.equal(own.body.data.estimatedWaitMinutes, 5);

    const admin = await request(baseUrl, `/api/wait-time/entries/${otherEntryId}`, { token: adminToken });
    assert.equal(admin.status, 200);

    const blocked = await request(baseUrl, `/api/wait-time/entries/${otherEntryId}`, { token: studentToken });
    assert.equal(blocked.status, 403);
  });
});
