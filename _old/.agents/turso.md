# Turso/libSQL Target Architecture

## Status

Target architecture. The live implementation is still PostgreSQL-backed, but
new modules should avoid adding deeper Postgres-only coupling unless a task is
explicitly about the compatibility adapter.

## Rules

- Tenant operational data targets physical database-per-tenant isolation in a
  Turso group.
- A central configuration database owns tenant routing, global credentials,
  global metadata, and registry overlays.
- Tenant context is always resolved server-side. Capability inputs and client
  payloads must never carry `tenantId`.
- libSQL clients must configure `busy_timeout >= 5000 ms`. Use
  `TURSO_BUSY_TIMEOUT_MS` and `normalizeTursoTenantDatabaseConfig` from
  `@repo/db/turso/config`.
- Drizzle/libSQL bulk inserts must be chunked to at most 2000 rows per
  statement. Use `chunkRecords` from `@repo/business`.
- Start with indexes for statistics and stock projections. Add trigger-backed
  materialization only for proven hot read paths or persistent per-SKU row
  counts above the documented threshold.

## Current Compatibility Adapter

The current schema and services live in `@repo/db` and use PostgreSQL Drizzle
tables. Treat this as a compatibility adapter while the Turso schema is being
introduced. Do not duplicate entity semantics in both the adapter and UI; put
domain-level entity facts in `@repo/registry`.

The current adapter lives behind `packages/db/src/persistence/postgres.ts`.
Capability execution calls the exported `runInTenantScope` interface from
`@repo/db`; Postgres implements it with a transaction-local tenant GUC, while
the Turso adapter must implement it by selecting the physical tenant database.

`packages/db/src/turso/routing.ts` defines the control-plane route contract:
tenant id/slug, database URL, Turso group, status, and schema version.

## Registry Interface

`@repo/registry` is the TypeScript-first module interface for:

- entity discovery,
- list/form/lookup/api/ai projections,
- payload validation,
- generated fixtures,
- constraint explanations.

The official capability surface exposes these through `system.registry.*`
capabilities so UI, tests, and AI agents use the same execution path.
