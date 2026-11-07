# Notification module

Notifications run inside the shared Express API. The former `backend/notifications/` demo server has been replaced by this TypeScript module; no separate notification server or `VITE_NOTIFICATION_API_URL` setting is needed.

## Files and storage

- `notifications.models.ts`: notification and queue-event contracts.
- `notifications.service.ts`: validation, event creation, duplicate suppression, and queue-change integration.
- `notifications.routes.ts`: authenticated list, dismissal, and viewed-state endpoints.
- `notifications.postgres.ts`: persistent events, ownership-scoped reads/updates, and readiness alerts for the first two waiting students. Production uses this repository.
- `createStore().notifications`: a separate memory adapter for database-free tests.

## API and user interface

| Method | Path | Response |
| --- | --- | --- |
| GET | `/api/notifications` | `{ data: NotificationItem[] }`, newest first, signed-in user's alerts only |
| DELETE | `/api/notifications/:notificationId` | `204`, only for the alert's owner |
| PATCH | `/api/notifications/:notificationId/viewed` | `204`, records viewed status for the owner |

All endpoints use the verified identity from the shared authentication resolver. Missing/expired sessions return `401`; updating someone else's, dismissed, or absent notification returns `404`. PostgreSQL notification IDs must be UUIDs; invalid IDs return `400`. Users cannot select an owner through request parameters. No endpoint lets a browser create arbitrary alerts.

The user navigation links to `/notifications`, implemented in `src/pages/user/NotificationsPage.tsx`. The page uses the shared API client, which sends the login bearer token through the Vite `/api` proxy. It polls every five seconds, records displayed alerts as viewed, shows loading/empty/error states, and displays timestamps in Houston time. Alerts, viewed status, and dismissal remain stored across refreshes and backend restarts.

## Queue events

- Successful PostgreSQL joins save a `joined` event and check the ordered waiting line.
- Join, leave, and administrator serve-next call `notifyPostgresQueueChanged` within the queue transaction. If saving an alert fails, the visit change rolls back too.
- Near-turn alerts go to the first two waiting users in that service, using the same priority/arrival order as administrator queue management. Serving and finished visits are excluded.
- Each visit generates at most one `joined` and one `near_turn` alert. Dismissing an alert does not allow the same event to recreate it. A fresh visit has a new ID and can generate fresh alerts.
- These are readiness alerts, not a separate call-to-window action. The existing Start next user workflow is unchanged. Alerts are created for new queue events; old visits are not backfilled on startup.

Run `npm run dev:server` and `npm run dev` from the repository root. Sign in as the demo student and join a service to see real alerts. To test administrator actions alongside a student, use separate browser profiles/private windows so the two logins do not overwrite each other's local-storage token.

`npm test` runs notification store, repository, route, and queue behavior tests. `npm run test:db` also runs `notifications.application.integration.ts` and `notifications.postgres.integration.ts` against isolated schemas. These check real authenticated API wiring, join/start/leave alerts, ownership, viewed status, restart persistence, dismissal/deduplication, fresh visits, and rollback when notification storage fails.
