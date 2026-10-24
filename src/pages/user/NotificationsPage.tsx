import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { NotificationItem } from '../../../server/src/modules/notifications/notifications.models';
import { requestApi, requestError, type ApiRequestError } from '../../api/client';
import { displayDate } from '../../api/display';
import UserHeader from './UserHeader';
import './NotificationsPage.css';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const pendingDelete = useRef(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function load() {
      let poll = true;
      try {
        const data = await requestApi<NotificationItem[]>('/api/notifications', { signal: controller.signal });
        if (!controller.signal.aborted) { setNotifications(data); setError(null); }
      } catch (err) {
        const failure = requestError(err);
        if (!controller.signal.aborted) {
          setError(failure);
          if (failure.status === 401) { setNotifications([]); poll = false; }
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          if (poll) timer = setTimeout(load, 5000);
        }
      }
    }
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [revision]);

  async function remove(id: string) {
    if (pendingDelete.current) return;
    pendingDelete.current = true;
    setDeleting(id);
    try {
      try {
        await requestApi<void>(`/api/notifications/${encodeURIComponent(id)}`, { method: 'DELETE' });
      } catch (err) {
        if (requestError(err).status !== 404) throw err;
      }
      setNotifications(current => current.filter(item => item.id !== id));
      setError(null);
      setRevision(current => current + 1);
    } catch (err) { setError(requestError(err)); }
    finally { pendingDelete.current = false; setDeleting(null); }
  }

  return (
    <div className="notification-page">
      <UserHeader />
      <main className="notification-main"><section className="notification-card">
        <p className="notification-eyebrow">RECENT ACTIVITY</p><h1>Notifications</h1>
        <p>View queue updates and status changes.</p>
        <p>Times use Houston local time. Updates appear automatically.</p>
        {error && <p role="alert">{error.message} {error.status === 401 && <Link to="/login">Sign in</Link>}</p>}
        {loading ? <p role="status">Loading notifications…</p> : !error && notifications.length === 0 ? (
          <div className="notification-empty"><p>No notifications yet.</p><Link to="/join-queue">Find a queue</Link></div>
        ) : notifications.length > 0 && <div className="notification-list" aria-live="polite">
          {notifications.map(item => <div className="notification-item" key={item.id}>
            <div><p>{item.message}</p><small><time dateTime={item.createdAt}>{displayDate(item.createdAt)}</time></small></div>
            <button className="notification-delete" type="button" disabled={deleting !== null} onClick={() => void remove(item.id)}>
              {deleting === item.id ? 'Deleting…' : 'Delete'}
            </button>
          </div>)}
        </div>}
      </section></main>
    </div>
  );
}
