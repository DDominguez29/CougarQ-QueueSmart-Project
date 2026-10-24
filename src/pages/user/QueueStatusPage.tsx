import UserHeader from './UserHeader';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { UserQueue } from '../../../server/src/shared/models';
import { requestError, type ApiRequestError } from '../../api/client';
import { displayDate } from '../../api/display';
import { leaveServiceQueue } from '../../api/queue';
import { useApiResource } from '../../hooks/useApiResource';
import './QueueStatusPage.css';

function QueueStatusPage() {
  const { data, error, loading, refresh } = useApiResource<UserQueue>('/api/queue/me', 5000);
  const [actionError, setActionError] = useState<ApiRequestError | null>(null);
  const [leaving, setLeaving] = useState(false);
  const pending = useRef(false);
  const failure = actionError ?? error;
  const entry = error ? null : data?.entry;

  async function leave() {
    if (!entry || pending.current) return;
    pending.current = true;
    setLeaving(true);
    setActionError(null);
    try {
      await leaveServiceQueue(entry.id);
      refresh();
    } catch (err) {
      setActionError(requestError(err));
      refresh();
    } finally {
      pending.current = false;
      setLeaving(false);
    }
  }

  return (
    <div className="queue-status-page">
      <UserHeader />
      <main className="queue-status-main"><section className="queue-status-card">
        <h1>Queue Status</h1><p>Check your current place in line.</p>
        <p className="queue-status-eyebrow">CURRENT QUEUE</p>
        {failure && <p role="alert">{failure.message} {failure.status === 401 && <Link to="/login">Sign in</Link>}</p>}
        {loading && !data && <p role="status">Loading your queue…</p>}
        {!error && data && !entry && <><h2>No active visit</h2><p>Your finished visits are in <Link to="/history">History</Link>.</p><Link to="/join-queue">Find a queue</Link></>}
        {entry && <>
          <h2>{entry.serviceName ?? 'Bookstore service'}</h2>
          <div className="queue-position"><p>Your service queue position</p><span>{data?.position == null ? '—' : `#${data.position}`}</span></div>
          <div className="queue-status-info">
            <div><p>Status</p><strong>{entry.status === 'serving' ? 'Being served' : 'Waiting'}</strong></div>
            <div><p>Joined (Houston time)</p><strong>{displayDate(entry.joinedAt)}</strong></div>
          </div>
          <p className="queue-status-message">Updates appear automatically. <Link to="/notifications">View your notifications</Link>.</p>
          {entry.status === 'queued' && <button className="leave-queue-button" type="button" disabled={leaving || loading} onClick={() => void leave()}>
            {leaving ? 'Leaving…' : 'Leave Queue'}
          </button>}
          {entry.status === 'serving' && <p>Please follow the bookstore staff’s instructions while your visit is in service.</p>}
        </>}
      </section></main>
    </div>
  );
}

export default QueueStatusPage;
