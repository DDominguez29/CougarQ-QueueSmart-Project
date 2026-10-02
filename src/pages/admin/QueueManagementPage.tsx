import { Link } from 'react-router-dom';

import {
  activeQueue,
  ctapWindowPlan,
  floorSupportPlan,
  queueAttentionItems,
  queueRushMetrics,
  queueRushPlan,
} from '../../design/queueSmartDesign';
import './AdminDashboardPage.css';
import './QueueManagementPage.css';

function getStatusClass(status: string) {
  if (status === 'Summoned' || status === 'Ready') {
    return 'admin-badge admin-badge--success';
  }

  if (status === 'Expired' || status === 'Review') {
    return 'admin-badge admin-badge--danger';
  }

  if (status === 'Busy' || status === 'Long wait') {
    return 'admin-badge admin-badge--warning';
  }

  return 'admin-badge';
}

function getPriorityClass(priority: string) {
  if (priority === 'Ready now') {
    return 'queue-priority queue-priority--ready';
  }

  if (priority === 'Long wait') {
    return 'queue-priority queue-priority--watch';
  }

  if (priority === 'Needs review') {
    return 'queue-priority queue-priority--review';
  }

  return 'queue-priority';
}

function QueueManagementPage() {
  return (
    <div className="admin-dashboard queue-page">
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
            <Link className="admin-nav__link admin-nav__link--active" to="/admin/queue">
              Queue
            </Link>
          </nav>
        </div>
      </header>

      <main className="admin-main queue-main">
        <section className="queue-command" aria-labelledby="queue-title">
          <div className="admin-panel queue-command__primary">
            <div className="admin-panel__header queue-command__header">
              <div>
                <p className="admin-panel__eyebrow">Rush Operations</p>
                <h1 id="queue-title">Queue Management</h1>
                <p className="admin-panel__note">
                  Keep the bookstore line moving with quick summons, clear
                  exceptions, and counter visibility for CTAP pickup surges.
                </p>
              </div>
              <div className="queue-live">
                <span className="queue-live__dot" aria-hidden="true" />
                Live now
              </div>
            </div>

            <div className="queue-metrics">
              {queueRushMetrics.map((metric) => (
                <article className="queue-metric" key={metric.label}>
                  <p className="queue-metric__label">{metric.label}</p>
                  <p className="queue-metric__value">{metric.value}</p>
                  <p className="queue-metric__detail">{metric.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="queue-workspace" aria-label="Queue workspace">
          <div className="admin-panel queue-list" aria-labelledby="active-queue-title">
            <div className="admin-panel__header queue-list__header">
              <div>
                <p className="admin-panel__eyebrow">Active Line</p>
                <h2 id="active-queue-title">Students Waiting</h2>
              </div>
              <div className="queue-filters" aria-label="Queue filters">
                <button className="queue-filter queue-filter--active" type="button">
                  All
                </button>
                <button className="queue-filter" type="button">
                  CTAP
                </button>
                <button className="queue-filter" type="button">
                  Review
                </button>
              </div>
            </div>

            <div className="queue-table-wrap">
              <table className="admin-table queue-table">
                <thead>
                  <tr>
                    <th>Pos</th>
                    <th>Student</th>
                    <th>Service</th>
                    <th>Wait</th>
                    <th>Status</th>
                    <th>Station</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activeQueue.map((student) => (
                    <tr key={student.ticket}>
                      <td className="queue-position">#{student.position}</td>
                      <td>
                        <div className="queue-student">
                          <span className="queue-student__name">
                            {student.name}
                          </span>
                          <span className="queue-student__meta">
                            {student.studentId} / {student.ticket}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={getPriorityClass(student.priority)}>
                          {student.priority}
                        </span>
                        <span className="queue-service">{student.service}</span>
                      </td>
                      <td className="queue-wait">{student.waited}</td>
                      <td>
                        <span className={getStatusClass(student.status)}>
                          {student.status}
                        </span>
                      </td>
                      <td>{student.station}</td>
                      <td>
                        <div className="queue-actions">
                          <button className="queue-action" type="button">
                            Call
                          </button>
                          <button
                            className="queue-action queue-action--ready"
                            type="button"
                          >
                            Ready
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="queue-support" aria-label="Queue support tools">
          <aside className="admin-panel queue-tools" aria-labelledby="tools-title">
            <div className="admin-panel__header">
              <div>
                <p className="admin-panel__eyebrow">Controls</p>
                <h2 id="tools-title">Shift Tools</h2>
              </div>
            </div>
            <div className="queue-tool-grid">
              <button className="queue-tool queue-tool--primary" type="button">
                Call Next
              </button>
              <button className="queue-tool" type="button">
                Reassign Window
              </button>
              <button className="queue-tool" type="button">
                Pause Intake
              </button>
              <button className="queue-tool" type="button">
                Export List
              </button>
            </div>
          </aside>

          <div className="queue-side">
            <section className="admin-panel" aria-labelledby="window-plan-title">
              <div className="admin-panel__header">
                <div>
                  <p className="admin-panel__eyebrow">CTAP Windows</p>
                  <h2 id="window-plan-title">Window Plan</h2>
                </div>
              </div>
              <div className="queue-windows">
                {ctapWindowPlan.map((windowPlan) => (
                  <article className="queue-window" key={windowPlan.window}>
                    <p className="queue-window__name">{windowPlan.window}</p>
                    <p className="queue-window__focus">{windowPlan.focus}</p>
                    <p className="queue-window__assignment">
                      {windowPlan.assignment}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <section className="admin-panel" aria-labelledby="support-table-title">
              <div className="admin-panel__header">
                <div>
                  <p className="admin-panel__eyebrow">Floor Support</p>
                  <h2 id="support-table-title">Support Table</h2>
                </div>
              </div>
              <div className="queue-windows">
                {floorSupportPlan.map((supportItem) => (
                  <article className="queue-window" key={supportItem.area}>
                    <p className="queue-window__name">{supportItem.area}</p>
                    <p className="queue-window__focus">{supportItem.focus}</p>
                    <p className="queue-window__assignment">
                      {supportItem.detail}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <section className="admin-panel" aria-labelledby="attention-title">
              <div className="admin-panel__header">
                <div>
                  <p className="admin-panel__eyebrow">Watch List</p>
                  <h2 id="attention-title">Needs Attention</h2>
                </div>
              </div>
              <div className="queue-attention">
                {queueAttentionItems.map((item) => (
                  <article className="queue-attention__item" key={item.label}>
                    <div>
                      <p className="queue-attention__label">{item.label}</p>
                      <p className="queue-attention__detail">{item.detail}</p>
                    </div>
                    <span>{item.value}</span>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </section>

        <section className="admin-panel queue-plan-panel" aria-labelledby="rush-plan-title">
          <div className="admin-panel__header">
            <div>
              <p className="admin-panel__eyebrow">Triage</p>
              <h2 id="rush-plan-title">Rush Plan</h2>
            </div>
          </div>
          <ol className="queue-plan">
            {queueRushPlan.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}

export default QueueManagementPage;
