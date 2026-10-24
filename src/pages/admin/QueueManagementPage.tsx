import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { QueueOverview, QueueView } from '../../../server/src/shared/models';
import { requestError } from '../../api/client';
import { displayDate, elapsedMinutes } from '../../api/display';
import { completeQueueEntry, serveNextUser } from '../../api/queue';
import AdminHeader from './AdminHeader';
import { useApiResource } from '../../hooks/useApiResource';
import './AdminDashboardPage.css';
import './QueueManagementPage.css';

function QueueManagementPage() {
  const { data, error, loading, refresh, update } = useApiResource<QueueOverview>('/api/admin/queue');
  const [selectedService, setSelectedService] = useState('');
  const [servingService, setServingService] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const serving = useRef(false);
  const visibleQueues = data?.queues.filter((queue) => !selectedService || queue.service.id === selectedService) ?? [];

  async function handleServe(queue: QueueView, entryId?: string) {
    if ((!queue.nextEntryId && !entryId) || serving.current) return;
    serving.current = true;
    setServingService(entryId ? `complete:${entryId}` : `start:${queue.service.id}`);
    setActionError('');
    setNotice('');
    try {
      const result = entryId ? await completeQueueEntry(entryId) : await serveNextUser(queue.service.id, queue.nextEntryId!);
      update((current) => {
        const queues = current.queues.map((item) => item.service.id === result.queue.service.id ? result.queue : item);
        return { queues, totalWaiting: queues.reduce((count, item) => count + item.waitingCount, 0) };
      });
      setNotice('started' in result
        ? `Service started for ${result.started.userName ?? result.started.userId}. Complete the visit when finished.`
        : `Visit completed for ${result.completed.userName ?? result.completed.userId}. It is now included in reports and history.`);
    } catch (failure) {
      const issue = requestError(failure);
      setActionError(issue.message);
      // Refresh after a conflict or lost response; never automatically retry a mutation.
      refresh();
    } finally {
      serving.current = false;
      setServingService(null);
    }
  }

  function handleRefresh() {
    setNotice('');
    setActionError('');
    refresh();
  }

  return (
    <div className="admin-dashboard queue-page">
      <AdminHeader />

      <main className="admin-main queue-main">
        <section className="queue-command admin-panel" aria-labelledby="queue-title">
          <div className="admin-panel__header queue-command__header">
            <div>
              <p className="admin-panel__eyebrow">Bookstore Operations</p>
              <h1 id="queue-title">Queue Management</h1>
              <p className="admin-panel__note">Start the next user in priority and arrival order, then complete their visit when service finishes. Times use Houston local time.</p>
            </div>
            <button className="queue-tool" type="button" onClick={handleRefresh} disabled={loading || servingService !== null}>
              {loading ? 'Loading…' : 'Refresh queues'}
            </button>
          </div>
          <div className="queue-metrics">
            <article className="queue-metric">
              <p className="queue-metric__label">Users waiting</p>
              <p className="queue-metric__value">{data?.totalWaiting ?? '—'}</p>
            </article>
            <article className="queue-metric">
              <p className="queue-metric__label">Services</p>
              <p className="queue-metric__value">{data?.queues.length ?? '—'}</p>
            </article>
            <article className="queue-metric">
              <p className="queue-metric__label">Users in service</p>
              <p className="queue-metric__value">{data ? data.queues.reduce((count, queue) => count + queue.inService.length, 0) : '—'}</p>
            </article>
          </div>
        </section>

        <div aria-live="polite">
          {loading && <p className="queue-feedback" role="status">Loading current queues…</p>}
          {notice && <p className="queue-feedback queue-feedback--success" role="status">{notice}</p>}
        </div>
        {actionError && <p className="queue-feedback queue-feedback--error" role="alert">{actionError}</p>}
        {error && (
          <p className="queue-feedback queue-feedback--error" role="alert">
            {error.message} {error.status === 401 && <Link to="/login">Sign in</Link>}
          </p>
        )}

        {data && (
          <>
            <div className="queue-toolbar">
              <label htmlFor="queue-service">Service</label>
              <select id="queue-service" value={selectedService} onChange={(event) => setSelectedService(event.target.value)}>
                <option value="">All services</option>
                {data.queues.map((queue) => <option key={queue.service.id} value={queue.service.id}>{queue.service.name}</option>)}
              </select>
              <p>Higher priority first; arrival order breaks ties.</p>
            </div>
            {visibleQueues.length === 0 && <p className="queue-feedback">No services are available.</p>}
            {visibleQueues.map((queue) => (
              <section className="admin-panel queue-workspace" key={queue.service.id} aria-labelledby={`service-${queue.service.id}`}>
                <div className="admin-panel__header queue-list__header">
                  <div>
                    <p className="admin-panel__eyebrow">{queue.waitingCount} waiting</p>
                    <h2 id={`service-${queue.service.id}`}>{queue.service.name}</h2>
                  </div>
                  <button className="queue-tool queue-tool--primary" type="button"
                    onClick={() => void handleServe(queue)}
                    disabled={loading || servingService !== null || queue.nextEntryId === null}
                    aria-label={`Start next user for ${queue.service.name}`}>
                    {servingService === `start:${queue.service.id}` ? 'Starting…' : 'Start next user'}
                  </button>
                </div>
                {queue.inService.length > 0 && (
                  <div className="queue-in-service">
                    <h3>In service ({queue.inService.length})</h3>
                    <div className="queue-table-wrap"><table className="admin-table">
                      <caption className="queue-table-caption">Visits currently receiving service for {queue.service.name}</caption>
                      <thead><tr><th scope="col">Student</th><th scope="col">Service started</th><th scope="col">Action</th></tr></thead>
                      <tbody>{queue.inService.map((entry) => <tr key={entry.id}>
                        <td>{entry.userName ?? entry.userId}</td><td>{displayDate(entry.serviceStartedAt ?? null)}</td>
                        <td><button type="button" className="queue-action queue-action--ready" disabled={loading || servingService !== null}
                          aria-label={`Complete service for ${entry.userName ?? entry.userId}`} onClick={() => void handleServe(queue, entry.id)}>
                          {servingService === `complete:${entry.id}` ? 'Completing…' : 'Complete service'}
                        </button></td>
                      </tr>)}</tbody>
                    </table></div>
                  </div>
                )}
                {queue.entries.length === 0 ? <p className="queue-empty">No users are waiting for this service.</p> : (
                  <div className="queue-table-wrap">
                    <table className="admin-table queue-table queue-table--current">
                      <caption className="queue-table-caption">Waiting users for {queue.service.name}</caption>
                      <thead><tr><th scope="col">Position</th><th scope="col">Student</th><th scope="col">Priority</th><th scope="col">Joined</th><th scope="col">Time waiting</th><th scope="col">Status</th></tr></thead>
                      <tbody>
                        {queue.entries.map((entry) => (
                          <tr key={entry.id}>
                            <td className="queue-position">#{entry.position}</td>
                            <td><span className="queue-student__name">{entry.userName ?? entry.userId}</span></td>
                            <td><span className="queue-priority">{entry.priority}</span></td>
                            <td><time dateTime={entry.joinedAt}>{displayDate(entry.joinedAt)}</time></td>
                            <td className="queue-wait">{elapsedMinutes(entry.joinedAt)} min</td>
                            <td><span className="admin-badge">Waiting</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ))}
          </>
        )}
      </main>
    </div>
  );
}

export default QueueManagementPage;
