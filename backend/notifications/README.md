# QueueSmart A3: Diego Carreon's notification module

## Install in your existing clone

This ZIP is an add-on, NOT a replacement repository. Keep the .git folder in your existing CougarQ-A3 clone.

1. Copy backend/notifications into your project's backend folder (create backend if absent).
2. Replace src/pages/Notifications/notification.tsx with the supplied file. Keep your existing notification.css.
3. Copy src/pages/Notifications/vite-env.d.ts alongside that file.
4. Open a terminal in CougarQ-A3. Run:

```bash
node --test --experimental-test-coverage backend/notifications/notifications.test.mjs
node backend/notifications/demo-server.mjs
```

Leave the server running. In a SECOND terminal in CougarQ-A3:

```bash
npm install
npm run dev
```

Open Vite's displayed URL followed by /notifications (normally http://localhost:5173/notifications).
Two sample notifications should appear, loaded from the backend. Delete removes them server-side.
Restart the demo server to restore the samples. No database or additional backend npm packages are needed.
If Vite uses a different origin/port, stop the demo server and restart with the matching origin, e.g.:

```bash
FRONTEND_ORIGIN=http://localhost:5174 node backend/notifications/demo-server.mjs
```

## What is complete

- In-memory store, join and near-turn event functions.
- Near-turn means first two WAITING entries, excluding anyone already being served.
- One notification per event type per queue visit, even after deletion.
- Required fields, types and lengths checked before mutation.
- GET /api/notifications and DELETE /api/notifications/:id.
- User-scoped listing/deletion, 400/401/404/405/500 responses.
- Existing notification page now reads backend responses, refreshes every five seconds while open, and handles loading, errors and deletion.
- 20 passing automated tests; 100% line/branch/function coverage of store.mjs and http.mjs in the supplied test run. This does NOT measure the whole team's backend, demo launcher or React UI.

## Required team integration (before A3 submission)

The uploaded source has only A2 frontend mocks. The demo server uses a FIXED demo-user and seeds two examples. It is NOT real authentication and does NOT make the A2 Join Queue button functional. Do not present the demo as finished whole-app integration.

Use the store and handler in the SAME shared backend process as the team's queue module. Stop the demo server when switching to that backend. Two different Node processes cannot share this in-memory store.

### 1. Authentication / API owner

Import in the shared Node server (adjust relative paths):

```js
import { notificationStore } from './notifications/store.mjs';
import { createNotificationHandler } from './notifications/http.mjs';

const handleNotifications = createNotificationHandler(
  notificationStore,
  req => req.user ? { id: String(req.user.id) } : null
);
```

`req.user` above is an EXAMPLE: replace with the actual verified identity from your authentication middleware. Never trust a userId supplied in query parameters or headers without authentication.

For Express, after authentication/session middleware but before the final 404 handler:

```js
app.use(async (req, res, next) => {
  if (!await handleNotifications(req, res)) next();
});
```

Mount this at app root (not app.use('/api/notifications', ...)) so req.url keeps the full path. For native Node, call `if (await handleNotifications(req, res)) return;` inside your request callback.

Configure the shared backend's CORS for your actual frontend origin if using different ports. The page sends cookies via credentials: 'include'. If the team uses bearer tokens, add your existing Authorization header in BOTH fetch calls instead.

In the project root .env.local set the shared backend's base URL, with NO trailing slash, and restart Vite:

```text
VITE_NOTIFICATION_API_URL=http://localhost:3000
```

Use the team's actual port. With a configured Vite /api proxy, set the value empty to use same-origin requests.

### 2. Theo / queue join owner

After validating and successfully inserting a queue entry, call:

```js
notificationStore.notifyJoined({
  userId: String(newEntry.userId),
  queueEntryId: String(newEntry.id),
  serviceName: service.name
});
```

These field names are illustrative; map your actual queue structure. Every NEW visit needs a NEW queue-entry ID, including rejoining after leaving. Do not call this for failed joins.

### 3. Queue owners: after join, leave, serve-next or priority changes

After applying the change and sorting the waiting queue, call:

```js
notificationStore.notifyQueueChanged(
  orderedWaitingEntries.map(entry => ({
    userId: String(entry.userId),
    queueEntryId: String(entry.id),
    serviceName: service.name
  }))
);
```

Pass only ONE service's waiting list, ordered by the team's priority/arrival rules. Exclude the user currently being served. Call once for each affected service.

### 4. Frontend queue owner

The existing JoinQueuePage.tsx calls addNotification locally and does not join a server queue. Replace that click handler with the actual backend join request, show success only after a successful response, then navigate to /queue-status or /notifications. Remove the local addNotification call/import. Remove the QueueStatusPage test button and its local notification call as real queue integration is added. This package changes only the notification page, avoiding overwriting teammates' queue work.

The old NotificationContext can remain temporarily for A2 components; the new notification page intentionally ignores it and displays only API data.

## End-to-end acceptance checks with teammates

1. Log in as A, successfully join a real queue; A sees a joined notification.
2. Fail a join; no new success notification.
3. With at least three waiting users, serve/remove someone ahead; the newly eligible user sees near_turn.
4. Repeat queue refreshes; no duplicate alerts.
5. Log in as B; B cannot list or delete A's notifications.
6. Delete a notification, change queue again; dismissed event does not reappear.
7. Leave and rejoin with a new visit ID; new notifications are allowed.
8. Run the entire team's tests and coverage, not only this module.

## Commit your contribution

After checking the files and running tests in your existing clone:

```bash
git add backend/notifications src/pages/Notifications/notification.tsx src/pages/Notifications/vite-env.d.ts START-HERE.md
git commit -m "Implement notification backend, API integration and tests"
git push -u origin feature/notifications-backend
```

Copy this START-HERE.md into the root first if using that exact command. Open a pull request for team review. Do not claim authorship of teammates' queue/auth modules. Do not submit code to Canvas: the team submits its Word/PDF with repository URL, technologies and contribution table.
