---
name: "best-coding-practices"
description: Enforces production-grade coding practices — security, validation, database integrity, API design, reliability, monitoring/logging, testing, and SEO/AEO/GEO — whenever starting a new project, a new module, or any request where correctness, security, or scalability matters beyond a one-off script. Always consult this skill when kicking off a PRD-based build, adding a module to an existing ERP/SaaS, reviewing or hardening an existing codebase, or when the user asks for "best practices", "production-ready", "secure", "scalable", or "stable" code — even if they don't name this skill directly. Applies to any stack; tool names inside are examples, not requirements.
---

# Best Coding Practices — Project Standard

Use this whenever the work has real stakes: a new project built from a PRD, a new module added to an existing system, or an audit of something already live. Skip it for trivial one-off scripts or a single-line fix — match the weight of this process to the size of the ask.

## Workflow

1. **Understand before building.** Read whatever context exists — PRD, README, existing code, prior conversation. Observe the actual stack from real files/dependencies rather than assuming one. If genuinely unclear, ask one targeted question rather than guessing.
2. **Load only the reference files relevant to the task** (see table below) — don't load all nine for a small change. Each reference file has principles, common anti-patterns, and a checklist for that layer.
3. **Apply while building, not after.** Validation, auth checks, and error handling belong in the first draft of a route, not a later pass.
4. **State what you skipped and why**, and flag anything you couldn't confidently resolve instead of guessing and presenting it as fact.
5. **Every tool name in the reference files is an example.** Use whatever equivalent this project's actual stack already has (a different ORM, framework, logger, queue, monitoring platform); only introduce something new if there's genuinely no equivalent.

## Reference files — load what's relevant

| File | Load it when the task touches… |
|---|---|
| `references/frontend.md` | UI components, forms, client-side state, tables/lists, accessibility |
| `references/backend.md` | Route handlers, services, multi-tenancy, transactions, background jobs, audit logging |
| `references/database.md` | Schema design, migrations, indexing, locking, ledgers, backups |
| `references/api.md` | Route design, versioning, authorization, pagination, error shape, CORS |
| `references/validation.md` | Form/API input validation, file uploads, config validation |
| `references/reliability-ops.md` | Logging infra, secrets, CI/CD, horizontal scaling, disaster recovery, config-driven design |
| `references/monitoring-logging.md` | Error tracking, APM, uptime checks, alerting, dashboards — includes a platform quick-reference table (free vs. paid tools) |
| `references/testing.md` | Unit/integration/E2E strategy, contract tests, regression tests, test data |
| `references/seo-aeo-geo.md` | Public-facing pages: traditional SEO, answer-engine and generative-engine optimization, llms.txt |

For a full new project or a "review this system" request, work through all nine. For a scoped task (e.g. "add a search endpoint"), load only the 2–4 files that actually apply — typically `api.md` + `validation.md` + whichever of `backend.md`/`database.md` is relevant.

## Definition of done, for anything non-trivial this skill touches

- [ ] Inputs validated at the API boundary with a schema, not just trusted from the frontend
- [ ] Authorization checked server-side for the specific action, not inferred from what the UI shows
- [ ] Errors handled with a consistent shape; nothing throws an unhandled exception to the user
- [ ] Multi-step writes that must succeed together are wrapped in a transaction
- [ ] At least one test covers the actual business logic, not just that the function runs
- [ ] Logs include enough context (tenant/user/request ID) to debug a production report
- [ ] No secret, key, or credential is hardcoded or committed
- [ ] Anything skipped from this checklist is named explicitly, with the reason

## When context is thin

If there's no PRD, no existing code, and no stated stack — don't stall. State the assumption you're proceeding with (a reasonable default stack, a reasonable scope), build against it, and note the assumption up front so it's easy to correct.
