import UserHeader from './UserHeader';
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Service, UserQueue } from '../../../server/src/shared/models';
import { requestError, type ApiRequestError } from '../../api/client';
import { displayMinutes } from '../../api/display';
import { joinServiceQueue } from '../../api/queue';
import { formatWait, type ServiceWaitEstimate } from '../../api/waitTime';
import { useApiResource } from '../../hooks/useApiResource';
import './JoinQueuePage.css';

function JoinQueuePage() {
  const services = useApiResource<Service[]>('/api/services', 5000);
  const current = useApiResource<UserQueue>('/api/queue/me', 5000);
  const waits = useApiResource<{ estimates: ServiceWaitEstimate[] }>('/api/wait-time/services', 5000);
  const [joining, setJoining] = useState<string | null>(null);
  const pending = useRef(false);
  const [actionError, setActionError] = useState<ApiRequestError | null>(null);
  const navigate = useNavigate();
  const error = actionError ?? services.error ?? current.error;

  async function join(serviceId: string) {
    if (pending.current) return;
    pending.current = true;
    setJoining(serviceId);
    setActionError(null);
    try {
      await joinServiceQueue(serviceId);
      navigate('/notifications');
    } catch (err) {
      setActionError(requestError(err));
      current.refresh();
    } finally {
      pending.current = false;
      setJoining(null);
    }
  }

  return (
    <div className="join-queue-page">
      <UserHeader />
      <main className="join-queue-main"><section className="join-queue-panel">
        <h1>Join Queue</h1><p>Select a service and join the line.</p>
        <p className="join-queue-eyebrow">AVAILABLE SERVICES</p><h2>Choose a Queue</h2>
        {error && <p role="alert">{error.message} {error.status === 401 && <Link to="/login">Sign in</Link>}</p>}
        {current.data?.entry && <p role="status">You already have an active visit. <Link to="/queue-status">View your queue</Link>.</p>}
        {services.loading && !services.data && <p role="status">Loading services…</p>}
        {services.data?.length === 0 && <p>No services are available yet.</p>}
        <div className="join-service-list">
          {services.data?.map((service) => {
            const wait = waits.data?.estimates.find((item) => item.serviceId === service.id);
            return (
            <article className="join-service-card" key={service.id}>
              <div>
                <h3>{service.name}</h3><p>{service.description}</p>
                <p>Expected service time: {displayMinutes(service.expectedDurationMinutes)}</p>
                <p>{wait ? `${wait.peopleAhead} waiting · Estimated wait: ${formatWait(wait.estimatedWaitMinutes)}` : 'Estimated wait: —'}</p>
              </div>
              <div className="join-service-card__right">
                <button className="join-queue-button" type="button"
                  disabled={joining !== null || current.loading || !!current.error || !!current.data?.entry}
                  onClick={() => void join(service.id)}>
                  {joining === service.id ? 'Joining…' : 'Join Queue'}
                </button>
              </div>
            </article>
            );
          })}
        </div>
      </section></main>
    </div>
  );
}

export default JoinQueuePage;
