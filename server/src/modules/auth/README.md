# Authentication module

Owner: Denzel.

Handles registration, login, profiles, sessions, and role checks. Accounts and sessions are stored in PostgreSQL:

| Table | What it holds |
| --- | --- |
| `user_credentials` | ID, normalized unique email, salted scrypt password hash, role (`user` / `admin`) |
| `user_profiles` | Full name and optional phone, one row per account |
| `sessions` | SHA-256 digest of each login token, owner, and 8-hour expiry |

Registration writes the credentials and profile rows in one transaction, so a failed profile insert never leaves an account behind. The raw login token is only returned to the browser; the database keeps its digest. Logging out deletes the session row, and expired sessions are rejected and removed on their next use. Sessions survive a backend restart.

## Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | None | Create a student account (`fullName`, `email`, `password`, optional `phone`) |
| POST | `/api/auth/login` | None | Returns `{ token, user }` |
| GET | `/api/auth/me` | Bearer token | Current user and profile |
| POST | `/api/auth/logout` | Bearer token | Ends the session |

Registration only accepts `@cougarnet.uh.edu` emails and always creates the `user` role. Duplicate emails return `409 EMAIL_TAKEN` regardless of capitalization.

## Demo accounts

Run `npm run db:seed` once to add `student@cougarnet.uh.edu` / `Cougar123` and `admin@uh.edu` / `Admin123`. Running it again keeps existing accounts and passwords unchanged.

## Using the signed-in user in other modules

`createApp` installs the identity resolver automatically. Routes mounted after it read the verified user with:

```ts
import { getIdentity, requireAdministrator, requireIdentity } from '../../middleware/identity.ts';

const actor = requireIdentity(getIdentity(response)); // { userId, role, name }
requireAdministrator(getIdentity(response));
```

`name` is the user's full name from `user_profiles`. Never read the user ID or role from the request body.

Code is in `auth.repository.ts` (PostgreSQL and in-memory versions), `auth.service.ts`, `auth.middleware.ts`, and `auth.routes.ts`.

Tests: `server/tests/auth.test.ts` (no database needed) and `server/tests/auth.integration.ts` (`npm run test:db`).
