# QueueSmart backend

Node.js + Express + TypeScript. PostgreSQL stores accounts, profiles, sessions, services, queues, visits, and notifications. User history and administrator reports derive from retained visits. Visits, alerts, and viewed/dismissed state survive backend restarts. See the [project setup](../README.md#getting-started).

## Run from the repository root

Use Node.js 22.18+ (the setup was verified with 22.20.0). Backend TypeScript runs directly in Node; use erasable syntax, explicit `.ts` import extensions, and `import type` for type-only imports. `typecheck:server` runs the separate TypeScript check.

```powershell
npm install
# Only if .env does not already exist: Copy-Item .env.example .env
# Edit .env with your PostgreSQL connection settings before continuing.
npm run db:check
npm run db:setup
# Optional for an empty catalog: npm run db:seed
npm run dev:server
```

In another terminal:

```powershell
npm run dev
```

The API defaults to `http://127.0.0.1:3001`. Check `GET /api/health`; it returns `{"data":{"status":"ok"}}`. Vite proxies frontend requests beginning with `/api` to the backend, so frontend code should use relative URLs such as `fetch('/api/health')`.

`GET /api/health/db` verifies live PostgreSQL connectivity. Startup requires DATABASE_URL and a working database; it does not automatically apply SQL or write demo seeds into PostgreSQL. If `.env` already exists, edit it instead of copying over it.

Set `$env:PORT` to override the API port. If you change it, update the Vite proxy target too. Keep local configuration and credentials out of Git.

## Layout

```text
server/
  src/
    app.ts                Express setup and feature router registration
    index.ts              Startup configuration and shutdown signals
    start.ts              Database check and HTTP server lifecycle
    data/database.ts      Shared PostgreSQL pool and schema setup
    data/schema.sql       PostgreSQL tables, constraints, and views
    data/store.ts         Shared in-memory collections and store factory
    shared/models.ts      Initial service and queue contracts
    shared/ApiError.ts    Common HTTP error
    middleware/errors.ts JSON error handling and unknown-route response
    modules/
      auth/
      services/
      queue/
      wait-time/
      notifications/
      history/
      reports/
  tests/                  Backend tests
  tsconfig.json
```

Each module README defines scope and suggested filenames. Create files when implementing behavior, rather than adding empty controllers. Keep HTTP parsing/response logic in routes, business rules in services, and shared storage in `data/`.

## Team integration rules

- One app and one shared store per server instance. Router factories receive the same store from `createApp`; tests can supply a fresh `createStore()`.
- Success responses use `{ data: ... }`. Errors use `{ error: { code, message } }`; throw `ApiError` for expected failures.
- Use `400` for invalid input, `401` for missing/invalid authentication, `403` for forbidden operations, `404` for missing resources, and `409` for state conflicts.
- Validate required fields, types, and lengths on the backend. TypeScript types do not validate incoming JSON.
- The store starts empty. Add deterministic demo seeds in `data/` when features need them; do not copy frontend mock arrays into separate module stores.
- History and queue use the same participation records. Keep terminal entries so repeated visits and outcomes remain available.
- Shared models and proposed endpoint paths are starting contracts, not completed feature implementations. Confirm A1 lifecycle/priority rules and coordinate changes with affected teammates.
- Auth must supply server-verified user IDs and roles. No protected feature endpoint should ship with client-controlled identity or an admin bypass.
- Change shared setup files together; implement most work within your own module. Keep meaningful commits under your own account.

## Checks

```powershell
npm run typecheck:server
npm run lint:server
npm test
npm run test:coverage
# With a separate TEST_DATABASE_URL configured:
npm run test:coverage:db
npm run build
```

Tests exercise health/HTTP errors, queue ordering and transitions, history isolation, validation, permissions, and concurrent serve requests. Add tests as the remaining modules are implemented. A3 targets 70-80% backend coverage. The native coverage command is experimental in Node 22 and prints coverage for loaded source files to the terminal; the listener entry point is not part of this test report.

The combined database coverage command adds real SQL setup, constraints, queue lifecycle/concurrency, persistence, and seed tests. See the current [coverage evidence](../docs/coverage.md). Rerun after source changes before capturing submission results.

Run the full `npm run lint` before merging. The old browser-only notification context has been removed; user pages use the authenticated backend instead.

## Authentication integration

`createApp(store, { resolveIdentity })` accepts an optional server-side identity resolver for tests. Normally it builds a resolver from the account repository, using PostgreSQL when a database pool is provided and memory for database-free tests. The resolver returns `{ userId, role: 'user' | 'admin' }` or `null` after verifying the session/token. Async resolvers are supported. Header roles and body user IDs are never authentication.

The frontend API client (`src/api/client.ts`) sends the login bearer token from `src/api/session.ts` and uses relative `/api` URLs through the Vite proxy. `npm run db:seed` adds the demo accounts `student@cougarnet.uh.edu` / `Cougar123` and `admin@uh.edu` / `Admin123`. Accounts, profiles, and sessions are stored in PostgreSQL; sessions expire after eight hours and survive backend restarts.

Frontend login, registration, and logout requests live in `src/api/auth.ts`. The shared Sign out button calls the logout endpoint and clears the browser session. User pages share `UserHeader.tsx`; administrator pages, including Services, share `AdminHeader.tsx`.

## Queue and history integration

See the queue/history module guides for endpoints. `src/pages/admin/QueueManagementPage.tsx` and `src/pages/user/HistoryPage.tsx` now read backend responses with loading, empty, and error states. The user dashboard links to history.

Production queue routes use the PostgreSQL repository; database-free unit tests retain the memory-backed adapters. Visits have UTC timestamps, service-controlled priorities, unique IDs, and service-name snapshots. Serve-next starts service (`serving`, `serviceStartedAt`); completion finishes it (`served`, `completedAt`, and matching `endedAt`). A queued user leaving becomes `left` with `endedAt`. Completed and canceled visits stay in PostgreSQL across restarts, with no automatic expiration. History filters those retained records by the authenticated user.

## Notifications

`server/src/modules/notifications/` provides authenticated list, dismissal, and viewed-state routes backed by PostgreSQL in production. Queue joins save confirmations and check the first two waiting visits for readiness alerts. Leaving and starting service update those readiness alerts. Event insertion and queue mutations commit or roll back together; all use the same transaction client. Unique event keys prevent duplicates even after dismissal or restart. The page polls every five seconds and marks displayed alerts as viewed. Memory-backed adapters remain for database-free tests; no separate notification server is required.

## Administrator reporting

`GET /api/admin/reports` powers `/admin/reports` and today's dashboard summary. It requires an administrator, defaults to today in America/Chicago, and accepts `startDate`, `endDate`, optional `serviceId`, and `page`. See `modules/reports/README.md` for definitions and examples. Production reports load retained PostgreSQL visits on each request; a backend restart does not erase them. Select a date range covering older visits to include them in later reports.

