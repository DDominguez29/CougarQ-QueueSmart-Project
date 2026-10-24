import { randomUUID } from 'node:crypto';
import type { Store } from '../../data/store.ts';
import { ApiError } from '../../shared/ApiError.ts';
import type { QueueEntry } from '../../shared/models.ts';
import { compareQueueEntries } from '../wait-time/wait-time.service.ts';
import type { NotificationEntry, NotificationItem } from './notifications.models.ts';

function text(value: unknown, name: string, max = 128): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new ApiError(400, 'INVALID_NOTIFICATION', `${name} must be a nonempty string of at most ${max} characters.`);
  }
  return value.trim();
}

function notificationEntry(value: unknown): NotificationEntry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, 'INVALID_NOTIFICATION', 'Queue entry is required.');
  }
  const entry = value as Record<string, unknown>;
  return {
    userId: text(entry.userId, 'userId'),
    queueEntryId: text(entry.queueEntryId, 'queueEntryId'),
    serviceName: text(entry.serviceName, 'serviceName', 100),
  };
}

// Each application store owns its notifications; there is no process-wide singleton.
export function createNotificationStore() {
  const notifications = new Map<string, NotificationItem>();
  // Keep event keys after dismissal so polling/queue updates cannot recreate alerts.
  const emitted = new Set<string>();

  function emit(entry: NotificationEntry, type: NotificationItem['type'], message: string): NotificationItem | null {
    const key = JSON.stringify([entry.userId, entry.queueEntryId, type]);
    if (emitted.has(key)) return null;
    const notification: NotificationItem = {
      id: randomUUID(), ...entry, type, message, createdAt: new Date().toISOString(),
    };
    notifications.set(notification.id, notification);
    emitted.add(key);
    return { ...notification };
  }

  return {
    notifyJoined(value: unknown) {
      const entry = notificationEntry(value);
      return emit(entry, 'joined', `You joined the ${entry.serviceName} queue.`);
    },
    // The caller supplies the final ordered waiting list for ONE service.
    notifyQueueChanged(waitingEntries: unknown): NotificationItem[] {
      if (!Array.isArray(waitingEntries)) {
        throw new ApiError(400, 'INVALID_NOTIFICATION', 'Waiting entries must be an array.');
      }
      const entries = waitingEntries.map(notificationEntry);
      if (new Set(entries.map((entry) => entry.queueEntryId)).size !== entries.length) {
        throw new ApiError(400, 'INVALID_NOTIFICATION', 'Duplicate queue entry IDs.');
      }
      return entries.slice(0, 2).map((entry, index) => emit(entry, 'near_turn',
        index === 0 ? `You are next for ${entry.serviceName}. Please be ready.`
          : `There is one person ahead of you for ${entry.serviceName}. Please be ready.`,
      )).filter((item): item is NotificationItem => item !== null);
    },
    list(userId: unknown): NotificationItem[] {
      const owner = text(userId, 'userId');
      return [...notifications.values()].filter((item) => item.userId === owner)
        .reverse().map((item) => ({ ...item }));
    },
    remove(userId: unknown, id: unknown) {
      const owner = text(userId, 'userId');
      const key = text(id, 'notificationId');
      const item = notifications.get(key);
      if (!item || item.userId !== owner) {
        throw new ApiError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.');
      }
      notifications.delete(key);
    },
  };
}

export function notifyQueueChanged(store: Store, serviceId: string) {
  const service = store.services.get(serviceId);
  if (!service) return;
  const waiting = [...store.queueEntries.values()]
    .filter((entry) => entry.serviceId === serviceId && entry.status === 'queued')
    .sort(compareQueueEntries)
    .map((entry) => ({ userId: entry.userId, queueEntryId: entry.id, serviceName: entry.serviceName ?? service.name }));
  store.notifications.notifyQueueChanged(waiting);
}

export function notifyQueueJoined(store: Store, entry: QueueEntry) {
  const serviceName = entry.serviceName ?? store.services.get(entry.serviceId)?.name;
  store.notifications.notifyJoined({ userId: entry.userId, queueEntryId: entry.id, serviceName });
  notifyQueueChanged(store, entry.serviceId);
}
