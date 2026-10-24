import type { Session, User } from '../modules/auth/auth.models.ts';
import { createNotificationStore } from '../modules/notifications/notifications.service.ts';
import type { QueueEntry, Service } from '../shared/models.ts';

export function createStore() {
  return {
    services: new Map<string, Service>(),
    // Keep terminal entries so history can read the same participation records.
    queueEntries: new Map<string, QueueEntry>(),
    users: new Map<string, User>(),
    sessions: new Map<string, Session>(),
    notifications: createNotificationStore(),
  };
}

export type Store = ReturnType<typeof createStore>;
