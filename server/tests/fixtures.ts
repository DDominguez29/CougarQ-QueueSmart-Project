import assert from 'node:assert/strict';
import { createStore } from '../src/data/store.ts';
import { ApiError } from '../src/shared/ApiError.ts';
import type { Identity, QueueEntry, Service } from '../src/shared/models.ts';

export const admin: Identity = { userId: 'admin-1', role: 'admin' };
export const student: Identity = { userId: 'student-1', role: 'user' };

export function makeEntry(overrides: Partial<QueueEntry> = {}): QueueEntry {
  return {
    id: 'entry-1', userId: student.userId, serviceId: 'ctap', priority: 0,
    joinedAt: '2026-10-22T10:00:00.000Z', status: 'queued', endedAt: null,
    ...overrides,
  };
}

export function makeStore(entries: QueueEntry[] = []) {
  const store = createStore();
  const services: Service[] = [
    { id: 'ctap', name: 'CTAP Pickup', description: 'Material pickup', expectedDurationMinutes: 5, priority: 0 },
    { id: 'support', name: 'Bookstore Support', description: 'General support', expectedDurationMinutes: 10, priority: 0 },
  ];
  for (const service of services) store.services.set(service.id, service);
  for (const entry of entries) store.queueEntries.set(entry.id, entry);
  return store;
}

export function expectApiError(action: () => unknown, status: number, code: string) {
  assert.throws(action, (error: unknown) => error instanceof ApiError && error.status === status && error.code === code);
}
