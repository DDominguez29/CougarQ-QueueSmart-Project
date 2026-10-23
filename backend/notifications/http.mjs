import { NotificationError } from './store.mjs';

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

// Works with native Node requests/responses, or Express req/res.
// resolveUser(req) must return { id } from your team's verified session/token.
export function createNotificationHandler(store, resolveUser) {
  return async function handleNotifications(req, res) {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== '/api/notifications' && !url.pathname.startsWith('/api/notifications/')) return false;
    try {
      const user = await resolveUser(req);
      if (!user || typeof user.id !== 'string' || !user.id.trim()) {
        throw new NotificationError('Login required.', 401);
      }
      if (url.pathname === '/api/notifications' && req.method === 'GET') {
        json(res, 200, { notifications: store.list(user.id) });
      } else if (req.method === 'DELETE' && url.pathname.startsWith('/api/notifications/')) {
        let id;
        try { id = decodeURIComponent(url.pathname.slice('/api/notifications/'.length)); }
        catch { throw new NotificationError('Invalid notification ID.'); }
        store.remove(user.id, id);
        res.writeHead(204);
        res.end();
      } else {
        json(res, 405, { error: 'Method not allowed.' });
      }
    } catch (error) {
      const status = error instanceof NotificationError ? error.status : 500;
      json(res, status, { error: status === 500 ? 'Unable to process notifications.' : error.message });
    }
    return true;
  };
}
