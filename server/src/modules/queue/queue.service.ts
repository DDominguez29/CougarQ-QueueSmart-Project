import { randomUUID } from 'node:crypto';

import type { Store } from '../../data/store.ts';
import { requireAdministrator, requireIdentity } from '../../middleware/identity.ts';
import { ApiError } from '../../shared/ApiError.ts';
import type {
  CompleteServiceResult,
  Identity,
  QueueEntry,
  QueueOverview,
  QueueView,
  Service,
  ServeNextResult,
} from '../../shared/models.ts';
import { validateId } from '../../shared/validation.ts';

function findService(store: Store, serviceId: unknown): Service {
  const id = validateId(serviceId, 'serviceId');
  const service = store.services.get(id);

  if (!service) {
    throw new ApiError(404, 'SERVICE_NOT_FOUND', 'Service not found.');
  }

  return service;
}

function queueForService(store: Store, service: Service): QueueView {
  const entries = [...store.queueEntries.values()]
    .filter(
      (entry) =>
        entry.serviceId === service.id &&
        entry.status === 'queued',
    )
    .sort(
      (first, second) =>
        second.priority - first.priority ||
        Date.parse(first.joinedAt) -
          Date.parse(second.joinedAt),
    )
    .map((entry, index) => ({
      ...entry,
      position: index + 1,
    }));

  return {
    service: {
      id: service.id,
      name: service.name,
    },
    entries,
    waitingCount: entries.length,
    nextEntryId: entries[0]?.id ?? null,
    inService: [...store.queueEntries.values()]
      .filter(
        (entry) =>
          entry.serviceId === service.id &&
          entry.status === 'serving',
      )
      .sort(
        (first, second) =>
          Date.parse(
            first.serviceStartedAt ?? first.joinedAt,
          ) -
          Date.parse(
            second.serviceStartedAt ?? second.joinedAt,
          ),
      )
      .map((entry) => ({ ...entry })),
  };
}

export function listQueues(
  store: Store,
  identity: Identity | undefined,
  serviceId?: unknown,
): QueueOverview {
  requireAdministrator(identity);

  const services =
    serviceId === undefined
      ? [...store.services.values()]
      : [findService(store, serviceId)];

  const queues = services.map((service) =>
    queueForService(store, service),
  );

  return {
    queues,
    totalWaiting: queues.reduce(
      (count, queue) => count + queue.waitingCount,
      0,
    ),
  };
}

export function getQueue(
  store: Store,
  identity: Identity | undefined,
  serviceId: unknown,
): QueueView {
  requireAdministrator(identity);

  return queueForService(
    store,
    findService(store, serviceId),
  );
}

export function serveNext(
  store: Store,
  identity: Identity | undefined,
  serviceId: unknown,
  expectedEntryId: unknown,
  now = new Date(),
): ServeNextResult {
  requireAdministrator(identity);

  const expected = validateId(
    expectedEntryId,
    'expectedEntryId',
  );

  const service = findService(store, serviceId);
  const queue = queueForService(store, service);

  if (!queue.nextEntryId) {
    throw new ApiError(
      409,
      'QUEUE_EMPTY',
      'There are no users waiting for this service.',
    );
  }

  if (queue.nextEntryId !== expected) {
    throw new ApiError(
      409,
      'QUEUE_CHANGED',
      'The queue has changed. Refresh it before serving the next user.',
    );
  }

  // There is no await between selection and update: one request claims this entry.
  const entry = store.queueEntries.get(
    queue.nextEntryId,
  )!;

  validateTransitionTime(entry.joinedAt, now);

  const started: QueueEntry = {
    ...entry,
    serviceName: entry.serviceName ?? service.name,
    status: 'serving',
    serviceStartedAt: now.toISOString(),
    completedAt: null,
    endedAt: null,
  };

  store.queueEntries.set(started.id, started);

  return {
    started: { ...started },
    queue: queueForService(store, service),
  };
}

function validateTransitionTime(
  previous: string | null | undefined,
  now: Date,
) {
  const prior = Date.parse(previous ?? '');

  if (
    !Number.isFinite(prior) ||
    !Number.isFinite(now.getTime()) ||
    now.getTime() < prior
  ) {
    throw new ApiError(
      409,
      'INVALID_QUEUE_TIMES',
      'The visit timestamps are invalid. Refresh the queue and check the server clock.',
    );
  }
}

