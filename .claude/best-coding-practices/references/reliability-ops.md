# Reliability & Ops — detailed reference

## Principles

**Structured logs with context, from the start.** Every log line should carry tenant ID, user ID, and request ID as structured fields (not just embedded in a message string), using a real logging library (pino, winston) instead of `console.log`. This is the difference between "we can trace this production report to the exact request" and "we have no idea what happened."

**Secrets never touch the repo.** Environment variables or a secrets manager, always. If a key was ever committed — even once, even in a since-deleted commit — treat it as compromised and rotate it; git history keeps it forever.

**CI as a gate, not a suggestion.** Tests and lint run automatically on every PR, and merging is blocked on failure. A test suite that's optional to run gets skipped under deadline pressure, which is exactly when it's most needed.

**Stateless services.** Session data, in-memory caches, and job state that live only in one process instance break the moment you run two instances behind a load balancer, or restart during a deploy. Move that state to Redis or the database before scaling horizontally.

**A disaster recovery plan is only real once tested.** "We have backups" is not a plan. A plan says what's backed up, how often, the exact restore steps, and how long it actually takes — verified by doing it, not assumed.

**Config-driven design for anything reused across variants.** If the same codebase serves multiple product variants (different ERPs for different industries, for instance), field definitions, workflows, and permissions belong in config or a database table — not hardcoded per variant, which turns every change into a fork.

## Common anti-patterns

- `console.log` scattered through the codebase with no structure, no levels, no context
- An API key committed once, "removed" in a later commit, but still live in git history
- Tests that exist but aren't wired into CI, or CI that doesn't block merge on failure
- In-memory session/cache state that silently breaks the moment a second instance runs
- Backups configured and never restored, discovered to be broken only during a real incident
- Copy-pasting the whole codebase to support a new product variant instead of parameterizing it

## Checklist

- [ ] Logs are structured, leveled, and carry tenant/user/request context
- [ ] No secret has ever been committed (and none currently is)
- [ ] CI runs on every PR and blocks merge on failure
- [ ] No service holds state that would break running multiple instances
- [ ] A disaster recovery plan exists and has actually been exercised once
- [ ] Security headers (CSP, HSTS) are set; an OWASP Top 10 pass has been done
- [ ] Shared logic across product variants lives in config, not forked code
