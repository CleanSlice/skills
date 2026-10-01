# Reliability and authorization

Use MCP search/read-doc for the full guides; these summaries do not duplicate their implementation examples.

| Task | MCP read-doc path |
| --- | --- |
| Atomic writes across slices | `architecture/transactions.md` |
| External calls, retries, outbox, callbacks | `architecture/reliable-operations.md` |
| Tenants, account links, sessions, jobs | `architecture/authorization-context.md` |
| Backfill, rollback, integration evidence | `architecture/migrations-and-evidence.md` |

Website-backed indexes may expose the same paths with a `docs/` prefix; use the exact path returned by search. Docs are canonical; MCP bundles are synchronized copies with version/date metadata.

A domain gateway describes the atomic business operation; data owns its local transaction. Remote effects need durable intent and reconciliation. Never widen authority merely by linking identities. Test persistence with the target database. Clearly distinguish an approved design, passing local tests, verified integration and release readiness. Product-specific TTLs and provider restrictions stay in their own project docs.
