# QueueSmart backend

Node.js + Express + TypeScript, with in-memory storage for Assignment 3. This is the shared foundation; feature APIs and authentication are not implemented yet. No real database is needed for A3.

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

The initial tests exercise health and HTTP error behavior. Add unit tests for each module's business rules and validation as it is implemented. A3 targets 70-80% backend coverage; the starter HTTP tests alone do not demonstrate completed module coverage. The native coverage command is experimental in Node 22 and prints its report to the terminal.

Run the full `npm run lint` before merging. The existing frontend currently has a Fast Refresh lint error in `src/context/NotificationContext.tsx`; it predates this scaffold.

