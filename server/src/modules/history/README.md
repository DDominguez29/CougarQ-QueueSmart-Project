# History module

Owner: Diego Dominguez.

Implemented endpoint: `GET /api/history/me`. Requires authentication and returns `{ data: HistoryItem[] }`. No query parameters or client-supplied user ID are accepted. Administrators can also view their own participation history; this endpoint never grants access to another user's records.

History reads the same `store.queueEntries` used by queue operations. It includes finished visits (`served` and `left`), newest completion first. Active entries remain on queue status screens. Repeated visits are separate records. Records without a legacy end time fall back to arrival time for sorting.

Each item includes entry/user/service IDs, priority, arrival time, status, service start/completion/end times, service name, and `waitMinutes` (null when unavailable or not served). Prefer the saved `serviceName` snapshot, then the current service name; missing services remain readable. A visit currently `serving` is not finished history. Only the completion action moves it into served history. The join/leave owner should retain left entries and record their end times.

The administrator's separate `/admin/reports` page uses the reports module to aggregate all users' finished visits under administrator permissions. The student `/history` page remains limited to that student's own records.

The frontend `/history` page calls this API and handles loading, empty history, and errors. Authentication must connect the resolver in `createApp`; frontend mock login alone does not establish a backend identity.

Tests: `server/tests/history.test.ts` and `server/tests/routes.test.ts`.
