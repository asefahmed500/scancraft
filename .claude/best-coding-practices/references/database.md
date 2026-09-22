# Database — detailed reference

## Principles

**Index every foreign key and every frequently filtered/sorted column.** This is the single highest-leverage thing for query speed, and the most commonly skipped, because it's invisible with 50 rows in dev and catastrophic with 5 million in production. Run `EXPLAIN ANALYZE` on your slowest real queries and index what they scan.

**Referential integrity at the DB level, not just in application code.** Foreign key constraints catch an orphaned record the moment it's created, not three months later during a report that silently drops null-joined rows. Application-level "we always remember to check" does not hold up over a team and over time.

**Migrations only.** Every schema change goes through a migration tool (Prisma Migrate, Flyway, Alembic). A manual `ALTER TABLE` run once against production and never captured anywhere is schema drift waiting to break the next deploy.

**Append-only for financial/inventory ledgers.** Corrections are new rows referencing the original, never an `UPDATE` or `DELETE` on a ledger entry. This is what makes an audit trail actually auditable, and it's much easier to enforce from the start than retrofit after a dispute.

**The N+1 query problem.** A loop that queries the database once per row is invisible with a 10-row test fixture and devastating with 10,000 real rows. Batch with `include`/`select` (Prisma) or a join, and actually test against realistic data volume — not an empty or nearly-empty seed.

**Locking for concurrent edits.** Two users editing the same record at once will otherwise silently overwrite each other. Optimistic locking (a `version` column, incremented and checked on write) is usually enough and cheaper than pessimistic row locks.

**Backups are only real once restored.** An automated backup job that's never been used to actually restore a database is an assumption, not a safety net. Test the restore.

## Common anti-patterns

- A foreign key column with no index, discovered only when a JOIN gets slow at scale
- Cascade deletes or missing constraints allowing orphaned child records
- A one-off manual schema change that isn't in any migration history
- `UPDATE`/`DELETE` on a ledger or inventory movement table
- A loop issuing one query per row instead of a single batched fetch
- No `version`/lock check — the last save silently wins, other users' edits vanish
- Backups configured once and never test-restored

## Checklist

- [ ] Every foreign key and hot filter/sort column is indexed
- [ ] Foreign key constraints are enforced at the DB, not assumed in code
- [ ] All schema changes are captured in migrations
- [ ] Ledger/audit tables are insert-only
- [ ] N+1 patterns checked under realistic (not empty) data volume
- [ ] Concurrent-edit protection exists on records multiple users can touch
- [ ] Backups exist *and* a restore has actually been tested
