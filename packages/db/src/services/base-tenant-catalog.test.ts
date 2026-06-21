import assert from "node:assert/strict";
import test, { after } from "node:test";

import { eq } from "drizzle-orm";

import "../scripts/load-env";
import { closeDb, db } from "../index";
import { tenant } from "../schema/app.schema";
import { DataService } from "./data";

async function getBaseTenantId() {
  const [baseTenant] = await db
    .select({ tenantId: tenant.tenantId })
    .from(tenant)
    .where(eq(tenant.isBase, true))
    .limit(1);

  if (!baseTenant) {
    throw new Error("Base tenant not found");
  }

  return baseTenant.tenantId;
}

test("base tenant articles list with their subvariants", async () => {
  const baseTenantId = await getBaseTenantId();
  const dataService = new DataService();

  const articles = (await dataService.list("article", {}, { orderBy: "articleNo:asc" })) as Array<{
    articleId: string;
    articleNo: string;
    name: string;
  }>;

  assert.deepEqual(
    articles.map((article) => article.articleNo),
    ["ART-001", "ART-002", "ART-003"],
  );

  const articleNoById = new Map(articles.map((article) => [article.articleId, article.articleNo]));
  const subvariantCounts = new Map<string, number>();

  for (const article of articles) {
    const variants = (await dataService.list(
      "articleVariant",
      { articleId: article.articleId },
      { orderBy: "sku:asc" },
    )) as Array<{
      variantId: string;
      articleId: string;
      sku: string;
      lookupLabel: string;
      variantOptionSummary: string;
      availableQty: string;
    }>;

    subvariantCounts.set(article.articleNo, variants.length);

    for (const variant of variants) {
      assert.equal(articleNoById.get(variant.articleId), article.articleNo);
      assert.match(variant.lookupLabel, / available$/);
      if (article.articleNo === "ART-001") {
        assert.notEqual(variant.variantOptionSummary, "");
      }
    }
  }

  assert.equal(subvariantCounts.get("ART-001"), 4);
  assert.equal(subvariantCounts.get("ART-002"), 0);
  assert.equal(subvariantCounts.get("ART-003"), 0);
});

after(async () => {
  await closeDb();
});
