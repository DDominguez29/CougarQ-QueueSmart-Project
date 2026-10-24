import { Link } from 'react-router-dom';
import type { AdminReport, QueueOverview } from '../../../server/src/shared/models';
import { displayDate, displayMinutes, STORE_TIME_LABEL } from '../../api/display';
import { useApiResource } from '../../hooks/useApiResource';
import AdminHeader from './AdminHeader';
import './AdminDashboardPage.css';
import './ReportsPage.css';

function AdminDashboardPage() {
  const queues = useApiResource<QueueOverview>('/api/admin/queue');
  const report = useApiResource<AdminReport>('/api/admin/reports');
  const error = report.error ?? queues.error;
  const loading = report.loading || queues.loading;
  const stats = [
    { label: 'Users waiting now', value: queues.data?.totalWaiting ?? '—', detail: 'Across all services' },
    { label: 'Served visits today', value: report.data?.summary.servedVisits ?? '—', detail: 'Completed visits' },
    { label: 'Unique people served', value: report.data?.summary.uniquePeopleServed ?? '—', detail: 'Repeat visits counted once' },
    { label: 'Average queue wait', value: displayMinutes(report.data?.summary.averageWaitMinutes), detail: 'Before service begins' },
  ];

  return (
    <div className="admin-dashboard">
      <AdminHeader />
      <main className="admin-main">
        <section className="admin-overview" aria-labelledby="dashboard-title">
          <div className="admin-panel">
            <div className="admin-panel__header reports-heading">
              <div>
                <p className="admin-panel__eyebrow">{report.data?.startDate ?? 'Today'} · {STORE_TIME_LABEL}</p>
                <h1 id="dashboard-title">Admin Dashboard</h1>
                <p className="admin-panel__note">Current queues and today's completed visits.</p>
              </div>
              <button className="reports-button" type="button" disabled={loading} onClick={() => { queues.refresh(); report.refresh(); }}>{loading ? 'Loading…' : 'Refresh'}</button>
            </div>
            <div className="admin-stats">
              {stats.map((stat) => <article className="admin-stat" key={stat.label}><p className="admin-stat__label">{stat.label}</p><p className="admin-stat__value">{stat.value}</p><p className="admin-stat__detail">{stat.detail}</p></article>)}
            </div>
          </div>
          <aside className="admin-panel" aria-labelledby="quick-actions-title">
            <div className="admin-panel__header"><h2 id="quick-actions-title">Quick Actions</h2></div>
            <div className="admin-actions">
              <Link className="admin-action" to="/admin/queue">Manage active queue<span>Open</span></Link>
              <Link className="admin-action" to="/admin/services">Update services<span>Edit</span></Link>
              <Link className="admin-action" to="/admin/reports">View history &amp; reports<span>Open</span></Link>
            </div>
          </aside>
        </section>
        {loading && <p className="reports-feedback" role="status">Loading current operations…</p>}
        {error && <p className="reports-feedback reports-feedback--error" role="alert">{error.message} {error.status === 401 && <Link to="/login">Sign in</Link>}</p>}
        {report.data && <p className="reports-timing-note">Average wait uses {report.data.summary.measuredWaitVisits} of {report.data.summary.servedVisits} completed visits with valid start timestamps. <Link to="/admin/reports">View daily reports and visit details</Link>.</p>}

        {queues.data && <section className="admin-panel reports-section" aria-labelledby="service-lines-title">
          <div className="admin-panel__header"><h2 id="service-lines-title">Current service lines</h2><Link to="/admin/queue">Manage queues</Link></div>
          {queues.data.queues.length === 0 ? <p className="reports-empty">No services are available.</p> : <div className="reports-table-wrap"><table className="admin-table reports-table">
            <caption>Current waiting and in-service visits</caption>
            <thead><tr><th scope="col">Service</th><th scope="col">Waiting</th><th scope="col">In service</th></tr></thead>
            <tbody>{queues.data.queues.map((queue) => <tr key={queue.service.id}><td>{queue.service.name}</td><td>{queue.waitingCount}</td><td>{queue.inService.length}</td></tr>)}</tbody>
          </table></div>}
        </section>}

        {report.data && <section className="admin-panel reports-section" aria-labelledby="recent-visits-title">
          <div className="admin-panel__header"><h2 id="recent-visits-title">Recent finished visits today</h2><Link to="/admin/reports">View all</Link></div>
          {report.data.visits.length === 0 ? <p className="reports-empty">No visits have finished today.</p> : <div className="reports-table-wrap"><table className="admin-table reports-table">
            <caption>Most recent visits, using Houston local time</caption>
            <thead><tr><th scope="col">Student</th><th scope="col">Service</th><th scope="col">Finished</th><th scope="col">Queue wait</th><th scope="col">Outcome</th></tr></thead>
            <tbody>{report.data.visits.slice(0, 5).map((entry) => <tr key={entry.id}><td>{entry.userName ?? entry.userId}</td><td>{entry.serviceName}</td><td>{displayDate(entry.completedAt ?? entry.endedAt, report.data!.timeZone)}</td><td>{displayMinutes(entry.waitMinutes)}</td><td>{entry.status === 'served' ? 'Served' : 'Left queue'}</td></tr>)}</tbody>
          </table></div>}
        </section>}
      </main>
    </div>
  );
}

export default AdminDashboardPage;
