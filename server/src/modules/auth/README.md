# Authentication module

Owner: Denzel.

Handles registration, login, sessions, and role checks. Passwords are hashed with scrypt; sessions are random bearer tokens kept in the shared store for 8 hours.

## Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | None | Create a student account (`fullName`, `email`, `password`) |
| POST | `/api/auth/login` | None | Returns `{ token, user }` |
| GET | `/api/auth/me` | Bearer token | Current user |
| POST | `/api/auth/logout` | Bearer token | Ends the session |

Registration only accepts `@cougarnet.uh.edu` emails and always creates the `user` role. Admin accounts come from `data/seed.ts`.

Demo accounts: `student@cougarnet.uh.edu` / `Cougar123` and `admin@uh.edu` / `Admin123`.

## Protecting your routes

```ts
import { getAuth, requireAuth, requireRole } from '../auth/auth.middleware.ts';

router.post('/:serviceId/queue', requireAuth(store), (request, response) => {
  const { userId } = getAuth(response);
  // ...
});

router.post('/:serviceId/queue/serve-next', requireAuth(store), requireRole('admin'), handler);
```

`getAuth(response)` returns the server-verified `{ userId, role }`. Never read the user ID or role from the request body.

For modules that use `middleware/identity.ts`, pass the resolver into the app:

```ts
import { createIdentityResolver } from './modules/auth/auth.middleware.ts';

createApp(store, { resolveIdentity: createIdentityResolver(store) });
```

It returns `{ userId, role }` for a valid token and `null` otherwise.

On the frontend, the login token is saved by `src/api/session.ts`. Any request to a protected endpoint needs `...authHeaders()` added to its headers.

Tests: `server/tests/auth.test.ts`.
