import { Link } from 'react-router-dom';
import type { HistoryItem } from '../../../server/src/shared/models';
import { displayDate, displayMinutes } from '../../api/display';
import { useApiResource } from '../../hooks/useApiResource';
import './UserDashboardPage.css';
import './HistoryPage.css';

function HistoryPage() {
  const { data, error, loading, refresh } = useApiResource<HistoryItem[]>('/api/history/me');
  return (
    <div className="user-dashboard history-page">
      <header className="user-header">
        <div className="user-header__content">
          <div className="user-brand">
            <img className="user-brand__logo" src="/logos/uh-logo.png" alt="University of Houston logo" />
            <div>
              <p className="user-brand__name">CougarQ</p>
              <p className="user-brand__subtitle">University of Houston Campus Store/Bookstore</p>
            </div>
          </div>
          <nav className="user-nav" aria-label="User navigation">
            <Link className="user-nav__link" to="/dashboard">Dashboard</Link>
            <Link className="user-nav__link" to="/join-queue">Join Queue</Link>
            <Link className="user-nav__link" to="/history" aria-current="page">History</Link>
          </nav>
        </div>
      </header>
      <main className="user-main">
        <section className="user-panel" aria-labelledby="history-title">
          <div className="user-panel__header history-heading">
            <div>
              <p className="user-panel__eyebrow">Previous visits</p>
              <h1 id="history-title">Queue History</h1>
              <p className="user-panel__note">Review your served visits and queues you left, most recent first. Times use Houston local time.</p>
            </div>
            <button className="history-refresh" type="button" onClick={refresh} disabled={loading}>
              {loading ? 'Loading…' : 'Refresh history'}
            </button>
          </div>
          {loading && <p role="status">Loading your queue history…</p>}
          {error && <p className="history-error" role="alert">{error.message} {error.status === 401 && <Link to="/login">Sign in</Link>}</p>}
          {!loading && data?.length === 0 && (
            <div className="history-empty">
              <h2>No previous visits yet</h2>
              <p>Your history will appear here after you are served or leave a queue.</p>
              <Link className="user-primary-button" to="/join-queue">Find a queue</Link>
            </div>
          )}
          {data && data.length > 0 && (
            <div className="history-table-wrap">
              <table className="history-table">
                <caption>{data.length} previous {data.length === 1 ? 'visit' : 'visits'}</caption>
                <thead><tr><th scope="col">Service</th><th scope="col">Joined</th><th scope="col">Service started</th><th scope="col">Finished</th><th scope="col">Queue wait</th><th scope="col">Outcome</th></tr></thead>
                <tbody>
                  {data.map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.serviceName}</td>
                      <td><time dateTime={entry.joinedAt}>{displayDate(entry.joinedAt)}</time></td>
                      <td>{displayDate(entry.serviceStartedAt ?? null)}</td>
                      <td>{displayDate(entry.completedAt ?? entry.endedAt)}</td>
                      <td>{displayMinutes(entry.waitMinutes)}</td>
                      <td><span className={`history-outcome history-outcome--${entry.status}`}>{entry.status === 'served' ? 'Served' : 'Left queue'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default HistoryPage;
