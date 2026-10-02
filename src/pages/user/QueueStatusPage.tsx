import { Link } from 'react-router-dom';
import { useState } from 'react';

import { userQueue } from '../../design/queueSmartDesign';
import { useNotifications } from '../../context/NotificationContext';

import './QueueStatusPage.css';

function QueueStatusPage() {
  const { addNotification } = useNotifications();

  const [status, setStatus] = useState(userQueue.status);

  const handleStatusChange = () => {
    setStatus('Ready');
    addNotification('Your queue status changed to Ready.');
  };

  return (
    <div className="queue-status-page">
      <header className="queue-status-header">
        <div className="queue-status-header__content">
          <div>
            <h1>Queue Status</h1>
            <p>Check your current place in line.</p>
          </div>

          <Link className="queue-status-back" to="/dashboard">
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="queue-status-main">
        <section className="queue-status-card">
          <p className="queue-status-eyebrow">
            CURRENT QUEUE
          </p>

          <h2>{userQueue.service}</h2>

          <div className="queue-position">
            <p>Your Position</p>
            <span>#{userQueue.position}</span>
          </div>

          <div className="queue-status-info">
            <div>
              <p>Estimated Wait</p>
              <strong>{userQueue.estimatedWait}</strong>
            </div>

            <div>
              <p>Status</p>
              <strong>{status}</strong>
            </div>
          </div>

          <p className="queue-status-message">
            Please remain available. You will be notified when it is your turn.
          </p>

          <button
            className="leave-queue-button"
            onClick={handleStatusChange}
          >
            Test Status Change
          </button>

          <button className="leave-queue-button">
            Leave Queue
          </button>
        </section>
      </main>
    </div>
  );
}

export default QueueStatusPage;