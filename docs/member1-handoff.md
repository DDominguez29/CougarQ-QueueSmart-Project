# Member 1 handoff

Completed November 4, 2026: seven-table PostgreSQL schema, keys/constraints/views,
connection pool, setup/check/seed commands, persistent service APIs, repeatable
sample services, shared service catalog integration, and automated tests.

References: [setup](database.md), [schema/data dictionary](database-schema.md),
[service APIs](service-api.md), and [coverage evidence](coverage.md).

## Start on another teammate's machine

1. Pull/merge this contribution after it is committed and pushed; run `npm install`.
2. Install/run PostgreSQL and create a local application database through pgAdmin.
3. Copy `.env.example` to `.env` only if `.env` does not already exist. Set your own
   DATABASE_URL; the database name need not match Diego's local name. Do not share
   passwords or commit `.env`.
4. Run `npm run db:check`, `npm run db:setup`, and optionally `npm run db:seed`.
5. Run `npm run dev:server` and `npm run dev` in separate terminals.
6. Run `npm test`; for database tests, create a separate disposable database, set
   TEST_DATABASE_URL, and run `npm run test:db` or `npm run test:coverage:db`.

## Integration contracts

- Seven tables and two views are documented in the schema reference. Service IDs
  are UUIDs. The former ctap-main/ctap-express/help-desk IDs remain in A3 fixtures;
  production services use UUIDs from the list API or database seeds.
- Each service has one queue. Service creation already inserts both atomically;
  teammates should not create a second queue for that service.
- Reuse the pool injected through createApp/startBackend. Pass it to your feature's
  repository/router; never create a pool per request.
- Preserve current JSON envelopes, frontend field names, endpoint authorization,
  and server-derived identities. Use parameterized SQL and same-client transactions.
- Commit schema changes as coordinated migrations. db:setup initializes an empty
  database or skips a complete existing installation; it does not upgrade objects.
- Services are persistent. Accounts/sessions, visits, alerts, history/report data
  still use memory. Demo login accounts remain available; sessions reset on restart.
- Service-dependent routes receive a fresh request-local SQL catalog. Coordinate
  replacing that bridge as your feature begins querying PostgreSQL directly.

## Remaining ownership

| Member | Next work and integration details |
| --- | --- |
| 2: Auth/profiles | Persist credentials/profiles together in a transaction; retain salted scrypt password hashing, normalized unique emails, and user/admin roles. Persist SHA-256 bearer-token digests in sessions; enforce expiry/logout and update the identity resolver. Remove/replace transient startup auth seeds when ready. |
| 3: Queue | Persist joins/leaves/serve/complete operations against queues and queue_entries. Resolve queue ID from service_id, enforce open/closed status, and coordinate queue-row locks/transactions. Preserve queued/serving/served/left, service name/priority snapshots, timestamps, and one active visit per user. Use queue_positions for current order. |
| 4: Notifications/history/QA | Persist alerts with matching visit/user ownership. Set viewed/dismissed timestamps, retain dismissed rows, and preserve event deduplication. Query user_queue_history with authenticated user filtering. Coordinate atomic queue-event insertion with Member 3, run end-to-end checks, then regenerate final coverage and assemble the submission document. |

Future enhancements are outside this handoff; prioritize these assigned database
migrations and the final integrated test run before submission.

## Contribution summary for the group report

Diego (Member 1) designed and implemented the shared PostgreSQL schema with primary
and foreign keys, validations, indexes, timestamp triggers, queue-position and
history views; added configurable pooled connectivity and safe setup/demo commands;
migrated service list/create/update APIs to PostgreSQL with atomic service/queue
creation; integrated fresh service data into existing consumers; and supplied
database/API tests, coverage evidence, setup instructions, and schema documentation.

Code and documents are ready for Diego to review and commit. No commit, push, or
message to teammates was performed by the assistant. Coverage here is a Member 1
checkpoint snapshot; Member 4 must rerun it after the other feature migrations.
