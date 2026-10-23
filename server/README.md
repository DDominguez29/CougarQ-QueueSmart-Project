# QueueSmart backend

Node.js + Express + TypeScript, with in-memory storage for Assignment 3. Administrator queue management, user history, and administrator reporting APIs are implemented. Authentication, user join/leave, and the other modules are separate team integration work. No real database is needed for A3.

## Run from the repository root

Use Node.js 22.18+ (the setup was verified with 22.20.0). Backend TypeScript runs directly in Node; use erasable syntax, explicit `.ts` import extensions, and `import type` for type-only imports. `typecheck:server` runs the separate TypeScript check.

```powershell
npm install
npm run dev:server
```

In another terminal:

```powershell
npm run dev
```

The API defaults to `http://127.0.0.1:3001`. Check `GET /api/health`; it returns `{"data":{"status":"ok"}}`. Vite proxies frontend requests beginning with `/api` to the backend, so frontend code should use relative URLs such as `fetch('/api/health')`.

Set `$env:PORT` to override the API port. If you change it, update the Vite proxy target too. Keep local configuration and credentials out of Git.

## Layout

```text
server/
  src/
    app.ts                Express setup and feature router registration
    index.ts              Starts the HTTP listener
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
npm run build
```

Tests exercise health/HTTP errors, queue ordering and transitions, history isolation, validation, permissions, and concurrent serve requests. Add tests as the remaining modules are implemented. A3 targets 70-80% backend coverage. The native coverage command is experimental in Node 22 and prints coverage for loaded source files to the terminal; the listener entry point is not part of this test report.

Run the full `npm run lint` before merging. The existing frontend currently has a Fast Refresh lint error in `src/context/NotificationContext.tsx`; it predates this scaffold.

## Authentication integration

`createApp(store, { resolveIdentity })` accepts the authentication module's server-side resolver. It receives an Express request and returns `{ userId, role: 'user' | 'admin' }` or `null` after verifying the session/token. Async resolvers are supported. The default is unauthenticated: protected endpoints return `401` until auth connects this resolver in `index.ts`. Header roles and body user IDs are never authentication.

The frontend API client (`src/api/client.ts`) sends same-origin cookies via `credentials: 'include'`. If auth uses bearer tokens, connect its token handling centrally in that client. The current frontend mock login does not authenticate backend requests. Test credentials exist only in test fixtures.

## Queue and history integration

See the queue/history module guides for endpoints. `src/pages/admin/QueueManagementPage.tsx` and `src/pages/user/HistoryPage.tsx` now read backend responses with loading, empty, and error states. The user dashboard links to history.

The store still starts empty. The service owner must populate `store.services`, and the join/leave owner must write `store.queueEntries`. Store UTC ISO dates, larger numeric priorities first, and unique participation IDs for every visit. Set the optional `serviceName` snapshot on join. Serve-next starts service (`serving`, `serviceStartedAt`); the separate completion endpoint finishes it (`served`, `completedAt`, and matching `endedAt`). A queued user leaving becomes `left` with `endedAt`. Retain all finished records for history/reports.

## Administrator reporting

`GET /api/admin/reports` powers `/admin/reports` and today's dashboard summary. It requires an administrator, defaults to today in America/Chicago, and accepts `startDate`, `endDate`, optional `serviceId`, and `page`. See `modules/reports/README.md` for definitions and examples. Reports use only backend participation records; restarting the in-memory server clears them. Authentication integration is still required for the normal browser flow.

