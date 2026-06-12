import assert from "node:assert/strict";
import test, { after } from "node:test";

import { eq } from "drizzle-orm";

import "../scripts/load-env";
import { closeDb, db } from "../index";
import { tenant } from "../schema/app.schema";
import { executeCapability, type ExecutionContext } from "./index";

// Smoke test against live dev data: resolve the base tenant by slug instead
// of hardcoding the id — the local database gets reseeded and ids change.
async function baseTenantContext(): Promise<ExecutionContext> {
  const [row] = await db
    .select({ tenantId: tenant.tenantId, organizationId: tenant.organizationId })
    .from(tenant)
    .where(eq(tenant.slug, "base"))
    .limit(1);

  assert.ok(row, 'tenant with slug "base" must exist in the local dev database');

  return {
    tenantId: row.tenantId,
    organizationId: row.organizationId,
    userId: null,
    actorMode: "test",
    role: "system",
  };
}

test("smoke: list all active articles of the base tenant", async () => {
  const ctx = await baseTenantContext();

  const result = await executeCapability<{
    items: Array<{ articleId: string; articleNo: string; name: string }>;
  }>("masterdata.article.list", ctx, { limit: 200 });

  assert.equal(result.ok, true, `expected ok envelope, got ${JSON.stringify(result)}`);
  if (result.ok) {
    assert.ok(Array.isArray(result.data.items));
    for (const item of result.data.items) {
      assert.equal(typeof item.articleId, "string");
      assert.equal(typeof item.articleNo, "string");
    }
    console.log(`base tenant has ${result.data.items.length} active articles`);
  }
});

after(async () => {
  await closeDb();
});
