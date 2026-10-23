// Type-only imports share contracts without bundling backend code in the browser.
import type { CompleteServiceResult, ServeNextResult } from '../../server/src/shared/models';
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
