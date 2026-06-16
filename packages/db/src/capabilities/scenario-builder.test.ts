import assert from "node:assert/strict";
import test, { after } from "node:test";

import "../scripts/load-env";
import { closeDb } from "../index";
import { cleanupEphemeralTenants, TestScenarioBuilder } from "../test-support/fixtures";

test("TestScenarioBuilder builds tenant, article, variant, stock, and document", async () => {
  const scenario = await new TestScenarioBuilder()
    .withTenant()
    .withArticle({ articleNo: "ART-TEST-BUILDER", name: "Laptop" })
    .withVariant({ sku: "LAP-8GB", stock: 15 })
    .withDocument({
      type: "order",
      lineItems: [{ sku: "LAP-8GB", qty: 2 }],
    })
    .build();

  assert.ok(scenario.tenantId);
  assert.ok(scenario.companyId);
  assert.ok(scenario.warehouseId);
  assert.ok(scenario.articleId);
  assert.ok(scenario.variantId);
  assert.equal(scenario.sku, "LAP-8GB");
  assert.ok(scenario.documentId);

  assert.equal(scenario.articleIds.length, 1);
  assert.equal(scenario.variantIds.length, 1);
  assert.equal(scenario.documentIds.length, 1);
});

after(async () => {
  await cleanupEphemeralTenants();
  await closeDb();
});
