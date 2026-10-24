import { randomUUID } from 'node:crypto';
import type { Store } from '../../data/store.ts';
import { requireIdentity } from '../../middleware/identity.ts';
import { ApiError } from '../../shared/ApiError.ts';
import type { Identity, QueueEntry, UserQueue } from '../../shared/models.ts';
import { validateId } from '../../shared/validation.ts';
import { notifyQueueChanged, notifyQueueJoined } from '../notifications/notifications.service.ts';
import { queueForService } from './queue.service.ts';

export function getUserQueue(store: Store, identity: Identity | undefined): UserQueue {
  const actor = requireIdentity(identity);
  const entry = [...store.queueEntries.values()].find((item) =>
    item.userId === actor.userId && (item.status === 'queued' || item.status === 'serving'));
  if (!entry) return { entry: null, position: null };
  const service = store.services.get(entry.serviceId);
  const position = service ? queueForService(store, service).entries.find((item) => item.id === entry.id)?.position : undefined;
  return { entry: { ...entry }, position: position ?? null };
}

export function joinQueue(store: Store, identity: Identity | undefined, serviceId: unknown): QueueEntry {
  const actor = requireIdentity(identity);
  const id = validateId(serviceId, 'serviceId');
  const service = store.services.get(id);
  if (!service) throw new ApiError(404, 'SERVICE_NOT_FOUND', 'Service not found.');
  if (getUserQueue(store, actor).entry) {
    throw new ApiError(409, 'ALREADY_IN_QUEUE', 'You already have an active visit. View your queue or leave it before joining another.');
  }
  // No await between checking and inserting: repeat requests cannot create two visits.
  const entry: QueueEntry = {
    id: randomUUID(), userId: actor.userId, serviceId: service.id, serviceName: service.name,
    priority: service.priority, joinedAt: new Date().toISOString(), status: 'queued',
    endedAt: null, serviceStartedAt: null, completedAt: null,
  };
  store.queueEntries.set(entry.id, entry);
  notifyQueueJoined(store, entry);
  return { ...entry };
}

export function leaveQueue(store: Store, identity: Identity | undefined, entryId: unknown): QueueEntry {
  const actor = requireIdentity(identity);
  const id = validateId(entryId, 'entryId');
  const entry = store.queueEntries.get(id);
  if (!entry || entry.userId !== actor.userId) {
    throw new ApiError(404, 'ENTRY_NOT_FOUND', 'Queue entry not found.');
  }
  if (entry.status !== 'queued') {
    throw new ApiError(409, 'NOT_WAITING', 'Only a waiting visit can leave the queue.');
  }
  const left: QueueEntry = { ...entry, status: 'left', endedAt: new Date().toISOString() };
  store.queueEntries.set(id, left);
  notifyQueueChanged(store, entry.serviceId);
  return { ...left };
}
