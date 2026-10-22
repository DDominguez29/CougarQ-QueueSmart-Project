import { createServer } from 'node:http';
import { notificationStore } from './store.mjs';
import { createNotificationHandler } from './http.mjs';

// LOCAL DEMO ONLY: fixed mock identity until Denzel's authentication is integrated.
const handle = createNotificationHandler(notificationStore, () => ({ id: 'demo-user' }));
notificationStore.notifyJoined({ userId: 'demo-user', queueEntryId: 'demo-visit-1', serviceName: 'Academic Advising' });
notificationStore.notifyQueueChanged([
  { userId: 'another-user', queueEntryId: 'demo-visit-2', serviceName: 'Academic Advising' },
  { userId: 'demo-user', queueEntryId: 'demo-visit-1', serviceName: 'Academic Advising' },
]);
const allowedOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const server = createServer(async (req, res) => {
  if (req.headers.origin) {
    if (req.headers.origin !== allowedOrigin) { res.writeHead(403); res.end(); return; }
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  }
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (!await handle(req, res)) { res.writeHead(404); res.end('Not found'); }
});
server.listen(3001, '127.0.0.1', () => {
  console.log('Notification DEMO: http://127.0.0.1:3001/api/notifications');
  console.log('Fixed demo-user; two sample events. Restart to reset in-memory data.');
});
