// Initial API contracts. Coordinate changes with the teammates consuming them.
export interface Service {
  id: string;
  name: string;
  description: string;
  expectedDurationMinutes: number;
  priority: number;
}

export type QueueStatus = 'queued' | 'serving' | 'served' | 'left';

export interface QueueEntry {
  id: string;
  userId: string;
  serviceId: string;
  priority: number;
  joinedAt: string;
  status: QueueStatus;
  endedAt: string | null;
  serviceName?: string;
  serviceStartedAt?: string | null;
  completedAt?: string | null;
}

export interface Identity {
  userId: string;
  role: 'user' | 'admin';
}

export interface QueueView {
  service: Pick<Service, 'id' | 'name'>;
  entries: (QueueEntry & { position: number })[];
  waitingCount: number;
  nextEntryId: string | null;
  inService: QueueEntry[];
}

export interface QueueOverview {
  queues: QueueView[];
  totalWaiting: number;
}

export interface ServeNextResult {
  started: QueueEntry;
  queue: QueueView;
}

export interface CompleteServiceResult {
  completed: QueueEntry;
  queue: QueueView;
}

export interface HistoryItem extends QueueEntry {
  serviceName: string;
  waitMinutes: number | null;
}

export interface ReportSummary {
  servedVisits: number;
  uniquePeopleServed: number;
  averageWaitMinutes: number | null;
  measuredWaitVisits: number;
  missingWaitVisits: number;
  leftVisits: number;
}

export interface DailyReport extends ReportSummary {
  date: string;
}

export interface AdminReport {
  timeZone: string;
  startDate: string;
  endDate: string;
  serviceId: string | null;
  summary: ReportSummary;
  days: DailyReport[];
  services: Pick<Service, 'id' | 'name'>[];
  visits: HistoryItem[];
  page: number;
  pageSize: number;
  totalVisits: number;
  totalPages: number;
}
