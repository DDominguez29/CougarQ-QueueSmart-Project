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

## Join/leave integration (separate team responsibility)

Suggested paths remain `POST /api/services/:serviceId/queue` and `DELETE /api/queue/:entryId`. These are not implemented here. Keep their HTTP handlers in a separate `queue.user.routes.ts` so two people can work independently; both sides must use the same store and ordering rules.

On join: create a unique `QueueEntry` with the verified user ID, service ID, backend-controlled numeric priority, UTC ISO `joinedAt`, `status: 'queued'`, `endedAt: null`, and preferably a `serviceName` snapshot. `serviceStartedAt` and `completedAt` can initially be null or omitted. On leave: verify ownership and queued status, update to `left`, set `endedAt`, and retain the entry. Do not let user leave operations overwrite an in-service or completed visit. Rejoining must create a new participation ID. Never accept client-supplied priority/role as authority.

Register the join/leave router in `app.ts`. The admin router's permission checks apply only to its own routes, allowing user routes to share the service path. Use the auth resolver described in `server/README.md`.

Tests: `server/tests/queue.test.ts` and `server/tests/routes.test.ts`.
