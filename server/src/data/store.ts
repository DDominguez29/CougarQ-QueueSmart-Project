import type { QueueEntry, Service } from '../shared/models.ts';

export function createStore() {
  return {
    services: new Map<string, Service>(),
    // Keep terminal entries so history can read the same participation records.
    queueEntries: new Map<string, QueueEntry>(),
  };
}

export type Store = ReturnType<typeof createStore>;
