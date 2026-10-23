import { ApiError } from '../../shared/ApiError.ts';
import { validateId } from '../../shared/validation.ts';

export const STORE_TIME_ZONE = 'America/Chicago';

export function storeDate(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: STORE_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(value);
  const get = (type: string) => parts.find((part) => part.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function validateDate(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '2000-01-01' || value > '2100-12-31') {
    throw new ApiError(400, 'INVALID_INPUT', `${field} must be a date in YYYY-MM-DD format between 2000 and 2100.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new ApiError(400, 'INVALID_INPUT', `${field} must be a valid calendar date.`);
  }
  return value;
}

export function validateReportQuery(query: Record<string, unknown>, now = new Date()) {
  if (Object.keys(query).some((key) => !['startDate', 'endDate', 'serviceId', 'page'].includes(key))) {
    throw new ApiError(400, 'INVALID_INPUT', 'Only startDate, endDate, serviceId, and page filters are accepted.');
  }
  const today = storeDate(now);
  const startDate = validateDate(query.startDate === undefined ? today : query.startDate, 'startDate');
  const endDate = validateDate(query.endDate === undefined ? today : query.endDate, 'endDate');
  const span = (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000;
  if (span < 0 || span > 30) {
    throw new ApiError(400, 'INVALID_INPUT', 'Select a date range of 1-31 days, with the start date on or before the end date.');
  }
  const pageValue = query.page === undefined ? '1' : query.page;
  if (typeof pageValue !== 'string' || !/^[1-9]\d{0,5}$/.test(pageValue)) {
    throw new ApiError(400, 'INVALID_INPUT', 'page must be an integer between 1 and 999999.');
  }
  return { startDate, endDate, serviceId: query.serviceId === undefined ? null : validateId(query.serviceId, 'serviceId'), page: Number(pageValue) };
}
