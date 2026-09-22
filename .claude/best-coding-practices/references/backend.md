# Backend — detailed reference

## Principles

**Layered architecture.** Controller (parses request, calls service, formats response) → service (business logic, the part worth unit testing) → repository (the only layer that talks to the database). When business logic lives in the route handler, it can't be tested without spinning up an HTTP server, and it tends to get duplicated the second time the same logic is needed from a job or a script.

**Multi-tenancy is a decision, not a default.** Three real options: shared database with a `tenantId` column on every row; schema-per-tenant; database-per-tenant. Shared-with-`tenantId` is usually right for SME SaaS/ERP scale — but it only works if tenant scoping is enforced at one central point (a Prisma middleware, a repository base class) rather than remembered by every individual query. A forgotten `WHERE tenantId = ?` is the single most common serious bug class in multi-tenant systems.

**Transactions around multi-step writes.** If "create an invoice" also deducts stock and writes a ledger entry, all three succeed or all three roll back — wrap them in one DB transaction. Partial writes from an unhandled error mid-sequence are a slow, quiet source of data corruption that's brutal to reconcile later.

**Idempotency for anything retriable.** Networks retry. A payment endpoint, an order-creation endpoint — anything a client might resend after a timeout — should accept an idempotency key, store the result against it, and return the cached result on a duplicate rather than reprocessing.

**Don't do slow work in the request cycle.** Bulk import, PDF generation, report building — hand it to a queue (BullMQ, Sidekiq, Celery) and return a job ID immediately. A slow synchronous endpoint isn't just bad UX, it ties up a connection/worker under load.

**Audit logging as infrastructure, not a per-feature afterthought.** Actor, action, entity, before/after — recorded centrally (a service-layer hook, not scattered `logger.info` calls) so every module gets it for free.

## Common anti-patterns

- Business logic in the route handler, making it untestable without an HTTP call
- Tenant scoping left to each individual query author to remember
- A "create order" flow where stock deduction and ledger write can partially fail independently
- A payment/order endpoint with no idempotency handling — double-submits create duplicates
- Report generation or bulk import running inline in a request, timing out or blocking the event loop
- Hard deletes on anything with financial or audit significance

## Checklist

- [ ] Business logic isolated in a service layer, independently testable
- [ ] Tenant scoping enforced centrally, not per-query
- [ ] Multi-step writes wrapped in a transaction
- [ ] Retry-sensitive endpoints support idempotency keys
- [ ] Slow work goes through a queue, not the request cycle
- [ ] Audit log captures create/update/delete centrally
- [ ] Soft deletes used for financially/legally significant records
- [ ] A `/health` endpoint exists and shutdown drains in-flight requests
