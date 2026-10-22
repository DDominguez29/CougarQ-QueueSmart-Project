# Authentication module

Own registration, login, role handling, and authentication middleware here.

Suggested files as implementation begins: `auth.routes.ts`, `auth.service.ts`, and `auth.validation.ts`.

Use `/api/auth` as the route prefix. Provide a server-verified identity containing `userId` and `role` (`user` or `admin`) for protected modules. Queue/history routes must not trust a role or user ID supplied in the request body as authentication.

Coordinate the identity/middleware interface with queue and history before mounting protected routes. Add in-memory accounts/sessions to the shared store rather than creating a separate server. Place tests in `server/tests/auth.test.ts`.
