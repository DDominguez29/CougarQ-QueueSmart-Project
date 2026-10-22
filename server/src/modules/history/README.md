# History module

Owner: Diego Dominguez.

Suggested files: `history.routes.ts` and `history.service.ts`.

Proposed endpoint (not implemented yet): `GET /api/history/me`, using the authenticated identity rather than a client-supplied user ID.

Read participation records from the same `store.queueEntries` used by join/leave/serve operations. The initial model keeps active and finished records; agree whether the history screen shows only finished visits or also the current visit. Include service information, timestamps, and the participation outcome. Never remove served/left entries from the store.

Place tests in `server/tests/history.test.ts`. Cover user isolation, empty history, ordering, repeated visits, and updates after leaving or being served.
