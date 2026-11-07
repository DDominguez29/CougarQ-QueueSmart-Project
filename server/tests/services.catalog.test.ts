import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Pool } from 'pg';
import { createStore } from '../src/data/store.ts';
import { loadServiceCatalog } from '../src/modules/services/services.catalog.ts';
import { createMemoryServiceRepository } from '../src/modules/services/services.repository.ts';

test('SQL service snapshots include retained visits without modifying the shared memory store', async () => {
  const store = createStore();
  const service = { id: 'service', name: 'New Name', description: 'Pickup', priority: 4, expectedDurationMinutes: 3 };
  const repository = createMemoryServiceRepository(new Map([[service.id, service]]));
  const joinedAt = new Date('2026-11-06T16:00:00Z');
  const endedAt = new Date('2026-11-06T16:10:00Z');
  const base = { userId: 'user', userName: null, serviceId: service.id, serviceName: 'Original Name', priority: 2, joinedAt };
  let queries = 0;
  const database = { async query() {
    queries++;
    return { rows: [
      { ...base, id: 'waiting', status: 'queued', serviceStartedAt: null, completedAt: null, endedAt: null },
      { ...base, id: 'finished', userName: 'Student', status: 'served', serviceStartedAt: endedAt, completedAt: endedAt, endedAt },
    ] };
  } } as unknown as Pool;
  const snapshot = await loadServiceCatalog(store, repository, database);
  assert.equal(snapshot.services.get(service.id)?.name, 'New Name');
  assert.equal(snapshot.queueEntries.get('finished')?.serviceName, 'Original Name');
  assert.equal(snapshot.queueEntries.get('finished')?.userName, 'Student');
  assert.equal(snapshot.queueEntries.get('finished')?.completedAt, endedAt.toISOString());
  assert.equal(snapshot.queueEntries.get('waiting')?.serviceStartedAt, null);
  assert.equal(snapshot.queueEntries.get('waiting')?.userName, undefined);
  assert.equal(snapshot.queueEntries.get('waiting')?.priority, 2);
  assert.equal(store.queueEntries.size, 0);
  assert.equal(store.services.size, 0);
  await loadServiceCatalog(store, repository, database);
  assert.equal(queries, 2, 'Each request must load fresh SQL data');
});
