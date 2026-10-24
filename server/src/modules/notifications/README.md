# Notification module

Notifications run inside the shared Express API. The former `backend/notifications/` demo server has been replaced by this TypeScript module; no separate notification server or `VITE_NOTIFICATION_API_URL` setting is needed.

## Files and storage

- `notifications.models.ts`: notification and queue-event contracts.
- `notifications.service.ts`: validation, event creation, duplicate suppression, and queue-change integration.
- `notifications.routes.ts`: authenticated list and dismissal endpoints.
- `createStore().notifications`: a separate notification store for each application/test instance, shared by routes and queue services. Notifications reset when the in-memory backend restarts.

## API and user interface

| Method | Path | Response |
| --- | --- | --- |
| GET | `/api/notifications` | `{ data: NotificationItem[] }`, newest first, signed-in user's alerts only |
| DELETE | `/api/notifications/:notificationId` | `204`, only for the alert's owner |

Both endpoints use the verified identity from the shared authentication resolver. Missing/expired sessions return `401`; deleting someone else's or an absent notification returns `404`. Users cannot select an owner through request parameters. No endpoint lets a browser create arbitrary alerts.

The user navigation links to `/notifications`, implemented in `src/pages/user/NotificationsPage.tsx`. The page uses the shared API client, which sends the login bearer token through the Vite `/api` proxy. It polls every five seconds, shows loading/empty/error states, and displays timestamps in Houston time. Dismissal remains effective across refreshes while the backend is running.

## Queue events

- Successful join calls `notifyQueueJoined(store, entry)` after inserting the visit, generating a join confirmation and checking the waiting line.
- Join, leave, and administrator serve-next call `notifyQueueChanged(store, serviceId)` after the change.
- Near-turn alerts go to the first two waiting users in that service, using the same priority/arrival order as administrator queue management. Serving and finished visits are excluded.
- Each visit generates at most one `joined` and one `near_turn` alert. Dismissing an alert does not allow the same event to recreate it. A fresh visit has a new ID and can generate fresh alerts.

Run `npm run dev:server` and `npm run dev` from the repository root. Sign in as the demo student and join a service to see real alerts. To test administrator actions alongside a student, use separate browser profiles/private windows so the two logins do not overwrite each other's local-storage token.

Tests in `server/tests/notifications.test.ts` and `server/tests/queue.user.test.ts` run with the normal `npm test` command. They cover migrated notification behavior, real-session ownership, duplicate suppression, queue changes, join/leave, and service completion/history.
