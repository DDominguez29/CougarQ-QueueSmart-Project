# Administrator reports

`GET /api/admin/reports` requires a verified administrator identity. The normal app remains protected with `401` until the team's authentication resolver is connected.

## Filters and response

- `startDate`, `endDate`: YYYY-MM-DD calendar dates, inclusive, at most 31 days. Omitted dates default to the current America/Chicago day. Supported years: 2000-2100.
- `serviceId`: optional service filter, including services retained in historical records.
- `page`: optional positive integer, default 1. Visit details use 25 rows per page; out-of-range pages clamp to the final page. All summaries always cover the full filtered period, irrespective of pagination.
- Duplicate query values, unknown filters, invalid dates/IDs, and excessive ranges return `400`. Unknown services return `404`. Missing authentication returns `401`; non-admin identities return `403`.

Example: `/api/admin/reports?startDate=2026-10-21&endDate=2026-10-22&serviceId=ctap&page=1`.

The `{ data }` envelope contains `timeZone`, resolved dates/service filter, `summary`, `days`, available `services`, paginated `visits`, `page`, `pageSize`, `totalVisits`, and `totalPages`. Empty days are included with zero counts and null average wait.

## Metric definitions

- **Served visits:** completed participation records (`status: 'served'`) whose `completedAt` falls within the selected store dates. Legacy records can use `endedAt` as their completion timestamp. Repeat visits count separately.
- **Unique people served:** distinct user IDs among those completed visits. This is deduplicated over the whole selected period, not summed from daily unique counts.
- **Average queue wait:** average of `(serviceStartedAt - joinedAt) / 60000` for those completed visits with valid chronological timestamps. This excludes time receiving service. Zero-minute waits are valid. Round only for display; period averages are computed from individual visits, not averages of daily averages.
- **Timing coverage:** `measuredWaitVisits` and `missingWaitVisits` explain the average's denominator. Legacy visits lacking start times still count as served but are excluded from wait averages. If no valid waits exist, the average is null, displayed as an em dash.
- **Left visits:** finished `left` records, grouped by `endedAt`. They appear in visit history and their own count, but are excluded from served counts, unique served people, and average wait. Queued/in-service visits are excluded from finished reports.

Days use America/Chicago, including daylight-saving changes. A visit belongs to its completion day even if it joined on the previous day. Store timestamps in UTC; never use the browser timezone to decide report dates. Records with no valid completion/end timestamp cannot be assigned to a report day.

America/Chicago is Houston's IANA timezone identifier. The frontend labels it **Houston time (Central)** and uses it for queue, personal history, dashboard, and report timestamps, even if the viewer's browser is set to another timezone. UTC storage is unchanged.

## Frontend

Admin navigation includes **Reports**. The page has date/service filters, the two main metrics plus unique people, a daily summary, timing-coverage text, and paginated visit details. The dashboard uses the same backend report for today's figures. Student history remains at `/history` and includes only that user's finished visits.

## Tests and integration

`server/tests/reports.test.ts` covers metric definitions, missing/invalid timing, empty days, weighted averages, service filters, pagination, Chicago midnight, daylight-saving transitions, and validation. API permission/filter tests are in `routes.test.ts`.

The queue module now uses `queued -> serving -> served`. Start service records `serviceStartedAt`; completion records `completedAt` and `endedAt`. The join/leave owner must retain participation records. Reports reset when this A3 in-memory server restarts; persistent storage belongs to the later database assignment.
