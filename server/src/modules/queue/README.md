# Queue management module

This module is shared between the user join/leave owner and Diego Dominguez (administrator view/serve next).

Suggested files: `queue.routes.ts`, `queue.service.ts`, and `queue.validation.ts`. Keep user join/leave handlers and admin handlers in separate files if two people are implementing them at the same time; both must call the same queue service and use the same store.

Proposed endpoints (not implemented yet):

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/services/:serviceId/queue` | Administrator views a service's waiting queue |
| POST | `/api/services/:serviceId/queue` | Authenticated user joins |
| DELETE | `/api/queue/:entryId` | Owner leaves a waiting entry |
| POST | `/api/services/:serviceId/queue/serve-next` | Administrator serves the next entry |

Initial shared contract: higher numeric priority first, then arrival time. Status values are `queued`, `served`, and `left`; dates are UTC ISO strings. Priority must be determined by backend rules. Confirm these rules against A1 with the team before implementing them.

Retain served/left entries in `store.queueEntries` for the history module. Every join must get a new entry ID. Serving next must select and update on the server, not accept the next user chosen by the frontend. Authentication and service existence checks are required when the routes are implemented.

Place tests in `server/tests/queue.test.ts`. Include empty queues, ordering, repeated requests, validation, permissions, and history updates.
