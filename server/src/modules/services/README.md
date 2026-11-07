# Service management module

Own service creation, updates, listing, field validation, and the shared service repository here.

`services.repository.ts` provides PostgreSQL storage in production and an explicit memory adapter for unit tests. Routes validate and authorize writes before invoking it. SQL uses parameters and maps database columns to the existing camelCase API fields.

Endpoints: public `GET /api/services`, admin-only `POST /api/services`, and admin-only `PUT /api/services/:id`. Creating a service atomically creates its open queue. Updating it preserves its ID and queue state. Expected duration supports positive fractional minutes; priority is an integer from 0 to 2147483647, with larger values first. Missing IDs return 404.

`services.catalog.ts` loads a fresh PostgreSQL service and visit snapshot for wait-time/history/report routes. Production queue operations use the PostgreSQL queue repository directly. Production does not keep a second mutable service catalog or seed it on startup. Service IDs are UUIDs; `npm run db:seed` supplies repeatable example services without overwriting edits.

Unit API tests: `server/tests/services.test.ts`. Real PostgreSQL service/queue transaction and restart tests: `npm run test:db`. See the [project README](../../../../README.md) for setup and tests.
