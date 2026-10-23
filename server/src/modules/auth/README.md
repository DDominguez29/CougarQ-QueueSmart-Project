# Authentication module

Own registration, login, role handling, and authentication middleware here.

Suggested files as implementation begins: `auth.routes.ts`, `auth.service.ts`, and `auth.validation.ts`.

Use `/api/auth` as the route prefix. Provide a server-verified identity containing `userId` and `role` (`user` or `admin`) for protected modules. Queue/history routes must not trust a role or user ID supplied in the request body as authentication.

Coordinate the identity/middleware interface with queue and history before mounting protected routes. Add in-memory accounts/sessions to the shared store rather than creating a separate server. Place tests in `server/tests/auth.test.ts`.

Queue/history now use `createApp(store, { resolveIdentity })`. Implement this server-side resolver and pass it from `index.ts`; its type is exported from `middleware/identity.ts`. It receives the Express request and returns a verified `{ userId, role }` or `null`, synchronously or asynchronously. The default denies protected requests with `401`. Do not pass through `X-Role`, a body user ID, or an unverified token payload.

The frontend API client sends cookies with `credentials: 'include'`. If using bearer tokens, add your token handling in `src/api/client.ts`. Coordinate this shared client change with the queue/history owner.

## Integration handoff for queue, history, and reports

The frontend currently uses `findAccount` from `mockAuth.ts` and only navigates after a demo login. It creates no backend session/token. `index.ts` currently calls `createApp()` without an identity resolver, so protected API requests return `401 UNAUTHENTICATED` and the UI displays "Sign in to continue."

The authentication owner needs to deliver:

1. A working backend login endpoint (suggested `POST /api/auth/login`) that verifies credentials and establishes an authenticated session or issues a verified token. Include an administrator test account and a user test account.
2. Frontend login integration: replace the browser-only `findAccount` check with that API call and complete authentication before navigating. A session cookie fits the current API client; if using bearer tokens, attach `Authorization: Bearer ...` centrally in `src/api/client.ts` on subsequent requests.
3. An exported `IdentityResolver` compatible with `middleware/identity.ts`. It receives an Express request, verifies the session/token, and returns `{ userId: account.id, role: 'user' | 'admin' }`, or `null` for missing, expired, or invalid authentication. Async resolvers are supported. The ID and role must come from verified backend account/session data.
4. Startup integration in `index.ts`: create one shared store and call `createApp(store, { resolveIdentity })` using the resolver bound to that store. Mount the authentication routes in `app.ts` as needed. Do not create a second unrelated store for queue users or sessions.
5. Stable IDs and exact role values: login's user ID must match `QueueEntry.userId`. Administrators need `role: 'admin'` for queue actions and reports; users use `role: 'user'` and can read only their own history.

After integration, verify: administrator login -> queue/reports return 200; student login -> own history returns 200 and administrator endpoints return 403; no/expired session -> protected endpoints return 401; refreshing the browser retains a valid session. In-memory server restarts may clear accounts/sessions for A3.

Service creation and user join/leave must also populate the shared store for visible queue/report data. Successful authentication grants access; it does not itself create participation records.
