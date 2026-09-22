# Testing — detailed reference

## Principles

**Prioritize by consequence, not by coverage percentage.** Unit test business logic with real stakes — invoice totals, tax math, stock deduction, payroll calculations — where a bug means wrong money or wrong data. A 100%-coverage mandate on trivial CRUD wrapper code is effort spent where it matters least.

**Integration tests for the flows that actually break.** One good integration test covering "order → invoice → payment" end to end, hitting a real test database, catches more real bugs than ten narrow unit tests mocking every dependency. Reserve a thin layer of full E2E browser tests (Playwright) for the handful of flows that would be genuinely catastrophic if broken — login, checkout — not every screen.

**Contract testing prevents silent breakage between frontend and backend.** If a backend response shape changes and nothing catches it until a user sees a broken UI, a contract test (built from the shared schema, or Pact) would have failed CI first.

**Test the unhappy paths on purpose.** Invalid input, expired auth, insufficient permission, a concurrent edit — these are usually undertested compared to the success path, and they're where real bugs live.

**Realistic test data surfaces real bugs.** A test suite running against 5 seeded rows won't catch an N+1 query problem or a pagination bug that only appears at 10,000 rows. Build a factory/seed script that generates realistic, varied data.

**Write the regression test when you fix the bug, not "later."** This is the single highest-ROI testing habit — it directly targets your actual historical failure modes rather than a generic guess at what might break.

**Mutation testing checks whether your tests actually catch anything.** A test suite with high line coverage can still pass unchanged when the underlying logic is subtly broken. Tools like Stryker introduce small deliberate bugs and check whether any test fails — if none do, that's a coverage gap disguised as coverage.

**Staging that doesn't match production gives false confidence.** A test suite that's green on staging and breaks on deploy usually means staging has drifted — different Postgres version, missing env var, smaller data volume, a feature flag left on.

## Common anti-patterns

- Chasing 100% line coverage on simple getters/setters while critical financial logic has none
- E2E tests written for every screen, making the suite slow and brittle without proportionate value
- No contract test — a backend refactor silently breaks the frontend, caught only in staging or worse
- Tests written only for the success path, none for invalid input or permission failures
- An empty or near-empty test database, hiding N+1 and pagination bugs until production
- A bug fixed with no regression test — the same bug reappears months later
- Staging drift (different DB version, different config) making passing tests unreliable evidence

## Checklist

- [ ] Unit tests exist for logic with real financial/data consequences
- [ ] At least one integration test per critical multi-step flow
- [ ] Contract tests (or a shared schema) catch frontend/backend shape mismatches
- [ ] Unhappy paths (bad input, expired auth, no permission) are explicitly tested
- [ ] Test data reflects realistic volume and variety, not near-empty fixtures
- [ ] Every fixed bug gets a regression test in the CI suite
- [ ] Staging is close enough to production that passing tests are trustworthy evidence
