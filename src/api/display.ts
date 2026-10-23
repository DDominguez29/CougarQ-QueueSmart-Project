export const STORE_TIME_ZONE = 'America/Chicago';
export const STORE_TIME_LABEL = 'Houston time (Central)';

export function displayDate(value: string | null, timeZone = STORE_TIME_ZONE) {
  if (!value || !Number.isFinite(Date.parse(value))) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(new Date(value));
}

export function displayMinutes(value: number | null | undefined) {
  return value == null ? '—' : `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)} min`;
}

export function todayAtStore() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: STORE_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function elapsedMinutes(joinedAt: string) {
  return Math.max(0, Math.floor((Date.now() - Date.parse(joinedAt)) / 60_000));
}
