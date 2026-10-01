import { Link } from 'react-router-dom';

import {
  dashboardStats,
  queueActivity,
  serviceSummaries,
} from '../../design/queueSmartDesign';
import './AdminDashboardPage.css';

function getStatusClass(status: string) {
  if (status === 'High demand' || status === 'Expired') {
    return 'admin-badge admin-badge--warning';
  }

  if (status === 'Summoned' || status === 'Normal') {
    return 'admin-badge admin-badge--success';
  }

  return 'admin-badge admin-badge--danger';
}

function AdminDashboardPage() {
  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="admin-header__content">
          <div className="admin-brand">
            <img
              className="admin-brand__logo"
              src="/logos/uh-logo.png"
              alt="University of Houston logo"
            />
            <div>
              <p className="admin-brand__name">CougarQ Admin</p>
              <p className="admin-brand__subtitle">
                University of Houston Campus Store/Bookstore
              </p>
            </div>
          </div>

          <nav className="admin-nav" aria-label="Admin navigation">
            <Link className="admin-nav__link" to="/admin">
              Dashboard
            </Link>
            <Link className="admin-nav__link" to="/admin/services">
              Services
            </Link>
            <Link className="admin-nav__link" to="/admin/queue">
              Queue
            </Link>
          </nav>
        </div>
      </header>

      <main className="admin-main">
        <section className="admin-overview" aria-labelledby="dashboard-title">
          <div className="admin-panel">
            <div className="admin-panel__header">
              <div>
                <p className="admin-panel__eyebrow">Today</p>
                <h1 id="dashboard-title">Admin Dashboard</h1>
                <p className="admin-panel__note">
                  Track wait times, service demand, and queue activity during
                  CTAP pickup rushes.
                </p>
              </div>
              <span className="admin-status">Live queue view</span>
            </div>

            <div className="admin-stats">
              {dashboardStats.map((stat) => (
                <article className="admin-stat" key={stat.label}>
                  <p className="admin-stat__label">{stat.label}</p>
                  <p className="admin-stat__value">{stat.value}</p>
                  <p className="admin-stat__detail">{stat.detail}</p>
                </article>
              ))}
            </div>
          </div>

          <aside className="admin-panel" aria-labelledby="quick-actions-title">
            <div className="admin-panel__header">
              <div>
                <p className="admin-panel__eyebrow">Controls</p>
                <h2 id="quick-actions-title">Quick Actions</h2>
              </div>
            </div>
            <div className="admin-actions">
              <Link className="admin-action" to="/admin/queue">
                Manage active queue
                <span>Open</span>
              </Link>
              <Link className="admin-action" to="/admin/services">
                Update services
                <span>Edit</span>
              </Link>
              <Link className="admin-action" to="/admin/queue">
                Review expired students
                <span>Check</span>
              </Link>
            </div>
          </aside>
        </section>

        <section className="admin-grid">
          <div className="admin-panel">
            <div className="admin-panel__header">
              <div>
                <p className="admin-panel__eyebrow">Services</p>
                <h2>Service Demand</h2>
              </div>
            </div>

            <table className="admin-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Status</th>
                  <th>Waiting</th>
                  <th>Avg Wait</th>
                  <th>Staff</th>
                </tr>
              </thead>
              <tbody>
                {serviceSummaries.map((service) => (
                  <tr key={service.name}>
                    <td>{service.name}</td>
                    <td>
                      <span className={getStatusClass(service.status)}>
                        {service.status}
                      </span>
                    </td>
                    <td>{service.waiting}</td>
                    <td>{service.averageWait}</td>
                    <td>{service.staff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <aside className="admin-panel" aria-labelledby="activity-title">
            <div className="admin-panel__header">
              <div>
                <p className="admin-panel__eyebrow">Queue</p>
                <h2 id="activity-title">Recent Activity</h2>
              </div>
            </div>

            <div className="admin-activity">
              {queueActivity.map((activity) => (
                <article className="admin-activity__item" key={activity.name}>
                  <div className="admin-activity__top">
                    <span className="admin-activity__name">
                      {activity.name}
                    </span>
                    <span className={getStatusClass(activity.status)}>
                      {activity.status}
                    </span>
                  </div>
                  <p className="admin-activity__service">{activity.service}</p>
                  <p className="admin-activity__wait">
                    Waited {activity.waited}
                  </p>
                </article>
              ))}
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}

export default AdminDashboardPage;
