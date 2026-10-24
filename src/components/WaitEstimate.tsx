import { useApiResource } from '../hooks/useApiResource';
import { formatWait, STAGE_LABELS, type EntryWaitEstimate } from '../api/waitTime';

interface WaitEstimateProps {
  entryId: string;
  show: 'wait' | 'stage';
}

function WaitEstimate({ entryId, show }: WaitEstimateProps) {
  const { data } = useApiResource<EntryWaitEstimate>(
    `/api/wait-time/entries/${encodeURIComponent(entryId)}`,
    5000,
  );

  if (!data) return <>—</>;
  if (show === 'stage') return <>{STAGE_LABELS[data.stage]}</>;
  return <>{data.stage === 'serving' ? 'Now' : formatWait(data.estimatedWaitMinutes)}</>;
}

export default WaitEstimate;
