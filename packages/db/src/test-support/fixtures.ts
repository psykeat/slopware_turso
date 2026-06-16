import crypto from "node:crypto";

import { and, eq, sql } from "drizzle-orm";

import { type ExecutionContext, executeCapability, type CapabilityInput } from "../capabilities";
import { db } from "../index";
import { user } from "../schema/auth.schema";
import {
  article,
  articleVariant,
  company,
  document,
  documentGroup,
  documentLine,
  inventoryBalance,
  inventoryItem,
  organization,
  tenant,
  userTenant,
  warehouse,
} from "../schema/app.schema";

// Shared seed helpers for node:test suites. Agents: start here.
//
// DEFAULT — useTestTenant(): one canonical org/tenant/user, reused by every
// test (get-or-create, never multiplied). Use it whenever your test operates on
// rows it creates itself and addresses by id / a unique `suffix`. This is what
// keeps the DB from growing a new tenant per test run.
//
// ISOLATION — createEphemeralTenant() + cleanupEphemeralTenants(): a throwaway
// tenant for tests that assert tenant-wide aggregates (counts, list totals) or
// need a *second* tenant (isolation/RLS). It MUST be torn down — register
// `after(cleanupEphemeralTenants)` in the suite.
//
// seed*Row(): RAW table inserts that deliberately bypass capability /
// DataService invariants (e.g. the default-variant side effect that
// DataService.create("article") enforces). Use them to construct legacy /
// pre-invariant state; otherwise drive the real grain via executeCapability.

const CANONICAL = {
  orgSlug: "unit-test",
  tenantSlug: "unit-test",
  userId: "unit-test-user",
  userEmail: "unit-test@slopware.dev",
} as const;

export interface TestTenant {
  ctx: ExecutionContext;
  tenantId: string;
  organizationId: string;
  userId: string;
  /** Fresh per call — namespace your rows (articleNo, slug, search term) with it. */
  suffix: string;
}

let canonical: Omit<TestTenant, "suffix"> | null = null;

/** The canonical test tenant + a ready ExecutionContext (role=system, actorMode=test). */
export async function useTestTenant(): Promise<TestTenant> {
  if (!canonical) {
    const organizationId = await ensureOrg();
    const tenantId = await ensureTenant(organizationId);
    const userId = await ensureUser();
    canonical = {
      organizationId,
      tenantId,
      userId,
      ctx: { tenantId, organizationId, userId, actorMode: "test", role: "system" },
    };
  }
  return { ...canonical, suffix: crypto.randomUUID().slice(0, 8) };
}

async function ensureOrg(): Promise<string> {
  const found = await db
    .select({ id: organization.organizationId })
    .from(organization)
    .where(eq(organization.slug, CANONICAL.orgSlug))
    .limit(1);
  if (found[0]) return found[0].id;
  await db
    .insert(organization)
    .values({ name: "Unit Test Org", slug: CANONICAL.orgSlug })
    .onConflictDoNothing();
  const [row] = await db
    .select({ id: organization.organizationId })
    .from(organization)
    .where(eq(organization.slug, CANONICAL.orgSlug))
    .limit(1);
  return row.id;
}

async function ensureTenant(organizationId: string): Promise<string> {
  const found = await db
    .select({ id: tenant.tenantId })
    .from(tenant)
    .where(eq(tenant.slug, CANONICAL.tenantSlug))
    .limit(1);
  if (found[0]) return found[0].id;
  await db
    .insert(tenant)
    .values({ organizationId, name: "Unit Test Tenant", slug: CANONICAL.tenantSlug })
    .onConflictDoNothing();
  const [row] = await db
    .select({ id: tenant.tenantId })
    .from(tenant)
    .where(eq(tenant.slug, CANONICAL.tenantSlug))
    .limit(1);
  return row.id;
}

