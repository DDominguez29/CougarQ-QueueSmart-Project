export interface ServiceWaitEstimate {
  serviceId: string;
  peopleAhead: number;
  estimatedWaitMinutes: number;
  serviceMinutes: number;
}

export interface EntryWaitEstimate {
  entryId: string;
  serviceId: string;
  stage: 'waiting' | 'almost-ready' | 'serving' | 'served' | 'left';
  position: number | null;
  peopleAhead: number;
  estimatedWaitMinutes: number;
}

export function formatWait(minutes: number) {
  if (minutes <= 0) return 'No wait';
  return `${minutes} min`;
}

export const STAGE_LABELS: Record<EntryWaitEstimate['stage'], string> = {
  waiting: 'Waiting',
  'almost-ready': 'Almost ready',
  serving: 'Being served',
  served: 'Served',
  left: 'Left queue',
};
