# Backend coverage evidence

Member 1 checkpoint snapshot, November 4, 2026 (America/Chicago).

| Measure | Result |
| --- | --- |
| Tests | 153 passed; 0 failed |
| Line coverage | 98.44% |
| Branch coverage | 96.79% |
| Function coverage | 97.30% |

Generated with Node v22.20.0 and an isolated PostgreSQL 18 test cluster.
The [captured terminal report](coverage-output.txt) contains test totals and the
per-file coverage table. This is a summary artifact, not a screenshot.

## Reproduce

Create a separate disposable PostgreSQL database, configure TEST_DATABASE_URL in
your ignored root .env, then run from the repository root:

```powershell
npm run test:coverage:db
```

The command combines regular unit/API tests and real PostgreSQL integration
tests. Integration tests create and remove a random test schema. They exercise
schema constraints, service permissions/validation, atomic service/queue creation,
fresh catalog reads, repeatable seeds, connectivity failures, shutdown, and
persistence across backend restarts. No application database tables are reset.

## Scope and limits

Coverage applies to loaded JavaScript/TypeScript backend sources under server/src.
The directly executed CLI/listener entry points (index.ts and database-cli.ts)
are not included in this report; schema SQL checks run as integration assertions
and do not have JavaScript line coverage. No frontend coverage is claimed.

Known uncovered paths are listed in the captured report, including some validation
branches and cleanup/error handlers. The current results exceed the assignment's
70-80% target for measured backend sources. Member 4 must regenerate the final
evidence after all teammates' database migrations are integrated; this snapshot
does not establish persistence for the remaining in-memory features.
