# Reliability and Authorization

Load this reference for transactions, provisioning, billing, retries, account linking, tenant isolation or migrations. It is a map, not the doctrine: each section names the MCP document that holds the full rule. Read that document with `read-doc` before choosing an implementation.

**The paths below are documents inside the CleanSlice MCP, not files in the project repository.** `ls` will not find `architecture/transactions.md`; open it with `read-doc`.

---

## Transactions across slices — `architecture/transactions.md`

- One invariant, one owning slice, one real transaction boundary. A multi-record write that must succeed or fail together runs inside a single database transaction owned by the slice that holds the invariant.
- Cross-slice writes do not share a transaction by reaching into another slice's gateway. The owning slice exposes an operation; the caller invokes it. If two slices must commit atomically, the operation belongs to one of them.
- Concurrent invariants (uniqueness, balances, counters) are enforced by the database (unique index, conditional update, `SELECT ... FOR UPDATE`), not by a read-then-write in application code.
- Tests for these rules run against the target database engine. SQLite is not a substitute: it has different locking and constraint semantics.

## Reliable external operations — `architecture/reliable-operations.md`

- An external effect (payment, email, provisioning call, webhook) is recorded as **durable intent** in the same transaction as the local change, then executed by a worker (outbox pattern).
- Every external call carries an idempotency key. Retries are safe only because the key makes a duplicate a no-op.
- Reconciliation is a scheduled job, not a hope: compare local state with the provider and repair drift.
- Report "designed", "tested", "integration-verified" and "release-ready" as separate facts. A green build proves none of the last two.

## Authorization context — `architecture/authorization-context.md`

- Authorization is a context carried through the call, checked at every execution boundary: HTTP, queue consumer, cron, CLI. A tenant ID in a URL selects a resource; it never grants access.
- Fail closed. A new principal type (API key, service account, customer) is denied on existing endpoints until each endpoint is explicitly adapted.
- Tenant isolation is enforced where the data is read, not only where the request enters. Background jobs and seeds set the tenant context explicitly; an operation with no tenant context is refused, not defaulted.

## Migrations and evidence — `architecture/migrations-and-evidence.md`

- A schema change ships as a migration file, reviewed as SQL. Never sync the schema without one.
- Backfill, backward compatibility and recovery are verified before a migration is enabled in production: the old code must run against the new schema during rollout.
- Evidence means the actual command output: the migration applied on a copy of production data, the rollback tried, the negative control (the check goes red when the fix is reverted). Alternatives considered are written down with the decision.

---

## When this reference is not enough

Search the MCP for the specific case (`search` with the feature and the constraint), then `read-doc` the result. Neighboring code in the project is not proof of a rule; if it contradicts the MCP, say so rather than copying it.
