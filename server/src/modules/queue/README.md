# Queue management module

Shared between the user join/leave owner and Diego Dominguez (administrator view/serve next).

## Implemented administrator endpoints

All routes require an authenticated administrator via the shared identity resolver.

| Method | Path | Response data |
| --- | --- | --- |
| GET | `/api/admin/queue` | `{ queues, totalWaiting }`; optional `?serviceId=...` |
| GET | `/api/services/:serviceId/queue` | One queue view |
| POST | `/api/services/:serviceId/queue/serve-next` | `{ started, queue }` |
| POST | `/api/queue/:entryId/complete` | `{ completed, queue }` |

A queue view contains `service: { id, name }`, `entries` with positions starting at 1, `waitingCount`, `nextEntryId` (null for an empty queue), and `inService` visits. Only `queued` records are in the waiting list. Larger priority numbers come first, then earlier arrivals, then insertion order for exact ties.

Serve-next requires exactly `{ "expectedEntryId": "the-last-displayed-next-entry-id" }`. The server independently selects the next entry and compares this ID as a stale-view guard. A repeat request cannot serve the following person: it returns `409 QUEUE_CHANGED` (or `QUEUE_EMPTY`). Refresh after a conflict or an uncertain response; do not automatically retry the operation. Selection and update are synchronous within this single-process in-memory server.

The lifecycle is `queued -> serving -> served`. Serve-next now STARTS service, records server-generated `serviceStartedAt`, sets `status: 'serving'`, and leaves `completedAt`/`endedAt` null. Its response uses `started` rather than the former one-step `served` property. The admin UI labels this action **Start next user**.

Completion accepts no body (or an empty JSON object). It requires an in-service visit, marks it `served`, records `completedAt`, mirrors that value into `endedAt` for compatibility, and retains it for history/reports. Duplicate completion returns `409 NOT_IN_SERVICE`. Timestamp overrides are rejected. This separates queue wait from service duration and makes daily completed-visit totals meaningful.

Responses follow `{ data: ... }` or `{ error: { code, message } }`. Invalid input is `400`, unauthenticated requests `401`, non-admin requests `403`, missing resources `404`, and queue conflicts `409`. IDs must be 1-100 ASCII letters, digits, hyphens, or underscores, starting with a letter or digit.

## User join/leave endpoints

`queue.user.routes.ts` and `queue.user.service.ts` implement the user flow with the same shared store as administrator queue management.

| Method | Path | Response data |
| --- | --- | --- |
| GET | `/api/queue/me` | `{ entry, position }`; both null when there is no active visit |
| POST | `/api/services/:serviceId/queue` | New entry (`201`) |
| DELETE | `/api/queue/:entryId` | Retained entry with `status: 'left'` |

All require a verified identity. Join/leave accept no body or an empty object; user IDs, priorities, and timestamps cannot be supplied by the client. Joining creates a unique participation ID, takes priority from the selected service, and snapshots its name. One active visit per user is allowed across waiting and in-service states; repeat/concurrent joins return `409 ALREADY_IN_QUEUE`.

Leaving requires ownership and `queued` status, records `endedAt`, and retains the entry for history. Another user's visit returns `404`; an in-service or finished visit returns `409 NOT_WAITING`. Rejoining creates a new visit. Current position follows the same service-specific ordering as the administrator queue; an in-service visit has no waiting position.

Join, leave, and start-next generate the notification events documented in `../notifications/README.md`. The user dashboard, join page, and queue-status page now read backend data; they no longer create browser-only notifications or simulated status changes.

Tests: `server/tests/queue.test.ts`, `server/tests/queue.user.test.ts`, `server/tests/routes.test.ts`, and `server/tests/notifications.test.ts`.
