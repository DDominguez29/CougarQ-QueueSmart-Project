import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { AdminReport } from '../../../server/src/shared/models';
import { displayDate, displayMinutes, STORE_TIME_LABEL, todayAtStore } from '../../api/display';
import { useApiResource } from '../../hooks/useApiResource';
import AdminHeader from './AdminHeader';
import './AdminDashboardPage.css';
import './ReportsPage.css';

function ReportsPage() {
  const [draft, setDraft] = useState(() => ({ startDate: todayAtStore(), endDate: todayAtStore(), serviceId: '' }));
  const [filters, setFilters] = useState(draft);
  const [page, setPage] = useState(1);
  const query = new URLSearchParams({ startDate: filters.startDate, endDate: filters.endDate, page: String(page) });
  if (filters.serviceId) query.set('serviceId', filters.serviceId);
  const { data, error, loading, refresh } = useApiResource<AdminReport>(`/api/admin/reports?${query}`);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilters({ ...draft });
    setPage(1);
    refresh();
  }

  return (
    <div className="admin-dashboard reports-page">
      <AdminHeader />
      <main className="admin-main">
        <section className="admin-panel" aria-labelledby="reports-title">
          <div className="admin-panel__header reports-heading">
            <div>
              <p className="admin-panel__eyebrow">Store performance</p>
              <h1 id="reports-title">History &amp; Reports</h1>
              <p className="admin-panel__note">Completed visits and time spent waiting before service begins.</p>
            </div>
            <span className="admin-status">{STORE_TIME_LABEL}</span>
          </div>
          <form className="reports-filters" onSubmit={applyFilters}>
            <label>From<input type="date" value={draft.startDate} min="2000-01-01" max={draft.endDate || '2100-12-31'} required onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} /></label>
            <label>Through<input type="date" value={draft.endDate} min={draft.startDate || '2000-01-01'} max="2100-12-31" required onChange={(event) => setDraft({ ...draft, endDate: event.target.value })} /></label>
            <label>Service<select value={draft.serviceId} onChange={(event) => setDraft({ ...draft, serviceId: event.target.value })}>
              <option value="">All services</option>
              {draft.serviceId && !data?.services.some((service) => service.id === draft.serviceId) && <option value={draft.serviceId}>{draft.serviceId}</option>}
              {data?.services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
            </select></label>
            <button type="submit" className="reports-button reports-button--primary" disabled={loading}>{loading ? 'Loading…' : 'Apply filters'}</button>
            <p>Select up to 31 days. Dates and times use Houston local time.</p>
          </form>
        </section>

        {loading && <p className="reports-feedback" role="status">Loading report…</p>}
        {error && <p className="reports-feedback reports-feedback--error" role="alert">{error.message} {error.status === 401 && <Link to="/login">Sign in</Link>}</p>}

        {!loading && data && (
          <>
            <p className="reports-range">{data.startDate} through {data.endDate} · {data.serviceId ? data.services.find((service) => service.id === data.serviceId)?.name : 'All services'}</p>
            <section className="reports-metrics" aria-label="Performance summary">
              <article className="admin-panel reports-metric"><p>Served visits</p><strong>{data.summary.servedVisits}</strong><span>Completed during the selected dates</span></article>
              <article className="admin-panel reports-metric"><p>Average queue wait</p><strong>{displayMinutes(data.summary.averageWaitMinutes)}</strong><span>Join to service start, for completed visits</span></article>
              <article className="admin-panel reports-metric"><p>Unique people served</p><strong>{data.summary.uniquePeopleServed}</strong><span>Repeat visits count once here</span></article>
            </section>
            <p className="reports-timing-note">Wait recorded for {data.summary.measuredWaitVisits} of {data.summary.servedVisits} served visits. Visits without valid start timestamps are excluded from the average. People who left are also excluded.</p>

            <section className="admin-panel reports-section" aria-labelledby="daily-title">
              <div className="admin-panel__header"><h2 id="daily-title">Daily summary</h2><span>{data.summary.leftVisits} left without service</span></div>
              <div className="reports-table-wrap"><table className="admin-table reports-table">
                <caption>Visits grouped by the day they finished in Houston</caption>
                <thead><tr><th scope="col">Date</th><th scope="col">Served visits</th><th scope="col">Average queue wait</th><th scope="col">Left queue</th></tr></thead>
                <tbody>{data.days.map((day) => <tr key={day.date}><td><time dateTime={day.date}>{day.date}</time></td><td>{day.servedVisits}</td><td>{displayMinutes(day.averageWaitMinutes)}{day.missingWaitVisits > 0 && <span className="reports-muted"> ({day.measuredWaitVisits}/{day.servedVisits} timed)</span>}</td><td>{day.leftVisits}</td></tr>)}</tbody>
              </table></div>
            </section>

            <section className="admin-panel reports-section" aria-labelledby="visits-title">
              <div className="admin-panel__header"><h2 id="visits-title">Visit history</h2><span>{data.totalVisits} finished visits</span></div>
              {data.totalVisits === 0 ? <div className="reports-empty"><h3>No finished visits for these filters</h3><p>Completed visits and people who left will appear here.</p></div> : (
                <>
                  <div className="reports-table-wrap"><table className="admin-table reports-table reports-visits-table">
                    <caption>Most recent first. All timestamps use {STORE_TIME_LABEL}.</caption>
                    <thead><tr><th scope="col">Student</th><th scope="col">Service</th><th scope="col">Joined</th><th scope="col">Service started</th><th scope="col">Finished</th><th scope="col">Queue wait</th><th scope="col">Outcome</th></tr></thead>
                    <tbody>{data.visits.map((entry) => <tr key={entry.id}>
                      <td>{entry.userName ?? entry.userId}</td><td>{entry.serviceName}</td>
                      <td>{displayDate(entry.joinedAt, data.timeZone)}</td><td>{displayDate(entry.serviceStartedAt ?? null, data.timeZone)}</td>
                      <td>{displayDate(entry.completedAt ?? entry.endedAt, data.timeZone)}</td><td>{displayMinutes(entry.waitMinutes)}</td>
                      <td><span className={`admin-badge${entry.status === 'served' ? ' admin-badge--success' : ''}`}>{entry.status === 'served' ? 'Served' : 'Left queue'}</span></td>
                    </tr>)}</tbody>
                  </table></div>
                  <nav className="reports-pagination" aria-label="Visit history pages">
                    <button className="reports-button" type="button" disabled={data.page === 1} onClick={() => setPage(data.page - 1)}>Previous</button>
                    <span>Page {data.page} of {data.totalPages}</span>
                    <button className="reports-button" type="button" disabled={data.page === data.totalPages} onClick={() => setPage(data.page + 1)}>Next</button>
                  </nav>
                </>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default ReportsPage;
