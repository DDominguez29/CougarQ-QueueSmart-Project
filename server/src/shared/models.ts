// Initial API contracts. Coordinate changes with the teammates consuming them.
export interface Service {
  id: string;
  name: string;
  description: string;
  expectedDurationMinutes: number;
  priority: number;
}

export type QueueStatus = 'queued' | 'served' | 'left';

export interface QueueEntry {
  id: string;
  userId: string;
  serviceId: string;
  priority: number;
  joinedAt: string;
  status: QueueStatus;
  endedAt: string | null;
}
