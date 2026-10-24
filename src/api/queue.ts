// Type-only imports share contracts without bundling backend code in the browser.
import type { CompleteServiceResult, QueueEntry, ServeNextResult } from '../../server/src/shared/models';
import { requestApi } from './client';

export function serveNextUser(serviceId: string, expectedEntryId: string) {
  return requestApi<ServeNextResult>(`/api/services/${encodeURIComponent(serviceId)}/queue/serve-next`, {
    method: 'POST',
    body: JSON.stringify({ expectedEntryId }),
  });
}

export function completeQueueEntry(entryId: string) {
  return requestApi<CompleteServiceResult>(`/api/queue/${encodeURIComponent(entryId)}/complete`, { method: 'POST' });
}

export function joinServiceQueue(serviceId: string) {
  return requestApi<QueueEntry>(`/api/services/${encodeURIComponent(serviceId)}/queue`, { method: 'POST' });
}

export function leaveServiceQueue(entryId: string) {
  return requestApi<QueueEntry>(`/api/queue/${encodeURIComponent(entryId)}`, { method: 'DELETE' });
}
