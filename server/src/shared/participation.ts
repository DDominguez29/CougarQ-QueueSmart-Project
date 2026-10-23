import type { QueueEntry } from './models.ts';

export function completionTime(entry: QueueEntry): string | null {
  return entry.status === 'served' ? entry.completedAt ?? entry.endedAt : entry.endedAt;
}

export function queueWaitMinutes(entry: QueueEntry): number | null {
  if (entry.status !== 'served' || !entry.serviceStartedAt) return null;
  const joined = Date.parse(entry.joinedAt);
  const started = Date.parse(entry.serviceStartedAt);
  const completed = Date.parse(completionTime(entry) ?? '');
  if (!Number.isFinite(joined) || !Number.isFinite(started) || !Number.isFinite(completed) || started < joined || completed < started) return null;
  return (started - joined) / 60_000;
}
