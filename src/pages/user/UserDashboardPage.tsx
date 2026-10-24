import UserHeader from './UserHeader';
import { Link } from 'react-router-dom';

import type { Service, UserQueue } from '../../../server/src/shared/models';
import { displayMinutes } from '../../api/display';
import { formatWait, type ServiceWaitEstimate } from '../../api/waitTime';
import WaitEstimate from '../../components/WaitEstimate';
import { useApiResource } from '../../hooks/useApiResource';

import './UserDashboardPage.css';

function UserDashboardPage() {
  const current = useApiResource<UserQueue>('/api/queue/me', 5000);
  const services = useApiResource<Service[]>('/api/services', 5000);
  const waits = useApiResource<{ estimates: ServiceWaitEstimate[] }>('/api/wait-time/services', 5000);
  const entry = current.error ? null : current.data?.entry;

  function waitFor(serviceId: string) {
    const wait = waits.data?.estimates.find((item) => item.serviceId === serviceId);
    return wait ? formatWait(wait.estimatedWaitMinutes) : '—';
  }
  return (
    <div className="user-dashboard">
      <UserHeader />

      <main className="user-main">
        <section className="user-panel">
          <div className="user-panel__header">
            <div>
              <p className="user-panel__eyebrow">Today</p>
              <h1>User Dashboard</h1>
              <p className="user-panel__note">
                View your current service queue and available services.
              </p>
            </div>

            <span className="user-status">Live queue</span>
          </div>

          {current.loading && !current.data && <p role="status">Loading your queue…</p>}
          {current.error && <p role="alert">{current.error.message} {current.error.status === 401 && <Link to="/login">Sign in</Link>}</p>}
          {current.data && !current.error && !entry && <p>No active visit. <Link to="/join-queue">Find a queue</Link> or <Link to="/history">review your history</Link>.</p>}
          {entry && <div className="user-current-queue">
            <div>
              <p className="user-current-queue__label">Current Queue</p>
              <h2>{entry.serviceName ?? 'Bookstore service'}</h2>
            </div>

            <div className="user-queue-stats">
              <div className="user-stat">
                <p className="user-stat__label">Position</p>
                <p className="user-stat__value">{current.data?.position == null ? '—' : `#${current.data.position}`}</p>
              </div>

              <div className="user-stat">
                <p className="user-stat__label">Estimated Wait</p>
                <p className="user-stat__value">
                  <WaitEstimate entryId={entry.id} show="wait" />
                </p>
              </div>

              <div className="user-stat">
                <p className="user-stat__label">Status</p>
                <p className="user-stat__value"><WaitEstimate entryId={entry.id} show="stage" /></p>
              </div>
            </div>

            <Link className="user-primary-button" to="/queue-status">
              View Queue Status
            </Link>
          </div>}
        </section>

        <section className="user-panel">
          <div className="user-panel__header">
            <div>
              <p className="user-panel__eyebrow">Services</p>
              <h2>Available Services</h2>
            </div>
          </div>

          <div className="user-services">
            {services.error && <p role="alert">{services.error.message}</p>}
            {services.loading && !services.data && <p role="status">Loading services…</p>}
            {services.data?.length === 0 && <p>No services are available yet.</p>}
            {services.data?.map((service) => (
              <article className="user-service-card" key={service.id}>
                <div>
                  <h3>{service.name}</h3>
                  <p>{service.description}</p>
                  <p>Expected service time: {displayMinutes(service.expectedDurationMinutes)}</p>
                  <p>Estimated wait: {waitFor(service.id)}</p>
                </div>

                <div className="user-service-card__footer">
                  <Link
                    className="user-secondary-button"
                    to="/join-queue"
                  >
                    Join Queue
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default UserDashboardPage;
