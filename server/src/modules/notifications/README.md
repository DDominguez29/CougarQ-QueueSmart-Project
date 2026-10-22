# Notification module

Own backend notification creation on queue join and when a user is near their turn. Email/SMS delivery is not required for A3.

Suggested files: `notifications.routes.ts` and `notifications.service.ts`. Use `/api/notifications` if notifications are exposed through an endpoint.

Coordinate calls from the shared queue service. Add notification storage to the shared store if needed; filter results using the authenticated user. Agree on the near-turn threshold and avoid generating duplicate notifications for the same transition.

Place tests in `server/tests/notifications.test.ts`.
