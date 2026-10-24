import { useEffect, useState } from 'react';
import {
  Link,
  useNavigate,
} from 'react-router-dom';

import { useNotifications } from '../../context/NotificationContext';

import './QueueStatusPage.css';

type QueueEntry = {
  id: string;
  userId: string;
  serviceId: string;
  priority: number;
  joinedAt: string;
  status: 'queued' | 'serving' | 'served' | 'left';
  endedAt: string | null;
};

type ActiveQueue = {
  entry: QueueEntry;
  service: {
    id: string;
    name: string;
    expectedDurationMinutes: number;
  };
  position: number | null;
  waitingCount: number;
};

type ApiErrorResponse = {
  error?: {
    code: string;
    message: string;
  };
};

function QueueStatusPage() {
  const navigate = useNavigate();
  const { addNotification } = useNotifications();

  const [queue, setQueue] =
    useState<ActiveQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void loadQueue();
  }, []);

  async function loadQueue() {
    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/queue/me');

      if (!response.ok) {
        const result =
          (await response.json()) as ApiErrorResponse;

        throw new Error(
          result.error?.message ??
            'Unable to load queue status.',
        );
      }

      const result = (await response.json()) as {
        data: ActiveQueue | null;
      };

      setQueue(result.data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load queue status.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleLeaveQueue() {
    if (!queue) {
      return;
    }

    try {
      setLeaving(true);
      setError('');

      const response = await fetch(
        `/api/queue/${queue.entry.id}/leave`,
        {
          method: 'POST',
        },
      );

      const result =
        (await response.json()) as ApiErrorResponse;

      if (!response.ok) {
        setError(
          result.error?.message ??
            'Unable to leave queue.',
        );
        return;
      }

      addNotification(
        `You left the ${queue.service.name} queue.`,
      );

      navigate('/dashboard');
    } catch {
      setError('Unable to connect to the queue API.');
    } finally {
      setLeaving(false);
    }
  }

  function displayStatus(
    status: QueueEntry['status'],
  ) {
    if (status === 'queued') {
      return 'Waiting';
    }

    if (status === 'serving') {
      return 'Now Serving';
    }

    return status;
  }

  return (
    <div className="queue-status-page">
      <header className="queue-status-header">
        <div className="queue-status-header__content">
          <div>
            <h1>Queue Status</h1>
            <p>Check your current place in line.</p>
          </div>

          <Link
            className="queue-status-back"
            to="/dashboard"
          >
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="queue-status-main">
        {loading ? (
          <section className="queue-status-card">
            <p>Loading queue status...</p>
          </section>
        ) : error ? (
          <section className="queue-status-card">
            <p>{error}</p>
          </section>
        ) : !queue ? (
          <section className="queue-status-card">
            <p className="queue-status-eyebrow">
              CURRENT QUEUE
            </p>

            <h2>
              You are not currently in a queue.
            </h2>

            <Link to="/join-queue">
              Join a Queue
            </Link>
          </section>
        ) : (
          <section className="queue-status-card">
            <p className="queue-status-eyebrow">
              CURRENT QUEUE
            </p>

            <h2>{queue.service.name}</h2>

            {queue.entry.status === 'queued' && (
              <div className="queue-position">
                <p>Your Position</p>

                <span>
                  #{queue.position ?? '-'}
                </span>
              </div>
            )}

            <div className="queue-status-info">
              <div>
                <p>Expected Service Time</p>

                <strong>
                  {
                    queue.service
                      .expectedDurationMinutes
                  }{' '}
                  minutes
                </strong>
              </div>

              <div>
                <p>Status</p>

                <strong>
                  {displayStatus(
                    queue.entry.status,
                  )}
                </strong>
              </div>
            </div>

            {queue.entry.status === 'queued' ? (
              <>
                <p className="queue-status-message">
                  Please remain available. You will
                  be notified when it is your turn.
                </p>

                <button
                  type="button"
                  className="leave-queue-button"
                  disabled={leaving}
                  onClick={() =>
                    void handleLeaveQueue()
                  }
                >
                  {leaving
                    ? 'Leaving...'
                    : 'Leave Queue'}
                </button>
              </>
            ) : (
              <p className="queue-status-message">
                Your service is currently in
                progress.
              </p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default QueueStatusPage;
