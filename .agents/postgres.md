# PostgreSQL Multi-Tenant Implementation Pattern

This document defines a database-first implementation pattern for building multi-tenant systems on PostgreSQL, with a strict focus on tenant isolation, schema design, indexing, security, migrations, and operations.[cite:50][cite:58]

## Scope

This guide covers the three dominant PostgreSQL tenancy models: database-per-tenant, schema-per-tenant, and shared tables with row-level security (RLS). It is intended for AI coding agents and engineers who need implementation rules that are explicit enough to generate safe database code and migration workflows.[cite:50][cite:52][cite:58]

## Decision Matrix

| Pattern             | Best fit                                                                         | Strengths                                                                                         | Risks                                                                                                   |
| ------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Database per tenant | Few large tenants with strict isolation or compliance needs                      | Strong isolation, tenant-specific tuning, simpler tenant restore paths [cite:58]                  | High operational overhead and higher cost at scale [cite:58]                                            |
| Schema per tenant   | Moderate tenant counts needing a balance of isolation and centralized operations | Good separation, single cluster operations, easier per-tenant export than shared tables [cite:52] | More complex migrations and schema drift risk across many schemas [cite:52]                             |
| Shared tables + RLS | Many small tenants where cost efficiency and centralized management matter most  | Lowest infrastructure overhead, single schema, simplest global analytics path [cite:50][cite:58]  | Requires disciplined RLS, indexing, and tenant-context handling to avoid cross-tenant leakage [cite:63] |

## Recommended Default

For most SaaS products with many small or mid-sized tenants, shared tables with a mandatory `tenant_id` column and PostgreSQL RLS is the best default. This model keeps operations centralized while still allowing strong logical isolation when tenant context, RLS policies, and tenant-aware indexes are implemented consistently.[cite:50][cite:58][cite:63]

Choose schema-per-tenant when tenants need stronger separation, independent customizations, or per-tenant export and maintenance workflows, but the platform still benefits from a shared PostgreSQL cluster.[cite:52] Choose database-per-tenant only when the business requires the strongest operational isolation, dedicated scaling, or strict compliance boundaries that make pooled tenancy unacceptable.[cite:58]

## Core Rules

- Every tenant-scoped table must include a non-null `tenant_id` column.[cite:50][cite:63]
- Every primary read path and write path must constrain by `tenant_id`, either directly or through RLS.[cite:63]
- Every unique constraint for tenant-owned records should be tenant-scoped unless uniqueness must be global.[cite:50]
- Every tenant-scoped secondary index should start with `tenant_id` when queries are filtered by tenant.[cite:58]
- Tenant context must be set inside the database session or transaction, not only in application memory.[cite:54][cite:63]
- Superuser and table-owner access must be tightly controlled because RLS can be bypassed by privileged roles.[cite:63]

## Canonical Shared-Table Model

Use shared tables with RLS when the application can tolerate logical rather than physical isolation and when centralized operations are a priority.[cite:50][cite:58]

### Table Design

```sql
CREATE TABLE tenant (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('active', 'suspended', 'deleted')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app_user (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenant(id),
  email text NOT NULL,
  full_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

CREATE TABLE orders (
  id bigserial PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenant(id),
  customer_id uuid NOT NULL,
  order_number text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, order_number)
);
```

This structure keeps tenant ownership explicit and scopes business uniqueness to a tenant by default, which avoids collisions between tenants while preserving global IDs where useful.[cite:50]

### Tenant-Aware Indexing

```sql
CREATE INDEX idx_app_user_tenant_created_at
  ON app_user (tenant_id, created_at DESC);

CREATE INDEX idx_orders_tenant_status_created_at
  ON orders (tenant_id, status, created_at DESC);
```

Tenant-aware indexes reduce cross-tenant scan pressure and align with the query planner's most common filter pattern in pooled tenancy models.[cite:58]

### RLS Baseline

```sql
ALTER TABLE app_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_user_tenant_isolation
ON app_user
USING (tenant_id = current_setting('app.current_tenant')::uuid)
WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY orders_tenant_isolation
ON orders
USING (tenant_id = current_setting('app.current_tenant')::uuid)
WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
```

The application must set `app.current_tenant` before issuing tenant-scoped SQL, and this setting should be applied per transaction when connection pooling is in use.[cite:54][cite:63]

### Transaction-Scoped Tenant Context

```sql
BEGIN;
SET LOCAL app.current_tenant = '11111111-1111-1111-1111-111111111111';
SELECT * FROM orders WHERE status = 'open';
COMMIT;
```

`SET LOCAL` is safer than persistent session state in transaction pooling because it automatically resets at transaction end.[cite:57]

## Schema-Per-Tenant Model

Use schema-per-tenant when stronger separation is required and the team can operate migration tooling across many schemas.[cite:52]

### Registry Table

