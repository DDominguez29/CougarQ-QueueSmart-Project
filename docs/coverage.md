# Backend coverage evidence

Checkpoint coverage refresh, November 6, 2026 (America/Chicago).

| Measure | Unit/API (`test:coverage`) | Combined PostgreSQL (`test:coverage:db`) |
| --- | --- | --- |
| Tests | 174 passed; 0 failed; 0 skipped | 209 passed; 0 failed; 0 skipped |
| Line coverage | 94.61% | 99.19% |
| Branch coverage | 96.09% | 96.32% |
| Function coverage | 95.63% | 96.43% |

Generated with Node v22.20.0 and PostgreSQL 18. The latest combined run used the
separate local `queuesmart_test` database, configured through TEST_DATABASE_URL
in the ignored .env file. Each integration suite created and removed its own
isolated schema. The application database and DATABASE_URL were unchanged.
The [captured terminal report](coverage-output.txt) contains test totals and the
per-file coverage table. This is a summary artifact, not a screenshot.

## Reproduce

For backend unit/API coverage without a database, run from the repository root:

```powershell
npm run test:coverage
```

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

The notification integration test now follows the `*.integration.ts` filename
convention, so both `test:db` and `test:coverage:db` discover it. It creates its
own schema and does not need tables preinstalled in the test database.

## Coverage changes

The earlier unit/API run measured 63.03% line coverage because the new PostgreSQL
queue implementation was loaded but not exercised. Added database-free tests
cover repository results, identity and role checks, input validation, queue
state changes, transaction commit/rollback, and release of transaction clients.
Additional tests cover SQL notification routes and fresh service/visit snapshots.
The queue router accepts an optional repository for tests; production still
constructs the same PostgreSQL repository by default. No source files were
excluded from the existing coverage configuration to increase the percentage.

Database-free adapters verify application decisions; the separate PostgreSQL
tests execute actual SQL, enforce constraints, and check concurrent operations.
The application notification integration test uses real authentication and queue
HTTP routes to verify join/readiness alerts, ownership, viewed state, persistence
across server restarts, dismissal/deduplication, alerts for fresh visits, and
atomic rollback when notification storage fails. Lint and the production build
also pass for this version.

## Scope and limits

Coverage applies to loaded JavaScript/TypeScript backend sources under server/src.
The directly executed CLI/listener entry points (index.ts and database-cli.ts)
are not included in this report; schema SQL checks run as integration assertions
and do not have JavaScript line coverage. No frontend coverage is claimed.

Known uncovered paths are listed in the captured report, including some validation
branches and cleanup/error handlers. Rerun after further source changes before
using the report in the submission. Production notification routing and queue
events now share the PostgreSQL repository; this connection is covered by the
application integration test. The existing Start next user workflow is unchanged;
a separate call-to-window state is outside this checkpoint change.

The November 4 Member 1 snapshot (153 tests, 98.44% line coverage) covered an
earlier code version; use the refreshed results above for this code version.
