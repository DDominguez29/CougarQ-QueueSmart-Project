import { randomUUID } from 'node:crypto';

export class NotificationError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
function text(value, name, max = 128) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new NotificationError(`${name} must be a nonempty string of at most ${max} characters.`);
  }
  return value.trim();
}
function entry(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new NotificationError('Queue entry is required.');
  }
  return {
    userId: text(value.userId, 'userId'),
    queueEntryId: text(value.queueEntryId, 'queueEntryId'),
    serviceName: text(value.serviceName, 'serviceName', 100),
  };
}

export function createNotificationStore() {
  const notifications = new Map();
  // Keep event keys after dismissal so queue updates do not recreate deleted alerts.
  const emitted = new Set();
  function emit(item, type, message) {
    const key = JSON.stringify([item.userId, item.queueEntryId, type]);
    if (emitted.has(key)) return null;
    const notification = {
      id: randomUUID(), ...item, type, message,
      createdAt: new Date().toISOString(),
    };
    notifications.set(notification.id, notification);
    emitted.add(key);
    return { ...notification };
  }
  return {
    notifyJoined(value) {
      const item = entry(value);
      return emit(item, 'joined', `You joined the ${item.serviceName} queue.`);
    },
    // Input MUST be the final ordered waiting list for ONE service, after mutation.
    // Exclude the person already being served. Priority sorting belongs to queue code.
    notifyQueueChanged(waitingEntries) {
      if (!Array.isArray(waitingEntries)) throw new NotificationError('Waiting entries must be an array.');
      const entries = waitingEntries.map(entry); // Validate everything before emitting.
      const ids = new Set(entries.map(item => item.queueEntryId));
      if (ids.size !== entries.length) throw new NotificationError('Duplicate queue entry IDs.');
      return entries.slice(0, 2).map((item, index) => emit(item, 'near_turn',
        index === 0 ? `You are next for ${item.serviceName}. Please be ready.`
          : `There is one person ahead of you for ${item.serviceName}. Please be ready.`
      )).filter(Boolean);
    },
    list(userId) {
      const owner = text(userId, 'userId');
      return [...notifications.values()].filter(item => item.userId === owner)
        .reverse().map(item => ({ ...item }));
    },
    remove(userId, id) {
      const owner = text(userId, 'userId');
      const key = text(id, 'notificationId');
      const item = notifications.get(key);
      if (!item || item.userId !== owner) throw new NotificationError('Notification not found.', 404);
      notifications.delete(key);
    },
  };
}

// Import this SAME instance in both queue handlers and notification routes.
export const notificationStore = createNotificationStore();
