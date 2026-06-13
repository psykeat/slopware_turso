import assert from "node:assert/strict";
import crypto from "node:crypto";
import test, { after } from "node:test";

import { and, eq } from "drizzle-orm";

import "../scripts/load-env";
import { closeDb, db } from "../index";
import { articleVariantTemplate, capabilityExecutionLog, organization, tenant } from "../schema/app.schema";
import { executeCapability, type ExecutionContext } from "./index";

const CREATE_KEY = "masterdata.articleVariantTemplate.create";
const tenantIds: string[] = [];

async function createTenantFixture(): Promise<ExecutionContext> {
  const suffix = crypto.randomUUID().slice(0, 8);
  const [org] = await db
    .insert(organization)
    .values({ name: `Idem Org ${suffix}`, slug: `idem-org-${suffix}` })
    .returning({ organizationId: organization.organizationId });
  const [tenantRow] = await db
    .insert(tenant)
    .values({
      organizationId: org.organizationId,
      name: `Idem Tenant ${suffix}`,
      slug: `idem-tenant-${suffix}`,
    })
    .returning({ tenantId: tenant.tenantId });
  tenantIds.push(tenantRow.tenantId);
  return {
    tenantId: tenantRow.tenantId,
    organizationId: org.organizationId,
    userId: null,
    actorMode: "test",
    role: "system",
  };
}

function createInput(slug: string) {
  return {
    slug,
    label: slug,
    definition: {
      version: 1,
      productTypeLabel: "T-Shirt",
      axes: [{ name: "Größe", sortOrder: 0, values: [{ value: "S", sortOrder: 0 }] }],
    },
  };
}

async function logRows(tenantId: string) {
  return db
    .select()
    .from(capabilityExecutionLog)
    .where(eq(capabilityExecutionLog.tenantId, tenantId));
}

test("same idempotency key replays the stored result, runs the handler once", async () => {
  const ctx = await createTenantFixture();
  const input = createInput(`tpl-${crypto.randomUUID().slice(0, 6)}`);

  const first = await executeCapability(CREATE_KEY, { ...ctx, idempotencyKey: "k1" }, input);
  assert.equal(first.ok, true);
  const second = await executeCapability(CREATE_KEY, { ...ctx, idempotencyKey: "k1" }, input);
  assert.equal(second.ok, true);

  if (first.ok && second.ok) {
    const firstId = (first.data as { templateId: string }).templateId;
    const secondId = (second.data as { templateId: string }).templateId;
    assert.equal(secondId, firstId, "replay must return the same record id");
    assert.notEqual(first.meta.replayed, true, "first call is a fresh execution");
    assert.equal(second.meta.replayed, true, "second call is replayed");

    // Exactly one template row was created for the slug.
    const templates = await db
      .select()
      .from(articleVariantTemplate)
      .where(
        and(
          eq(articleVariantTemplate.tenantId, ctx.tenantId),
          eq(articleVariantTemplate.slug, input.slug),
        ),
      );
    assert.equal(templates.length, 1);

    // The completed log row stores the success envelope.
    const rows = await logRows(ctx.tenantId);
    const completed = rows.filter((row) => row.status === "completed");
    assert.equal(completed.length, 1);
    assert.equal(completed[0].capabilityKey, CREATE_KEY);
  }
});

test("reusing a key with a different request is a conflict", async () => {
  const ctx = await createTenantFixture();

  const first = await executeCapability(
    CREATE_KEY,
    { ...ctx, idempotencyKey: "k2" },
    createInput(`a-${crypto.randomUUID().slice(0, 6)}`),
  );
  assert.equal(first.ok, true);

  const clash = await executeCapability(
    CREATE_KEY,
    { ...ctx, idempotencyKey: "k2" },
    createInput(`b-${crypto.randomUUID().slice(0, 6)}`),
  );
  assert.equal(clash.ok, false);
  if (!clash.ok) {
    assert.equal(clash.error.code, "conflict");
    assert.match(clash.error.message, /different request/);
  }
});

test("writes without an idempotency key never touch the log", async () => {
  const ctx = await createTenantFixture();
  const result = await executeCapability(
    CREATE_KEY,
    ctx,
    createInput(`c-${crypto.randomUUID().slice(0, 6)}`),
  );
  assert.equal(result.ok, true);
  const rows = await logRows(ctx.tenantId);
  assert.equal(rows.length, 0);
});

test("reads ignore the idempotency key", async () => {
  const ctx = await createTenantFixture();
  const result = await executeCapability(
    "masterdata.articleVariantTemplate.list",
    { ...ctx, idempotencyKey: "read-key" },
    { includeArchived: false },
  );
  assert.equal(result.ok, true);
  const rows = await logRows(ctx.tenantId);
  assert.equal(rows.length, 0, "a read must not write the idempotency log");
});

test("a failed write drops the claim so a retry can re-run", async () => {
  const ctx = await createTenantFixture();
  // Valid input that fails inside the handler (no such template) — this reaches
  // runHandler, so it exercises the claim-then-drop path, not input validation.
  const updateMissing = {
    templateId: crypto.randomUUID(),
    patch: { label: "x" },
  };
  const failed = await executeCapability(
    "masterdata.articleVariantTemplate.update",
    { ...ctx, idempotencyKey: "k3" },
    updateMissing,
  );
  assert.equal(failed.ok, false);
  // Claim was dropped, so the key is free again.
  const rows = await logRows(ctx.tenantId);
  assert.equal(rows.length, 0, "failed writes must not leave a pending claim");
});

after(async () => {
  for (const tenantId of tenantIds) {
    await db
      .delete(capabilityExecutionLog)
      .where(eq(capabilityExecutionLog.tenantId, tenantId));
    await db
      .delete(articleVariantTemplate)
      .where(eq(articleVariantTemplate.tenantId, tenantId));
    await db.delete(tenant).where(eq(tenant.tenantId, tenantId));
  }
  await closeDb();
});