async function ensureUser(): Promise<string> {
  const found = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, CANONICAL.userId))
    .limit(1);
  if (found[0]) return found[0].id;
  await db
    .insert(user)
    .values({ id: CANONICAL.userId, name: "Unit Test User", email: CANONICAL.userEmail })
    .onConflictDoNothing();
  return CANONICAL.userId;
}

// ── Base-tenant login binding ───────────────────────────────────────────────
//
// linkUserToBaseTenant(): attaches an existing (already signed-up) user to the
// `isBase` tenant, mirroring the auto-link the first-ever signup gets in
// packages/auth/src/auth.ts. Use this so a real Better Auth session lands on
// the rich, db:seed:full-populated base tenant instead of the empty sandbox
// tenant initializeDefaultTenant() creates for every signup. Consumed by
// apps/web/e2e/setup/auth.setup.ts and the `db:dev-login` script.

/** Links an existing user (by email) to the base tenant. Idempotent. */
export async function linkUserToBaseTenant(email: string): Promise<void> {
  const [userRow] = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);
  if (!userRow) throw new Error(`User "${email}" not found — sign them up first.`);

  const [baseTenant] = await db
    .select({ id: tenant.tenantId })
    .from(tenant)
    .where(eq(tenant.isBase, true))
    .limit(1);
  if (!baseTenant) throw new Error('No tenant with "isBase" set found in the database.');

  await db
    .insert(userTenant)
    .values({ userId: userRow.id, tenantId: baseTenant.id, role: "owner" })
    .onConflictDoNothing();
}

// ── Ephemeral tenants (isolated, must be cleaned up) ────────────────────────

const ephemeralTenants: Array<{ tenantId: string; organizationId: string }> = [];

/** A throwaway, isolated tenant. Register `after(cleanupEphemeralTenants)`. */
export async function createEphemeralTenant(label = "Ephemeral"): Promise<SeededTenant> {
  const seeded = await seedTenant(label);
  ephemeralTenants.push({ tenantId: seeded.tenantId, organizationId: seeded.organizationId });
  return seeded;
}

/** Delete every ephemeral tenant created in this process (call from `after`). */
export async function cleanupEphemeralTenants(): Promise<void> {
  const batch = ephemeralTenants.splice(0);
  if (batch.length === 0) return;
  await deleteTenantsCascade(
    batch.map((t) => t.tenantId),
    batch.map((t) => t.organizationId),
  );
}

let tenantScopedTables: string[] | null = null;

async function getTenantScopedTables(): Promise<string[]> {
  if (tenantScopedTables) return tenantScopedTables;
  const rows = (await db.execute(
    sql`select table_name from information_schema.columns
        where table_schema = 'public' and column_name = 'tenant_id' and table_name <> 'tenant'`,
  )) as unknown as Array<{ table_name: string }>;
  tenantScopedTables = rows
    .map((r) => r.table_name)
    .filter((t) => /^[a-z_][a-z0-9_]*$/.test(t));
  return tenantScopedTables;
}

// Superuser-only: disables FK triggers for the txn so the 100+ tenant-scoped
// tables clear without hand-ordering foreign keys. Mirrors cleanup-test-data.ts.
async function deleteTenantsCascade(tenantIds: string[], organizationIds: string[]): Promise<void> {
  if (tenantIds.length === 0) return;
  const tables = await getTenantScopedTables();
  await db.transaction(async (tx) => {
    await tx.execute(sql`set local session_replication_role = replica`);
    for (const table of tables) {
      await tx.execute(
        sql`delete from ${sql.identifier(table)} where tenant_id::text = any(${tenantIds})`,
      );
    }
    await tx.execute(sql`delete from "tenant" where tenant_id::text = any(${tenantIds})`);
    if (organizationIds.length > 0) {
      await tx.execute(
        sql`delete from "organization" where organization_id::text = any(${organizationIds})`,
      );
    }
  });
}

// ── Low-level raw row seeders ───────────────────────────────────────────────

export interface SeededTenant {
  organizationId: string;
  tenantId: string;
  ctx: ExecutionContext;
  suffix: string;
}