export function completeService(
  store: Store,
  identity: Identity | undefined,
  entryId: unknown,
  now = new Date(),
): CompleteServiceResult {
  requireAdministrator(identity);

  const id = validateId(entryId, 'entryId');
  const entry = store.queueEntries.get(id);

  if (!entry) {
    throw new ApiError(
      404,
      'ENTRY_NOT_FOUND',
      'Queue entry not found.',
    );
  }

  if (entry.status !== 'serving') {
    throw new ApiError(
      409,
      'NOT_IN_SERVICE',
      'Only a visit currently in service can be completed.',
    );
  }

  const service = findService(store, entry.serviceId);

  validateTransitionTime(
    entry.joinedAt,
    new Date(entry.serviceStartedAt ?? ''),
  );
  validateTransitionTime(entry.serviceStartedAt, now);

  const completed: QueueEntry = {
    ...entry,
    status: 'served',
    completedAt: now.toISOString(),
    endedAt: now.toISOString(),
    serviceName: entry.serviceName ?? service.name,
  };

  store.queueEntries.set(id, completed);

  return {
    completed: { ...completed },
    queue: queueForService(store, service),
  };
}

export function joinQueue(
  store: Store,
  identity: Identity | undefined,
  serviceId: unknown,
  now = new Date(),
) {
  const actor = requireIdentity(identity);
  const service = findService(store, serviceId);

  const existingEntry = [
    ...store.queueEntries.values(),
  ].find(
    (entry) =>
      entry.userId === actor.userId &&
      (entry.status === 'queued' ||
        entry.status === 'serving'),
  );

  if (existingEntry) {
    throw new ApiError(
      409,
      'ALREADY_IN_QUEUE',
      'You already have an active queue entry.',
    );
  }

  if (!Number.isFinite(now.getTime())) {
    throw new ApiError(
      409,
      'INVALID_QUEUE_TIMES',
      'The visit timestamp is invalid.',
    );
  }

  const entry: QueueEntry = {
    id: randomUUID(),
    userId: actor.userId,
    serviceId: service.id,
    priority: service.priority,
    joinedAt: now.toISOString(),
    status: 'queued',
    endedAt: null,
    serviceName: service.name,
    serviceStartedAt: null,
    completedAt: null,
  };

  store.queueEntries.set(entry.id, entry);

  const queue = queueForService(store, service);
  const positionedEntry = queue.entries.find(
    (currentEntry) => currentEntry.id === entry.id,
  );

  return {
    entry: { ...entry },
    service: {
      id: service.id,
      name: service.name,
      expectedDurationMinutes:
        service.expectedDurationMinutes,
    },
    position: positionedEntry?.position ?? null,
    waitingCount: queue.waitingCount,
  };
}

export function getMyActiveQueue(
  store: Store,
  identity: Identity | undefined,
) {
  const actor = requireIdentity(identity);

  const entry = [...store.queueEntries.values()]
    .filter(
      (currentEntry) =>
        currentEntry.userId === actor.userId &&
        (currentEntry.status === 'queued' ||
          currentEntry.status === 'serving'),
    )
    .sort(
      (first, second) =>
        Date.parse(second.joinedAt) -
        Date.parse(first.joinedAt),
    )[0];

  if (!entry) {
    return null;
  }

  const service = findService(store, entry.serviceId);
  const queue = queueForService(store, service);
  const positionedEntry = queue.entries.find(
    (currentEntry) => currentEntry.id === entry.id,
  );

  return {
    entry: { ...entry },
    service: {
      id: service.id,
      name: service.name,
      expectedDurationMinutes:
        service.expectedDurationMinutes,
    },
    position:
      entry.status === 'queued'
        ? positionedEntry?.position ?? null
        : null,
    waitingCount: queue.waitingCount,
  };
}

export function leaveQueue(
  store: Store,
  identity: Identity | undefined,
  entryId: unknown,
  now = new Date(),
) {
  const actor = requireIdentity(identity);
  const id = validateId(entryId, 'entryId');
  const entry = store.queueEntries.get(id);

  if (!entry) {
    throw new ApiError(
      404,
      'ENTRY_NOT_FOUND',
      'Queue entry not found.',
    );
  }

  if (entry.userId !== actor.userId) {
    throw new ApiError(
      403,
      'FORBIDDEN',
      'You cannot modify another user\'s queue entry.',
    );
  }

  if (entry.status !== 'queued') {
    throw new ApiError(
      409,
      'CANNOT_LEAVE_QUEUE',
      'Only a queued visit can be left.',
    );
  }

  if (!Number.isFinite(now.getTime())) {
    throw new ApiError(
      409,
      'INVALID_QUEUE_TIMES',
      'The visit timestamp is invalid.',
    );
  }

  validateTransitionTime(entry.joinedAt, now);

  const service = findService(store, entry.serviceId);

  const leftEntry: QueueEntry = {
    ...entry,
    status: 'left',
    endedAt: now.toISOString(),
    serviceName: entry.serviceName ?? service.name,
  };

  store.queueEntries.set(id, leftEntry);

  return {
    entry: { ...leftEntry },
  };
}
