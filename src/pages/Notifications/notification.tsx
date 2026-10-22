import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './notification.css';

type NotificationItem = {
  id: string;
  message: string;
  type: 'joined' | 'near_turn';
  createdAt: string;
};
// For integrated backend set VITE_NOTIFICATION_API_URL in .env.local.
// An empty value uses same-origin /api/notifications (configure Vite proxy).
const API = `${import.meta.env.VITE_NOTIFICATION_API_URL ?? 'http://127.0.0.1:3001'}/api/notifications`;

export default function Notification() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const response = await fetch(API, { credentials: 'include', signal: controller.signal });
        if (!response.ok) throw new Error(response.status === 401 ? 'Please log in to view notifications.' : 'Unable to load notifications.');
        const data = await response.json();
        if (!controller.signal.aborted) { setNotifications(data.notifications); setError(''); }
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Unable to connect.');
      } finally {
        if (!controller.signal.aborted) { setLoading(false); timer = setTimeout(load, 5000); }
      }
    }
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [revision]);

  async function remove(id: string) {
    setDeleting(id);
    try {
      const response = await fetch(`${API}/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' });
      if (!response.ok && response.status !== 404) throw new Error('Unable to delete notification.');
      setNotifications(current => current.filter(item => item.id !== id));
      setError('');
      setRevision(current => current + 1);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to connect.'); }
    finally { setDeleting(null); }
  }

  return (
    <div className="notification-page">
      <header className="notification-header"><div className="notification-header__content">
        <div><h1>Notifications</h1><p>View queue updates and status changes.</p></div>
        <Link className="notification-back" to="/dashboard">Back to Dashboard</Link>
      </div></header>
      <main className="notification-main"><section className="notification-card">
        <p className="notification-eyebrow">RECENT ACTIVITY</p><h2>Queue Updates</h2>
        {error && <p role="alert">{error}</p>}
        {loading ? <p>Loading notifications…</p> : notifications.length === 0 ? (
          <div className="notification-empty"><p>No notifications.</p></div>
        ) : <div className="notification-list" aria-live="polite">
          {notifications.map(item => <div className="notification-item" key={item.id}>
            <div><p>{item.message}</p><small>{new Date(item.createdAt).toLocaleString()}</small></div>
            <button className="notification-delete" disabled={deleting !== null} onClick={() => void remove(item.id)}>
              {deleting === item.id ? 'Deleting…' : 'Delete'}
            </button>
          </div>)}
        </div>}
      </section></main>
    </div>
  );
}