function slugify(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "test";
}

/** Raw org + tenant (no capability exists for these). Prefer useTestTenant / createEphemeralTenant. */
export async function seedTenant(label = "Test"): Promise<SeededTenant> {
  const suffix = crypto.randomUUID().slice(0, 8);
  const slug = slugify(label);

  const [org] = await db
    .insert(organization)
    .values({ name: `${label} Org ${suffix}`, slug: `${slug}-org-${suffix}` })
    .returning({ organizationId: organization.organizationId });

  const [tenantRow] = await db
    .insert(tenant)
    .values({
      organizationId: org.organizationId,
      name: `${label} Tenant ${suffix}`,
      slug: `${slug}-tenant-${suffix}`,
    })
    .returning({ tenantId: tenant.tenantId });

  const ctx: ExecutionContext = {
    tenantId: tenantRow.tenantId,
    organizationId: org.organizationId,
    userId: null,
    actorMode: "test",
    role: "system",
  };

  return { organizationId: org.organizationId, tenantId: tenantRow.tenantId, ctx, suffix };
}

export interface SeedArticleOptions {
  articleNo?: string;
  name?: string;
}

/**
 * Raw article insert WITHOUT the default-variant side effect. Use this to set
 * up legacy articles that predate the variant invariant; use the
 * masterdata.article.upsert capability when you want the real behaviour.
 */
export async function seedArticleRow(tenantId: string, opts: SeedArticleOptions = {}) {
  const articleNo = opts.articleNo ?? `ART-${crypto.randomUUID().slice(0, 8)}`;
  const [row] = await db
    .insert(article)
    .values({ tenantId, articleNo, name: opts.name ?? `Article ${articleNo}` })
    .returning({ articleId: article.articleId, articleNo: article.articleNo });
  return row;
}

export interface SeedVariantOptions {
  articleId: string;
  optionValueHash: string;
  sku?: string;
  isActive?: boolean;
}

export async function seedVariantRow(tenantId: string, opts: SeedVariantOptions) {
  const [row] = await db
    .insert(articleVariant)
    .values({
      tenantId,
      articleId: opts.articleId,
      sku: opts.sku ?? `VAR-${crypto.randomUUID().slice(0, 8)}`,
      optionValueHash: opts.optionValueHash,
      isActive: opts.isActive ?? true,
    })
    .returning({ variantId: articleVariant.variantId, sku: articleVariant.sku });
  return row;
}

export interface SeedInventoryItemOptions {
  variantId: string;
  sku: string;
  tracked?: boolean;
}

export async function seedInventoryItemRow(tenantId: string, opts: SeedInventoryItemOptions) {
  const [row] = await db
    .insert(inventoryItem)
    .values({ tenantId, variantId: opts.variantId, sku: opts.sku, tracked: opts.tracked ?? true })
    .returning({ itemId: inventoryItem.itemId, variantId: inventoryItem.variantId });
  return row;
}

export async function getContextForTenant(tenantSlugOrId: string): Promise<ExecutionContext> {
  let tenantRow;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantSlugOrId)) {
    [tenantRow] = await db
      .select()
      .from(tenant)
      .where(eq(tenant.tenantId, tenantSlugOrId))
      .limit(1);
  } else {
    [tenantRow] = await db
      .select()
      .from(tenant)
      .where(eq(tenant.slug, tenantSlugOrId))
      .limit(1);
  }

  if (!tenantRow) {
    throw new Error(`Tenant "${tenantSlugOrId}" not found`);
  }

  const [membership] = await db
    .select()
    .from(userTenant)
    .where(eq(userTenant.tenantId, tenantRow.tenantId))
    .limit(1);

  const role = (membership?.role === "tenant_admin" || membership?.role === "tenant_user" || membership?.role === "system")
    ? membership.role
    : "tenant_admin";

  return {
    tenantId: tenantRow.tenantId,
    organizationId: tenantRow.organizationId,
    userId: membership?.userId ?? null,
    actorMode: "system",
    role,
  };
}

