# PostgreSQL setup

Run these commands from the QueueSmart repository root with Node.js 22.18+.
Use PostgreSQL 14+; the local development installation is PostgreSQL 18.

Related references: [schema/data dictionary](database-schema.md),
[service APIs](service-api.md), [team handoff](member1-handoff.md), and
[coverage evidence](coverage.md).

## Configure the connection

Create an empty database in pgAdmin if one does not exist. Open the registered
server's Properties > Connection to find the host, port, and PostgreSQL username.
The server display name and maintenance database are not the application database.

For a new checkout:

```powershell
npm install
Copy-Item .env.example .env
```

Edit `.env` locally. For the current local database, use:

```dotenv
DATABASE_URL=postgresql://postgres:CHANGE_ME@localhost:5432/CougarQ%20QueueSmart
PORT=3001
```

Replace `CHANGE_ME` with the PostgreSQL password, URL-encoding special characters
in it. For example, `@` becomes `%40`, `#` becomes `%23`, and `%` becomes `%25`.
The database name `CougarQ QueueSmart` contains a space, represented by `%20`.
Use the actual name shown under pgAdmin's Databases, including capitalization.
Do not commit `.env`; Git already ignores it. `.env.example` has no real password.
The npm backend/database commands load the root `.env`. Explicit environment
variables take precedence over the file.

## Verify and initialize

```powershell
npm run db:check
npm run db:setup
# Optional: add the three demo services without overwriting existing edits.
npm run db:seed
npm run dev:server
```

- `db:check` runs a real PostgreSQL query and closes its connection pool.
- `db:setup` applies `server/src/data/schema.sql` to an empty database. If all seven
  tables and both views already exist, including a schema run through pgAdmin, it
  leaves them and their data unchanged. A partial installation fails for inspection;
  setup never drops or resets tables. This is a bootstrap command, not a migration
  system or a full structural audit of an existing schema.
- Startup verifies PostgreSQL connectivity before accepting HTTP requests. It
  does not automatically initialize or seed the PostgreSQL database.
- `db:seed` inserts CTAP Main Lane, CTAP Express, and Support Table Help Desk with
  fixed UUIDs and matching queues. Running it again preserves edited service
  values and queue status. The older string IDs remain only in A3 test fixtures.
- Ctrl+C stops HTTP and closes the shared connection pool. Future modules should
  receive this same pool; do not create a pool per request.

The backend listens at `http://127.0.0.1:3001` unless PORT is changed. The frontend
still starts separately with `npm run dev`.

`GET /api/health` is the existing liveness endpoint. `GET /api/health/db` runs a new
database query and returns:

```json
{"data":{"status":"ok","database":"connected"}}
```

If PostgreSQL becomes unavailable, database health returns HTTP 503 with
`DATABASE_UNAVAILABLE`, without exposing credentials or connection details.

## Current migration boundary

Service listing, creation, and updates now read/write PostgreSQL. Creating a
service also creates its queue in the same atomic SQL statement. Restarting the
backend preserves services and their edits; startup does not overwrite them.

Queue, wait-time, history, and report routes load a fresh PostgreSQL service
catalog for each request. The catalog is a temporary read snapshot for their
existing synchronous calculations, not another persistent service store. Those
routes share the existing in-memory visit/auth/notification records while the
other members migrate their assigned features. The service repository never
writes a parallel in-memory copy in production.

Accounts, sessions, queue participation, notifications, history records, and report
data are still transient. Startup keeps the two existing demo login accounts,
but no longer invents demo service or visit records on every restart. Log in again
after restarting until Member 2 implements session persistence. Use `db:seed` or
the administrator's Service Management form to populate an empty service catalog.

Member 3 still owns SQL-backed joining/leaving/serving and enforcement of queue
open/closed state. This change creates the queue records that migration needs.

## Tests

```powershell
npm test
npm run lint
npm run build
```

Regular unit tests do not require a PostgreSQL server. For real database tests,
create a separate disposable database such as `queuesmart_test`, then add this
to `.env` using your own password:

```dotenv
TEST_DATABASE_URL=postgresql://postgres:CHANGE_ME@localhost:5432/queuesmart_test
```

```powershell
npm run test:db
# Unit and PostgreSQL tests together, with backend coverage:
npm run test:coverage:db
```

The database test command requires TEST_DATABASE_URL explicitly. It creates a
random isolated schema, tests connection/setup, the schema constraints/views,
startup, health failures, service permissions/validation, atomic service/queue
creation, repeated seeds, and service persistence across restarts, then removes
that test schema. The test account needs permission to create schemas in the disposable database. It never
defaults to DATABASE_URL or drops existing application tables.

To run the schema-only SQL checks through pgAdmin, open `server/tests/schema.test.sql`
in a disposable database where the schema was already installed. The test fixture
rows are rolled back; identity sequences may advance.

## Troubleshooting

- Missing DATABASE_URL: create/edit the root `.env` and restart the backend.
- Connection refused: check PostgreSQL is running and that host/port match pgAdmin.
- Authentication failed: use the PostgreSQL account password, not pgAdmin's master
  password. Check password URL encoding.
- Database does not exist: check the name and capitalization under Databases in
  pgAdmin. The backend does not create databases.
- Existing partial schema: inspect the objects rather than rerunning SQL blindly.
- Pool/query failures time out rather than keeping a request open indefinitely.
  TLS options, when needed for a hosted server, belong in the connection URL;
  certificate verification is not disabled by the application.
