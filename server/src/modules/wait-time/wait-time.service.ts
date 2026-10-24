import type { Store } from '../../data/store.ts';
import { ApiError } from '../../shared/ApiError.ts';
import type { QueueEntry, QueueStatus } from '../../shared/models.ts';

export const ALMOST_READY_AHEAD = 2;

export type WaitStage = 'waiting' | 'almost-ready' | Exclude<QueueStatus, 'queued'>;

// Sum of the service minutes for everyone ahead, rounded up.
export function estimateWaitMinutes(durationsAhead: number[]) {
  let total = 0;
  for (const minutes of durationsAhead) {
    if (!Number.isFinite(minutes) || minutes <= 0) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Expected duration must be a positive number of minutes.');
    }
    total += minutes;
  }
  return Math.ceil(total);
}

export function compareQueueEntries(a: QueueEntry, b: QueueEntry) {
  if (a.priority !== b.priority) return b.priority - a.priority;
  return Date.parse(a.joinedAt) - Date.parse(b.joinedAt);
}

export function getWaitingLine(store: Store, serviceId: string) {
  return [...store.queueEntries.values()]
    .filter((entry) => entry.serviceId === serviceId && entry.status === 'queued')
    .sort(compareQueueEntries);
}

function getService(store: Store, serviceId: string) {
  const service = store.services.get(serviceId);
  if (!service) throw new ApiError(404, 'SERVICE_NOT_FOUND', 'Service not found.');
  return service;
}

export function estimateForNewEntry(store: Store, serviceId: string) {
  const service = getService(store, serviceId);
  const line = getWaitingLine(store, serviceId);
  return {
    serviceId,
    peopleAhead: line.length,
    estimatedWaitMinutes: estimateWaitMinutes(line.map(() => service.expectedDurationMinutes)),
    serviceMinutes: service.expectedDurationMinutes,
  };
}

export function estimateForEntry(store: Store, entryId: string) {
  const entry = store.queueEntries.get(entryId);
  if (!entry) throw new ApiError(404, 'ENTRY_NOT_FOUND', 'Queue entry not found.');

  if (entry.status !== 'queued') {
    return {
      entryId,
      serviceId: entry.serviceId,
      stage: entry.status as WaitStage,
      position: null,
      peopleAhead: 0,
      estimatedWaitMinutes: 0,
    };
  }

  const service = getService(store, entry.serviceId);
  const line = getWaitingLine(store, entry.serviceId);
  const ahead = line.slice(0, line.findIndex((item) => item.id === entry.id));
  const stage: WaitStage = ahead.length <= ALMOST_READY_AHEAD ? 'almost-ready' : 'waiting';

  return {
    entryId,
    serviceId: entry.serviceId,
    stage,
    position: ahead.length + 1,
    peopleAhead: ahead.length,
    estimatedWaitMinutes: estimateWaitMinutes(ahead.map(() => service.expectedDurationMinutes)),
  };
}
