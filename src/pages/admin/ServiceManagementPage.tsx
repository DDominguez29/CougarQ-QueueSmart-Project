import { Link } from 'react-router-dom';

import {
  employeeServiceNotes,
  knownDigitalMaterials,
  managedServices,
  serviceAdjustmentItems,
  serviceManagementStats,
  serviceRoutingRules,
} from '../../design/queueSmartDesign';
import './AdminDashboardPage.css';
import './ServiceManagementPage.css';

function getServiceBadgeClass(status: string) {
  if (status === 'Open') {
    return 'admin-badge admin-badge--success';
  }

  if (status === 'Floor support') {
    return 'admin-badge service-badge--info';
  }

  return 'admin-badge admin-badge--warning';
}

function ServiceManagementPage() {
  return (
    <div className="admin-dashboard service-page">
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
            <Link
              className="admin-nav__link admin-nav__link--active"
              to="/admin/services"
            >
              Services
            </Link>
            <Link className="admin-nav__link" to="/admin/queue">
              Queue
            </Link>
          </nav>
        </div>
      </header>

      <main className="admin-main service-main">
        <section className="service-summary" aria-labelledby="services-title">
          <div className="admin-panel service-summary__panel">
            <div className="admin-panel__header service-summary__header">
              <div>
                <p className="admin-panel__eyebrow">Service Setup</p>
                <h1 id="services-title">Service Management</h1>
                <p className="admin-panel__note">
                  Control what students can join, what stays walk-up support,
                  and how CTAP windows are assigned during rush periods.
                </p>
              </div>
              <button className="service-primary-action" type="button">
                Add Service
              </button>
            </div>

            <div className="service-stats">
              {serviceManagementStats.map((stat) => (
                <article className="service-stat" key={stat.label}>
                  <p className="service-stat__label">{stat.label}</p>
                  <p className="service-stat__value">{stat.value}</p>
                  <p className="service-stat__detail">{stat.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="service-workspace">
          <div className="admin-panel" aria-labelledby="service-table-title">
            <div className="admin-panel__header service-table-header">
              <div>
                <p className="admin-panel__eyebrow">Live Services</p>
                <h2 id="service-table-title">Service Directory</h2>
              </div>
              <div className="service-tabs" aria-label="Service filters">
                <button className="service-tab service-tab--active" type="button">
                  All
                </button>
                <button className="service-tab" type="button">
                  Queue
                </button>
                <button className="service-tab" type="button">
                  Walk-up
                </button>
              </div>
            </div>

            <div className="service-table-wrap">
              <table className="admin-table service-table">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Status</th>
                    <th>Assigned Area</th>
                    <th>Waiting</th>
                    <th>Est. Wait</th>
                    <th>Intake</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {managedServices.map((service) => (
                    <tr key={service.name}>
                      <td>
                        <div className="service-name">
                          <span className="service-name__title">
                            {service.name}
                          </span>
                          <span className="service-name__description">
                            {service.description}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={getServiceBadgeClass(service.status)}>
                          {service.status}
                        </span>
                      </td>
                      <td>{service.lane}</td>
                      <td className="service-number">{service.waiting}</td>
                      <td>{service.estimatedWait}</td>
                      <td>{service.intake}</td>
                      <td>
                        <button className="service-row-action" type="button">
                          {service.action}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="service-support" aria-label="Service guidance">
          <section className="admin-panel" aria-labelledby="routing-title">
            <div className="admin-panel__header">
              <div>
                <p className="admin-panel__eyebrow">Routing</p>
                <h2 id="routing-title">Student Direction Rules</h2>
              </div>
            </div>
            <div className="service-rules">
              {serviceRoutingRules.map((rule) => (
                <article className="service-rule" key={rule.situation}>
                  <div>
                    <p className="service-rule__situation">{rule.situation}</p>
                    <p className="service-rule__note">{rule.note}</p>
                  </div>
                  <span>{rule.destination}</span>
                </article>
              ))}
            </div>
          </section>

          <section className="admin-panel" aria-labelledby="adjustments-title">
            <div className="admin-panel__header">
              <div>
                <p className="admin-panel__eyebrow">Rush Mode</p>
                <h2 id="adjustments-title">Adjustment Notes</h2>
              </div>
            </div>
            <ol className="service-adjustments">
              {serviceAdjustmentItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </section>
        </section>

        <section className="admin-panel service-notes-panel" aria-labelledby="employee-notes-title">
          <div className="admin-panel__header">
            <div>
              <p className="admin-panel__eyebrow">Employee Notes</p>
              <h2 id="employee-notes-title">Material Reminders</h2>
            </div>
          </div>
          <div className="service-notes">
            {employeeServiceNotes.map((note) => (
              <article className="service-note" key={note.title}>
                <p className="service-note__title">{note.title}</p>
                <p className="service-note__detail">{note.detail}</p>
                {note.title === 'Access codes' && (
                  <ul className="service-note__materials">
                    {knownDigitalMaterials.map((material) => (
                      <li key={material}>{material}</li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default ServiceManagementPage;
