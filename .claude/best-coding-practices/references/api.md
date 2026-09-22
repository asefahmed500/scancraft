# API — detailed reference

## Principles

**Resource-based, not action-based.** `GET /invoices/:id`, not `POST /getInvoice`. Consistent nouns-as-resources makes the API predictable to a new consumer (including a future AI agent working against it) without reading every route individually.

**Version before you need to.** `/api/v1/` costs nothing on day one and saves a painful migration the first time a breaking change is needed against clients already in the field.

**Authorization is a server-side fact, not a UI convention.** Every route independently checks whether *this* user can do *this* action to *this* resource — never inferred from "the frontend only shows the button to admins." A direct API call bypasses the UI entirely.

**One error shape, everywhere.** `{ error: { code, message, field } }` (or your team's equivalent) on every endpoint. Inconsistent error shapes push the pain onto every frontend error handler, forced to special-case each route.

**Pagination matched to the data.** Cursor-based for large or frequently-changing tables (transactions, logs) — offset-based pagination degrades and can skip/duplicate rows under concurrent writes. Offset is fine for small, stable lists (roles, categories).

**Idempotency keys on retry-sensitive writes.** A client that times out and retries a `POST /payments` should not create a second payment. Accept an idempotency key, store the result, return the cached result on a repeat.

**CORS is a real security boundary, not boilerplate.** An explicit allowlist per environment. A wildcard `*` in production quietly allows any site to make authenticated requests on a logged-in user's behalf if cookies/credentials are involved.

## Common anti-patterns

- Verb-in-the-URL endpoints (`/getUser`, `/updateInvoice`) instead of resource + HTTP method
- No version prefix, discovered only when the first breaking change is needed
- Authorization only checked in the frontend, or only for the "obvious" routes
- A different error shape per route, or per developer who wrote it
- Offset pagination on a table with thousands of new rows per hour
- No idempotency handling on payment/order-creation endpoints
- CORS wildcard left in from local development

## Checklist

- [ ] Routes are resource-based and versioned
- [ ] Every route enforces authorization server-side, independent of the UI
- [ ] One consistent error response shape across the whole API
- [ ] Pagination style matches the table's size/volatility
- [ ] Idempotency keys supported on retry-sensitive writes
- [ ] CORS allowlist is explicit per environment, no wildcard in production
- [ ] Rate limiting on auth, bulk-export, and other expensive endpoints
- [ ] API contract (OpenAPI or equivalent) reflects the actual code, not stale docs
