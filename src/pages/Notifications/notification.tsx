import { Link } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import './notification.css';

export default function Notification() {
  const { notifications, removeNotification } = useNotifications();

  return (
    <div className="notification-page">
      <header className="notification-header">
        <div className="notification-header__content">
          <div>
            <h1>Notifications</h1>
            <p>View queue updates and status changes.</p>
          </div>

          <Link className="notification-back" to="/dashboard">
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="notification-main">
        <section className="notification-card">
          <p className="notification-eyebrow">
            RECENT ACTIVITY
          </p>

          <h2>Queue Updates</h2>

          {notifications.length === 0 ? (
            <div className="notification-empty">
              <p>No notifications.</p>
            </div>
          ) : (
            <div className="notification-list">
              {notifications.map((notification) => (
                <div
                  className="notification-item"
                  key={notification.id}
                >
                  <p>{notification.message}</p>

                  <button
                    className="notification-delete"
                    onClick={() =>
                      removeNotification(notification.id)
                    }
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}