// ── TestScenarioBuilder ───────────────────────────────────────────────────

interface BuilderState {
  ctx?: ExecutionContext;
  tenantId?: string;
  companyId?: string;
  warehouseId?: string;
  documentGroupId?: string;
  
  lastArticleId?: string;
  lastVariantId?: string;
  lastVariantSku?: string;
  lastDocumentId?: string;

  articleIds: string[];
  variantIds: string[];
  variantSkus: string[];
  documentIds: string[];
}

export class TestScenarioBuilder {
  private steps: Array<(state: BuilderState) => Promise<void>> = [];

  withTenant(tenantSlugOrId?: string) {
    this.steps.push(async (state) => {
      if (tenantSlugOrId) {
        state.ctx = await getContextForTenant(tenantSlugOrId);
        state.tenantId = state.ctx.tenantId;
      } else {
        const testTenant = await useTestTenant();
        state.ctx = testTenant.ctx;
        state.tenantId = testTenant.tenantId;
      }
      
      const suffix = crypto.randomUUID().slice(0, 8);
      
      const [companyRow] = await db
        .insert(company)
        .values({
          tenantId: state.tenantId!,
          companyNo: `COM-${suffix}`,
          name: `Test Company ${suffix}`,
          countryCode: "DE",
          currencyId: "EUR",
        })
        .returning({ companyId: company.companyId });
      state.companyId = companyRow.companyId;

      const [warehouseRow] = await db
        .insert(warehouse)
        .values({
          tenantId: state.tenantId!,
          companyId: state.companyId,
          code: `WH-${suffix}`,
          name: `Test Warehouse ${suffix}`,
        })
        .returning({ warehouseId: warehouse.warehouseId });
      state.warehouseId = warehouseRow.warehouseId;
    });
    return this;
  }

  withArticle(input: Partial<CapabilityInput<"masterdata.article.upsert">> = {}) {
    this.steps.push(async (state) => {
      if (!state.ctx) throw new Error("Tenant context not set. Call withTenant() first.");
      
      const suffix = crypto.randomUUID().slice(0, 8);
      const articleNo = input.articleNo ?? `ART-${suffix}`;
      const name = input.name ?? `Article ${articleNo}`;

      const res = await executeCapability<{ article: { articleId: string } }>(
        "masterdata.article.upsert",
        state.ctx,
        {
          articleNo,
          name,
          ...input,
        },
      );

      if (!res.ok) throw new Error("Failed to upsert article: " + JSON.stringify(res.error));
      
      state.lastArticleId = res.data.article.articleId;
      if (state.lastArticleId) {
        state.articleIds.push(state.lastArticleId);
      }
    });
    return this;
  }

  withVariant(input: Partial<typeof articleVariant.$inferInsert> & { stock?: number } = {}) {
    this.steps.push(async (state) => {
      if (!state.tenantId) throw new Error("Tenant context not set. Call withTenant() first.");
      const articleId = input.articleId ?? state.lastArticleId;
      if (!articleId) throw new Error("No articleId found in state context. Call withArticle() first.");

      const suffix = crypto.randomUUID().slice(0, 8);
      const sku = input.sku ?? `SKU-${suffix}`;
      const optionValueHash = input.optionValueHash ?? `hash-${suffix}`;

      const [variant] = await db.insert(articleVariant).values({
        tenantId: state.tenantId,
        articleId,
        sku,
        optionValueHash,
        isActive: input.isActive ?? true,
        ...input,
      }).returning({ variantId: articleVariant.variantId, sku: articleVariant.sku });

      state.lastVariantId = variant.variantId;
      state.lastVariantSku = variant.sku;
      state.variantIds.push(state.lastVariantId);
      state.variantSkus.push(state.lastVariantSku);

      if (input.stock !== undefined && input.stock >= 0) {
        const [itemRow] = await db.insert(inventoryItem).values({
          tenantId: state.tenantId,
          variantId: state.lastVariantId,
          sku: state.lastVariantSku,
          tracked: true,
        }).returning({ itemId: inventoryItem.itemId });

        await db.insert(inventoryBalance).values({
          tenantId: state.tenantId,
          warehouseId: state.warehouseId!,
          inventoryItemId: itemRow.itemId,
          articleId,
          onHandQty: input.stock.toString(),
          availableQty: input.stock.toString(),
        });
      }
    });
    return this;
  }

