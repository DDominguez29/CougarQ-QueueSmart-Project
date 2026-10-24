import { useEffect, useState } from 'react';
import {
  Link,
  useNavigate,
} from 'react-router-dom';

import { useNotifications } from '../../context/NotificationContext';

import './JoinQueuePage.css';

type Service = {
  id: string;
  name: string;
  description: string;
  expectedDurationMinutes: number;
  priority: number;
};

type ApiErrorResponse = {
  error?: {
    code: string;
    message: string;
  };
};

function JoinQueuePage() {
  const navigate = useNavigate();
  const { addNotification } = useNotifications();

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] =
    useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void loadServices();
  }, []);

  async function loadServices() {
    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/services');

      if (!response.ok) {
        throw new Error('Unable to load services.');
      }

      const result = (await response.json()) as {
        data: Service[];
      };

      setServices(result.data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load services.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(service: Service) {
    try {
      setJoiningId(service.id);
      setError('');

      const response = await fetch(
        `/api/services/${service.id}/queue/join`,
        {
          method: 'POST',
        },
      );

      const result =
        (await response.json()) as ApiErrorResponse;

      if (!response.ok) {
        setError(
          result.error?.message ??
            'Unable to join queue.',
        );
        return;
      }

      addNotification(
        `You joined the ${service.name} queue.`,
      );

      navigate('/queue-status');
    } catch {
      setError('Unable to connect to the queue API.');
    } finally {
      setJoiningId(null);
    }
  }

  return (
    <div className="join-queue-page">
      <header className="join-queue-header">
        <div className="join-queue-header__content">
          <div>
            <h1>Join Queue</h1>
            <p>Select a service and join the line.</p>
          </div>

          <Link
            className="join-queue-back"
            to="/dashboard"
          >
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="join-queue-main">
        <section className="join-queue-panel">
          <p className="join-queue-eyebrow">
            AVAILABLE SERVICES
          </p>

          <h2>Choose a Queue</h2>

          {error && (
            <p className="join-queue-error">
              {error}
            </p>
          )}

          {loading ? (
            <p>Loading services...</p>
          ) : services.length === 0 ? (
            <p>No services are currently available.</p>
          ) : (
            <div className="join-service-list">
              {services.map((service) => (
                <article
                  className="join-service-card"
                  key={service.id}
                >
                  <div>
                    <h3>{service.name}</h3>

                    <p>{service.description}</p>

                    <p>
                      Expected service time:{' '}
                      {service.expectedDurationMinutes}{' '}
                      minutes
                    </p>
                  </div>

                  <div className="join-service-card__right">
                    <button
                      type="button"
                      className="join-queue-button"
                      disabled={joiningId === service.id}
                      onClick={() =>
                        void handleJoin(service)
                      }
                    >
                      {joiningId === service.id
                        ? 'Joining...'
                        : 'Join Queue'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default JoinQueuePage;
