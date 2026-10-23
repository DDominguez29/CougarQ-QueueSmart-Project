import type { Store } from '../../data/store.ts';
import { requireIdentity } from '../../middleware/identity.ts';
import type { HistoryItem, Identity } from '../../shared/models.ts';
import { completionTime, queueWaitMinutes } from '../../shared/participation.ts';

export function getUserHistory(store: Store, identity: Identity | undefined): HistoryItem[] {
  const actor = requireIdentity(identity);
  return [...store.queueEntries.values()]
    .filter((entry) => entry.userId === actor.userId && (entry.status === 'served' || entry.status === 'left'))
    .sort((first, second) => Date.parse(completionTime(second) ?? second.joinedAt) - Date.parse(completionTime(first) ?? first.joinedAt))
    .map((entry) => ({
      ...entry,
      serviceName: entry.serviceName ?? store.services.get(entry.serviceId)?.name ?? 'Service no longer available',
      waitMinutes: queueWaitMinutes(entry),
    }));
}
