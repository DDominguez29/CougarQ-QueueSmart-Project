# Wait-time estimation module

Owner: Denzel.

## Formula

Each service has its own line and an expected time per person. The estimate is that time multiplied by the number of people ahead in the same line. It means time until the person **starts** being served.

| Service | Minutes per person |
| --- | --- |
| CTAP Main Lane | 5 |
| CTAP Express (1 book or material) | 2 |
| Support Table Help Desk | 4 |

Example: 3 people are ahead of you in CTAP Main Lane, so your wait is 3 × 5 = 15 minutes.

Line order is higher priority first, then earlier `joinedAt`. An entry is `almost-ready` when 2 or fewer people are ahead. The minutes come from each service's `expectedDurationMinutes`, so admins can change them in Service Management. Demo services and a sample queue of students are seeded in `data/seed.ts`.

## Endpoints (sign in required)

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/api/wait-time/services` | Estimate for every service (join screen) |
| GET | `/api/wait-time/services/:serviceId` | `peopleAhead`, `estimatedWaitMinutes`, `serviceMinutes` for someone about to join |
| GET | `/api/wait-time/entries/:entryId` | `position`, `peopleAhead`, `estimatedWaitMinutes`, `stage` (owner or admin only) |

## Reusing it in other modules

Import from `wait-time.service.ts` instead of calling the endpoints:

- `getWaitingLine(store, serviceId)` and `compareQueueEntries` for the shared line order
- `estimateForEntry(store, entryId)` for position and stage (useful for near-turn notifications)

Tests: `server/tests/wait-time.test.ts`.
