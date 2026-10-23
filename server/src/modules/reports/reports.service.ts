import type { Store } from '../../data/store.ts';
import { requireAdministrator } from '../../middleware/identity.ts';
import { ApiError } from '../../shared/ApiError.ts';
import type { AdminReport, HistoryItem, Identity, ReportSummary } from '../../shared/models.ts';
import { completionTime, queueWaitMinutes } from '../../shared/participation.ts';
import { STORE_TIME_ZONE, storeDate, validateReportQuery } from './reports.validation.ts';

function summarize(visits: HistoryItem[]): ReportSummary {
  const served = visits.filter((entry) => entry.status === 'served');
  const waits = served.flatMap((entry) => entry.waitMinutes === null ? [] : [entry.waitMinutes]);
  return {
    servedVisits: served.length,
    uniquePeopleServed: new Set(served.map((entry) => entry.userId)).size,
    averageWaitMinutes: waits.length ? waits.reduce((total, wait) => total + wait, 0) / waits.length : null,
    measuredWaitVisits: waits.length,
    missingWaitVisits: served.length - waits.length,
    leftVisits: visits.filter((entry) => entry.status === 'left').length,
  };
}

export function getAdminReport(store: Store, identity: Identity | undefined, query: Record<string, unknown> = {}, now = new Date()): AdminReport {
  requireAdministrator(identity);
  const { startDate, endDate, serviceId, page: requestedPage } = validateReportQuery(query, now);
  const serviceOptions = new Map([...store.services.values()].map((service) => [service.id, { id: service.id, name: service.name }]));
  for (const entry of store.queueEntries.values()) {
    if (!serviceOptions.has(entry.serviceId)) serviceOptions.set(entry.serviceId, { id: entry.serviceId, name: entry.serviceName ?? 'Service no longer available' });
  }
  if (serviceId !== null && !serviceOptions.has(serviceId)) throw new ApiError(404, 'SERVICE_NOT_FOUND', 'Service not found.');

  const visits: HistoryItem[] = [];
  const dates = new Map<string, HistoryItem[]>();
  // Iterate date labels in UTC; timestamps themselves are assigned to Chicago dates.
  for (let date = Date.parse(`${startDate}T00:00:00Z`); date <= Date.parse(`${endDate}T00:00:00Z`); date += 86_400_000) {
    dates.set(new Date(date).toISOString().slice(0, 10), []);
  }
  for (const entry of store.queueEntries.values()) {
    if ((entry.status !== 'served' && entry.status !== 'left') || (serviceId !== null && entry.serviceId !== serviceId)) continue;
    const ended = completionTime(entry);
    if (!ended || !Number.isFinite(Date.parse(ended))) continue;
    const day = storeDate(new Date(ended));
    const dayVisits = dates.get(day);
    if (!dayVisits) continue;
    const visit: HistoryItem = {
      ...entry,
      serviceName: entry.serviceName ?? store.services.get(entry.serviceId)?.name ?? 'Service no longer available',
      waitMinutes: queueWaitMinutes(entry),
    };
    visits.push(visit);
    dayVisits.push(visit);
  }
  visits.sort((first, second) => Date.parse(completionTime(second)!) - Date.parse(completionTime(first)!));
  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(visits.length / pageSize));
  const page = Math.min(requestedPage, totalPages);
  return {
    timeZone: STORE_TIME_ZONE, startDate, endDate, serviceId,
    summary: summarize(visits),
    days: [...dates].map(([date, entries]) => ({ date, ...summarize(entries) })),
    services: [...serviceOptions.values()].sort((first, second) => first.name.localeCompare(second.name)),
    visits: visits.slice((page - 1) * pageSize, page * pageSize),
    page, pageSize, totalVisits: visits.length, totalPages,
  };
}
