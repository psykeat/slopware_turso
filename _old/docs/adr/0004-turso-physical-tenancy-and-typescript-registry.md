# Turso Physical Tenancy and TypeScript Registry

We are moving the ERP target architecture toward Turso/libSQL with physical
database-per-tenant isolation and a TypeScript-first entity registry.

The existing implementation still uses PostgreSQL, Drizzle pg-core schema, and
tenant-aware server access. That remains the compatibility adapter until the
schema and migration stream have been ported. New architecture work should not
deepen PostgreSQL/RLS coupling; it should use registry and business modules that
can survive the Turso move.

## Decision

- Tenant operational data is targeted to physical tenant databases in a Turso
  group, selected from server-resolved tenant context.
- A central configuration database remains responsible for tenant routing,
  global metadata, credentials, and registry overlays.
- `@repo/registry` is the TypeScript-first source for entity metadata,
  projections, validation, fixtures, and constraint explanations.
- `@repo/business` owns database-near business rules that should not be tied to
  a single app route or UI component, including bulk insert limits and ledger
  invariants.
- libSQL clients must be configured with a busy timeout of at least 5000 ms.
  `@repo/db/turso/config` exposes this invariant for future adapters.
- Capability execution depends on the `runInTenantScope` persistence interface.
  Postgres implements it with transaction-local RLS context; Turso must implement
  it with physical tenant database selection.
- Drizzle bulk inserts that must remain SQLite/libSQL-compatible are chunked at
  no more than 2000 rows per statement, with lower limits allowed where a flow
  has stricter memory or variable-count needs.

## Consequences

The registry becomes the intended module interface for generic UI, capabilities,
imports, test fixtures, and AI tools. The existing database introspection layer
can continue to fill gaps, but new entity knowledge should be added to the
registry first when it is domain-level knowledge rather than a raw schema fact.

Posting and ledger logic remain append-only. The current code still has
`journal_entry`, `journal_line`, and `inventory_movement`; the target model is
`posting_batch` plus immutable `posting_entry`, with projections for inventory,
finance, exports, and statistics. Until that migration is implemented, existing
posting tables are treated as compatibility projections.

This ADR supersedes the PostgreSQL-only tenancy recommendation in the older
agent docs for new work. It does not by itself migrate production data or remove
the current Postgres adapter.
