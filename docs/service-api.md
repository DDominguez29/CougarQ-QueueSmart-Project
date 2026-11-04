# Service API

Implemented in `server/src/modules/services/`. The running backend injects the
shared PostgreSQL pool. Routes use parameterized SQL through the service repository;
unit tests use an explicit in-memory adapter.

## Endpoints

| Method and path | Access | Result |
| --- | --- | --- |
| GET /api/services | Public | 200; all services, highest priority first |
| POST /api/services | Administrator | 201; created service and matching open queue |
| PUT /api/services/:id | Administrator | 200; updated service, same ID and queue |

POST and PUT accept the same body; PUT requires all four fields:

```json
{
  "name": "Book Pickup",
  "description": "Pickup reserved library books.",
  "expectedDurationMinutes": 2.5,
  "priority": 2
}
```

name is trimmed, nonblank, at most 100 characters. description is trimmed,
nonblank, at most 500 characters. Duration must be a positive finite number;
priority must be an integer from 0 to 2147483647. IDs are generated server-side.
No service deletion endpoint is implemented for this checkpoint.

## Responses and authentication

POST/PUT return `{ "data": { "id": "<uuid>", ...serviceFields } }`.
GET returns `{ "data": [ ...services ] }` and disables response caching. SQL columns
map to the existing camelCase fields; the admin UI needs no new API contract.
For ties in priority, SQL orders by created_at and ID for a stable result.

Protected requests use `Authorization: Bearer <token>` from the existing login
endpoint. Roles and user IDs must come from the server's identity resolver.
Restarting currently invalidates sessions; sign in again after a restart.

| HTTP | Examples |
| --- | --- |
| 400 | INVALID_SERVICE, INVALID_SERVICE_NAME, INVALID_SERVICE_DESCRIPTION, INVALID_SERVICE_DURATION, INVALID_SERVICE_PRIORITY |
| 401 | UNAUTHENTICATED: sign in before changing services |
| 403 | FORBIDDEN: only an administrator may change services |
| 404 | SERVICE_NOT_FOUND: PUT target does not exist or is not a UUID |
| 500 | Unexpected database/server failure; no fallback to transient service writes |

Errors use `{ "error": { "code": "...", "message": "..." } }`.

## Persistence and shared readers

Creation inserts the service and its initial open queue in one SQL statement, so
both succeed or neither is saved. Updates preserve service ID and queue status.
`updated_at` is maintained by a database trigger. Listing and edits persist across
backend restarts. Explicit demo seeding preserves existing service edits.

Queue, wait-time, history, and report routes read a fresh SQL service catalog per
request. Their current synchronous calculations receive a temporary service Map;
their participation/auth storage remains shared in memory until teammates migrate
it. Do not add writes to that temporary catalog. New persistent consumers should
receive the existing pool/repository rather than create new pools or separate
mutable service catalogs.

## Verification

`npm test` verifies API validation and permissions without PostgreSQL. With an
explicit TEST_DATABASE_URL, `npm run test:db` checks SQL persistence across restart,
queue creation rollback, SQL-looking text stored safely, missing IDs, user/admin
permissions, fresh catalog reads, and repeatable sample seeds.

Manual check: edit a service in Service Management, stop/restart the backend,
sign in again, and confirm the edited values remain. This was also confirmed by
the project owner on November 4, 2026.
