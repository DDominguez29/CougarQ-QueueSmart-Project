# Wait-time estimation module

Own basic wait-time calculations here. Start with a pure function in `wait-time.service.ts` so queue routes can reuse it without another HTTP request.

Use the backend's ordered queue and the service's `expectedDurationMinutes`. Agree whether the displayed estimate means time until service starts or completes; document the formula and units. Avoid independent queue copies.

Place tests in `server/tests/wait-time.test.ts`.