```sql
CREATE TABLE tenant_registry (
  tenant_id uuid PRIMARY KEY,
  tenant_slug text NOT NULL UNIQUE,
  schema_name text NOT NULL UNIQUE,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

A registry table is required so provisioning, migrations, backup automation, and tenant routing all use a single source of truth.[cite:52]

### Provisioning Function

```sql
CREATE OR REPLACE FUNCTION provision_tenant_schema(p_tenant_id uuid, p_schema_name text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', p_schema_name);

  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS %I.orders (
      id bigserial PRIMARY KEY,
      order_number text NOT NULL UNIQUE,
      status text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  $sql$, p_schema_name);
END;
$$;
```

This pattern keeps tenant bootstrap logic in the database layer and allows automation to provision isolated schemas in a repeatable way.[cite:52]

### Routing Rule

```sql
BEGIN;
SET LOCAL search_path = tenant_acme, public;
SELECT * FROM orders;
COMMIT;
```

`search_path` must be set carefully and only from trusted, validated schema names because unsafe schema interpolation can create serious isolation and security failures.[cite:52]

## Database-Per-Tenant Model

Use database-per-tenant when compliance, noisy-neighbor avoidance, or tenant-specific scaling requirements justify the extra provisioning and operational complexity.[cite:58]

### Mandatory Controls

- Maintain a control-plane registry that maps tenant IDs to database connection targets.[cite:58]
- Automate database creation, migration execution, credential rotation, monitoring registration, and backup registration.[cite:58]
- Standardize schema versions and block application traffic if a tenant database is behind required migrations.[cite:58]

This pattern offers the cleanest restore and strongest runtime isolation, but it becomes expensive and operationally heavy as tenant count grows.[cite:58]

## Constraints and Keys

Prefer surrogate primary keys such as UUID or bigserial for internal joins, but use tenant-scoped unique constraints for business identifiers like email, SKU, order number, or external reference.[cite:50]

```sql
ALTER TABLE inventory_item
  ADD CONSTRAINT uq_inventory_item_tenant_sku UNIQUE (tenant_id, sku);
```

This prevents one tenant from blocking another tenant's namespace while preserving strong integrity rules.[cite:50]

## Partitioning Rules

Partitioning is useful when the pooled model reaches very large table sizes or when lifecycle operations are time-oriented.[cite:58][cite:66]

- Partition by time when retention, archival, or time-range scans dominate.[cite:58]
- Consider tenant-based partitioning only when a limited number of tenants are very large and dominate workload shape.[cite:58]
- Avoid premature partitioning because it adds migration and operational complexity.[cite:58]
- Re-check index design before introducing partitions, because poor indexing is often the real bottleneck.[cite:58]

## Migration Strategy

### Shared Tables

Run one migration stream for the whole database. Every migration must preserve RLS compatibility and avoid long locks on high-cardinality tenant tables.[cite:50][cite:63]

### Schema Per Tenant

Run migrations across tenant schemas from the registry table, record per-schema migration state, and design migrations to be idempotent wherever possible.[cite:52]

### Database Per Tenant

Run migrations through orchestrated automation, block partial rollout drift, and surface migration status in the control plane.[cite:58]

## Connection Pooling Rules

Connection pooling is a frequent source of multi-tenant data leaks when tenant context is not reset correctly between requests.[cite:57][cite:63]

- Prefer transaction-scoped tenant context with `SET LOCAL` when using PgBouncer transaction pooling.[cite:57]
- Never assume session state belongs to the current request unless the pool mode guarantees dedicated sessions.[cite:57]
- Clear or overwrite any tenant-related GUC before executing user SQL.[cite:57][cite:63]
- Include automated tests that simulate rapid tenant switching on pooled connections.[cite:63]

## Security Rules

- Enable RLS on every tenant-owned table in the shared-table model.[cite:63]
- Use separate application roles for migrations, runtime writes, and read-only analytics where possible.[cite:63]
- Minimize table ownership by runtime roles because owners may bypass policy expectations.[cite:63]
- Audit all administrative paths that can query data outside a tenant boundary.[cite:63]

## Backup and Restore

Restore strategy should influence tenancy choice from the beginning because per-tenant recovery is much easier in schema-per-tenant and database-per-tenant designs than in pooled shared tables.[cite:57][cite:58]

- Shared tables: use full backups and point-in-time recovery; per-tenant recovery is possible but more complex.[cite:57]
- Schema per tenant: schema-level exports are simpler and fit tenant offboarding or legal export workflows better.[cite:57]
- Database per tenant: tenant restore is operationally simplest because the isolation boundary matches the backup boundary.[cite:58]

## Observability

Track query behavior by tenant where possible, especially for high-volume tenants, because noisy-neighbor effects often show up first as skewed latency or lock contention.[cite:58][cite:66]

Minimum metrics and checks:

- Slow queries by tenant-scoped table.[cite:58]
- Deadlocks and lock wait time on hot tenant tables.[cite:58]
- Index hit ratio and sequential scan rate on pooled tables.[cite:58]
- Growth rate per tenant for the largest tables.[cite:66]
- Failed RLS policy tests in CI or staging.[cite:63]

## Anti-Patterns

- Global unique constraints on tenant-owned business fields without `tenant_id`.[cite:50]
- Application-only tenant filtering without RLS in a shared-table design.[cite:63]
- Reusing pooled connections without resetting tenant context.[cite:57]
- Building tenant isolation around mutable names or slugs instead of immutable tenant IDs.[cite:50]
- Allowing ad hoc SQL from privileged roles against pooled tables without audit controls.[cite:63]

## Default Recommendation

For a new SaaS product, start with shared tables plus RLS if tenant count is expected to be high and compliance requirements do not demand physical isolation. Move to schema-per-tenant for exceptional customers that need stronger separation, and reserve database-per-tenant for the smallest set of tenants with the strongest compliance or scaling demands.[cite:50][cite:58][cite:66]

This staged approach aligns cost, operational simplicity, and growth while preserving a migration path toward stronger isolation when justified by customer or regulatory requirements.[cite:58][cite:66]
