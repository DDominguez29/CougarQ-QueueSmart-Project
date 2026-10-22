# Service management module

Own service creation, updates, listing, and field validation here.

Suggested files: `services.routes.ts`, `services.service.ts`, and `services.validation.ts`.

Use `/api/services` as the route prefix. Use `Service` from `shared/models.ts` and the shared store's `services` map. Expected duration is measured in minutes; priority is a number with larger values ranked first. Coordinate changes to IDs and priority rules with the queue/wait-time owners.

Place tests in `server/tests/services.test.ts`.