  withDocument(input: {
    type: "order" | "invoice" | "delivery";
    lineItems?: Array<{ sku?: string; qty: number; netPrice?: number }>;
  }) {
    this.steps.push(async (state) => {
      if (!state.ctx || !state.tenantId || !state.companyId) {
        throw new Error("Tenant/Company context not initialized.");
      }

      const typeMap = { order: "A", delivery: "L", invoice: "R" };
      const docType = typeMap[input.type];

      const suffix = crypto.randomUUID().slice(0, 8);
      
      let [docGroup] = await db
        .select()
        .from(documentGroup)
        .where(
          and(
            eq(documentGroup.tenantId, state.tenantId),
            eq(documentGroup.documentType, docType)
          )
        )
        .limit(1);

      if (!docGroup) {
        [docGroup] = await db
          .insert(documentGroup)
          .values({
            tenantId: state.tenantId,
            companyId: state.companyId,
            name: `Group ${docType} ${suffix}`,
            documentType: docType,
            groupNumber: 99,
            direction: "OUTBOUND",
            defaultWarehouseId: state.warehouseId!,
          })
          .returning();
      }

      const documentId = crypto.randomUUID();
      await db.insert(document).values({
        documentId,
        tenantId: state.tenantId,
        companyId: state.companyId,
        documentType: docType,
        documentDirection: "OUTBOUND",
        documentNo: `DOC-${suffix}`,
        status: "draft",
        documentDate: new Date().toISOString().slice(0, 10),
        transactionId: crypto.randomUUID(),
        documentGroupId: docGroup.documentGroupId,
      });

      state.lastDocumentId = documentId;
      state.documentIds.push(documentId);

      if (input.lineItems) {
        let lineNo = 1;
        for (const item of input.lineItems) {
          let variantId = state.lastVariantId;
          let sku = item.sku ?? state.lastVariantSku;

          if (item.sku) {
            const [found] = await db
              .select({ variantId: articleVariant.variantId })
              .from(articleVariant)
              .where(
                and(
                  eq(articleVariant.tenantId, state.tenantId),
                  eq(articleVariant.sku, item.sku)
                )
              )
              .limit(1);
            if (found) {
              variantId = found.variantId;
            } else {
              throw new Error(`Variant with sku "${item.sku}" not found in tenant "${state.tenantId}".`);
            }
          }

          if (!variantId) {
            throw new Error("No variantId found for document line item.");
          }

          await db.insert(documentLine).values({
            tenantId: state.tenantId,
            documentId,
            lineNo: lineNo++,
            variantId,
            quantity: item.qty.toString(),
            netPrice: (item.netPrice ?? 10.0).toString(),
            lineType: "article",
          });
        }
      }
    });
    return this;
  }

  async build() {
    const state: BuilderState = {
      articleIds: [],
      variantIds: [],
      variantSkus: [],
      documentIds: [],
    };

    for (const step of this.steps) {
      await step(state);
    }

    return {
      tenantId: state.tenantId!,
      companyId: state.companyId!,
      warehouseId: state.warehouseId!,
      ctx: state.ctx!,
      
      articleId: state.lastArticleId,
      variantId: state.lastVariantId,
      sku: state.lastVariantSku,
      documentId: state.lastDocumentId,

      articleIds: state.articleIds,
      variantIds: state.variantIds,
      variantSkus: state.variantSkus,
      documentIds: state.documentIds,
    };
  }
}
