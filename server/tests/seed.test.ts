import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createStore } from '../src/data/store.ts';
import {
  DEMO_QUEUE,
  DEMO_STUDENT_PASSWORD,
  seedDemoAccounts,
  seedDemoQueue,
  seedDemoServices,
} from '../src/data/seed.ts';
import { login } from '../src/modules/auth/auth.service.ts';
import { estimateForNewEntry } from '../src/modules/wait-time/wait-time.service.ts';

function seededStore(now: number) {
  const store = createStore();
  seedDemoAccounts(store);
  seedDemoServices(store);
  seedDemoQueue(store, now);
  return store;
}

describe('demo queue seed', () => {
  const now = Date.UTC(2026, 9, 23, 18, 0);

  test('creates a student account and a visit for each demo student', () => {
    const store = seededStore(now);
    assert.equal(store.queueEntries.size, DEMO_QUEUE.length);
    assert.equal(store.users.size, DEMO_QUEUE.length + 2);

    const result = login(store, { email: 'mpatel14@cougarnet.uh.edu', password: DEMO_STUDENT_PASSWORD });
    assert.equal(result.user.fullName, 'Maya Patel');
    assert.equal(result.user.role, 'user');
  });

  test('keeps names, services, statuses, and wait times from the demo data', () => {
    const store = seededStore(now);
    const byName = new Map([...store.queueEntries.values()].map((entry) => [entry.userName, entry]));

    const dylan = byName.get('Dylan Whiteman')!;
    assert.equal(dylan.status, 'serving');
    assert.equal(dylan.serviceName, 'CTAP Express');
    assert.ok(dylan.serviceStartedAt);

    const ethan = byName.get('Ethan Torrie')!;
    assert.equal(ethan.status, 'left');
    assert.ok(ethan.endedAt);

    const maya = byName.get('Maya Patel')!;
    assert.equal(maya.status, 'queued');
    assert.equal(maya.joinedAt, new Date(now - 31 * 60_000).toISOString());
  });

  test('gives every service a realistic line', () => {
    const store = seededStore(now);
    assert.deepEqual(estimateForNewEntry(store, 'ctap-main'), {
      serviceId: 'ctap-main',
      peopleAhead: 6,
      estimatedWaitMinutes: 30,
      serviceMinutes: 5,
    });
    assert.equal(estimateForNewEntry(store, 'ctap-express').peopleAhead, 2);
    assert.equal(estimateForNewEntry(store, 'help-desk').peopleAhead, 1);
  });

  test('skips visits for services that do not exist', () => {
    const store = createStore();
    seedDemoQueue(store, now);
    assert.equal(store.queueEntries.size, 0);
    assert.equal(store.users.size, 0);
  });
});
