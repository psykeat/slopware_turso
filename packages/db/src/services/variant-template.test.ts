import assert from "node:assert/strict";
import crypto from "node:crypto";
import test, { after } from "node:test";

import { and, eq } from "drizzle-orm";

import "../scripts/load-env";
import { closeDb, db } from "../index";
import {
  article,
  articleOption,
  articleOptionValue,
  articleVariant,
  organization,
  tenant,
} from "../schema/app.schema";
import { generateArticleVariants, previewArticleVariants } from "./article-variant-generator";
import { DEFAULT_VARIANT_OPTION_VALUE_HASH } from "./ecommerce-variant";
import {
  applyVariantTemplateToArticle,
  copyVariantAxesFromArticle,
  createVariantTemplate,
  getVariantTemplate,
  listVariantTemplates,
  updateVariantTemplate,
  VariantTemplateValidationError,
} from "./variant-template";
import { type VariantTemplateDefinition } from "./variant-template-schema";

function buildDefinition(): VariantTemplateDefinition {
  return {
    version: 1,
    productTypeLabel: "T-Shirt",
    axes: [
      {
        name: "Farbe",
        sortOrder: 0,
        values: [
          { value: "Navy", sortOrder: 0, skuCode: "NV" },
          { value: "Rot", sortOrder: 1, skuCode: "RT" },
        ],
      },
      {
        name: "Größe",
        sortOrder: 1,
        values: [
          { value: "M", sortOrder: 0 },
          { value: "XL", sortOrder: 1, priceSurcharge: 2 },
        ],
      },
    ],
    skuPattern: "{articleNo}-{axis:Farbe}-{axis:Größe}",
    exclusions: [
      {
        id: "no-rot-xl",
        label: "Rot nicht in XL",
        when: { axis: "Farbe", value: "Rot" },
        exclude: { axis: "Größe", values: ["XL"] },
      },
    ],
    defaults: { priceMode: "surchargeOnBase", weightMode: "inherit" },
  };
}

async function createTemplateFixture() {
  const suffix = crypto.randomUUID().slice(0, 8);

  const [org] = await db
    .insert(organization)
    .values({
      name: `Template Test Org ${suffix}`,
      slug: `template-test-org-${suffix}`,
    })
    .returning({ organizationId: organization.organizationId });

  const [tenantRow] = await db
    .insert(tenant)
    .values({
      organizationId: org.organizationId,
      name: `Template Test Tenant ${suffix}`,
      slug: `template-test-tenant-${suffix}`,
    })
    .returning({ tenantId: tenant.tenantId });

  const [articleRow] = await db
    .insert(article)
    .values({
      tenantId: tenantRow.tenantId,
      articleNo: `TPL-${suffix}`,
      name: `Template Test Article ${suffix}`,
    })
    .returning({ articleId: article.articleId, articleNo: article.articleNo });

  return {
    suffix,
    tenantId: tenantRow.tenantId,
    articleId: articleRow.articleId,
    articleNo: articleRow.articleNo,
  };
}

test("createVariantTemplate validates the definition", async () => {
  const fixture = await createTemplateFixture();

  await assert.rejects(
    createVariantTemplate(fixture.tenantId, {
      slug: `bad-${fixture.suffix}`,
      label: "Kaputt",
      definition: { version: 1, productTypeLabel: "X", axes: [] },
    }),
    VariantTemplateValidationError,
  );

  const created = await createVariantTemplate(fixture.tenantId, {
    slug: `tshirt-${fixture.suffix}`,
    label: "T-Shirt",
    definition: buildDefinition(),
  });

  assert.equal(created.label, "T-Shirt");
  assert.equal(created.archived, false);
  assert.equal(created.definition.axes.length, 2);

  const fetched = await getVariantTemplate(fixture.tenantId, created.templateId);
  assert.ok(fetched);
  assert.deepEqual(fetched.definition, buildDefinition());
});

test("updateVariantTemplate archives instead of deleting", async () => {
  const fixture = await createTemplateFixture();

  const created = await createVariantTemplate(fixture.tenantId, {
    slug: `archive-${fixture.suffix}`,
    label: "Archiv-Test",
    definition: buildDefinition(),
  });

  const archived = await updateVariantTemplate(fixture.tenantId, created.templateId, {
    archived: true,
  });
  assert.equal(archived.archived, true);

  const activeOnly = await listVariantTemplates(fixture.tenantId);
  assert.equal(
    activeOnly.some((row) => row.templateId === created.templateId),
    false,
  );

  const includingArchived = await listVariantTemplates(fixture.tenantId, {
    includeArchived: true,
  });
  assert.equal(
    includingArchived.some((row) => row.templateId === created.templateId),
    true,
  );
});

test("applyVariantTemplateToArticle merges idempotently and never deletes", async () => {
  const fixture = await createTemplateFixture();

  const [manualOption] = await db
    .insert(articleOption)
    .values({
      tenantId: fixture.tenantId,
      articleId: fixture.articleId,
      name: "Material",
      sortOrder: 99,
    })
    .returning({ optionId: articleOption.optionId });

  await db.insert(articleOptionValue).values({
    tenantId: fixture.tenantId,
    optionId: manualOption.optionId,
    value: "Baumwolle",
    sortOrder: 0,
  });

  const template = await createVariantTemplate(fixture.tenantId, {
    slug: `apply-${fixture.suffix}`,
    label: "Apply-Test",
    definition: buildDefinition(),
  });

  const first = await applyVariantTemplateToArticle(
    fixture.tenantId,
    fixture.articleId,
    template.templateId,
  );
  assert.equal(first.createdOptions, 2);
  assert.equal(first.createdValues, 4);
  assert.equal(first.matchedOptions, 0);
  assert.equal(first.matchedValues, 0);

  const second = await applyVariantTemplateToArticle(
    fixture.tenantId,
    fixture.articleId,
    template.templateId,
  );
  assert.equal(second.createdOptions, 0);
  assert.equal(second.createdValues, 0);
  assert.equal(second.matchedOptions, 2);
  assert.equal(second.matchedValues, 4);

  const optionRows = await db
    .select({ name: articleOption.name })
    .from(articleOption)
    .where(
      and(
        eq(articleOption.tenantId, fixture.tenantId),
        eq(articleOption.articleId, fixture.articleId),
      ),
    );

  assert.deepEqual(optionRows.map((row) => row.name).sort(), ["Farbe", "Größe", "Material"]);
});

test("template-driven generation applies exclusions, SKU pattern, and surcharges", async () => {
  const fixture = await createTemplateFixture();

  await db.insert(articleVariant).values({
    tenantId: fixture.tenantId,
    articleId: fixture.articleId,
    sku: fixture.articleNo,
    optionValueHash: DEFAULT_VARIANT_OPTION_VALUE_HASH,
    price: "10",
    isActive: true,
  });

  const template = await createVariantTemplate(fixture.tenantId, {
    slug: `generate-${fixture.suffix}`,
    label: "Generate-Test",
    definition: buildDefinition(),
  });

  await applyVariantTemplateToArticle(fixture.tenantId, fixture.articleId, template.templateId);

  const preview = await previewArticleVariants(fixture.tenantId, fixture.articleId, {
    templateId: template.templateId,
  });
  assert.equal(preview.counts.total, 4);
  assert.equal(preview.counts.create, 3);
  assert.equal(preview.counts.exists, 0);
  assert.equal(preview.counts.excluded, 1);

  const excludedPlan = preview.combinations.find((plan) => plan.status === "excluded");
  assert.ok(excludedPlan);
  assert.equal(excludedPlan.excludedByRuleId, "no-rot-xl");
  assert.deepEqual(
    excludedPlan.optionValues.map((optionValue) => optionValue.value).sort(),
    ["Rot", "XL"],
  );

  const result = await generateArticleVariants(fixture.tenantId, fixture.articleId, {
    templateId: template.templateId,
  });
  assert.equal(result.combinations, 4);
  assert.equal(result.createdVariants, 3);
  assert.equal(result.excludedVariants, 1);
  assert.equal(result.skippedVariants, 0);

  const variantRows = await db
    .select({
      sku: articleVariant.sku,
      price: articleVariant.price,
      optionValueHash: articleVariant.optionValueHash,
    })
    .from(articleVariant)
    .where(
      and(
        eq(articleVariant.tenantId, fixture.tenantId),
        eq(articleVariant.articleId, fixture.articleId),
      ),
    );

  const generated = variantRows.filter(
    (row) => row.optionValueHash !== DEFAULT_VARIANT_OPTION_VALUE_HASH,
  );
  assert.deepEqual(generated.map((row) => row.sku).sort(), [
    `${fixture.articleNo}-NV-M`,
    `${fixture.articleNo}-NV-XL`,
    `${fixture.articleNo}-RT-M`,
  ]);

  const xlRow = generated.find((row) => row.sku === `${fixture.articleNo}-NV-XL`);
  assert.ok(xlRow);
  assert.equal(Number(xlRow.price), 12);

  const mRow = generated.find((row) => row.sku === `${fixture.articleNo}-NV-M`);
  assert.ok(mRow);
  assert.equal(Number(mRow.price), 10);

  const defaultRow = variantRows.find(
    (row) => row.optionValueHash === DEFAULT_VARIANT_OPTION_VALUE_HASH,
  );
  assert.ok(defaultRow);
  assert.equal(Number(defaultRow.price), 10);

  const secondPreview = await previewArticleVariants(fixture.tenantId, fixture.articleId, {
    templateId: template.templateId,
  });
  assert.equal(secondPreview.counts.create, 0);
  assert.equal(secondPreview.counts.exists, 3);
  assert.equal(secondPreview.counts.excluded, 1);

  const secondRun = await generateArticleVariants(fixture.tenantId, fixture.articleId, {
    templateId: template.templateId,
  });
  assert.equal(secondRun.createdVariants, 0);
  assert.equal(secondRun.skippedVariants, 3);
  assert.equal(secondRun.excludedVariants, 1);
});

test("pattern SKU collisions fall back to a hash suffix", async () => {
  const fixture = await createTemplateFixture();

  const [otherArticle] = await db
    .insert(article)
    .values({
      tenantId: fixture.tenantId,
      articleNo: `OTHER-${fixture.suffix}`,
      name: `Other Article ${fixture.suffix}`,
    })
    .returning({ articleId: article.articleId });

  await db.insert(articleVariant).values({
    tenantId: fixture.tenantId,
    articleId: otherArticle.articleId,
    sku: `${fixture.articleNo}-NV-M`,
    optionValueHash: DEFAULT_VARIANT_OPTION_VALUE_HASH,
    isActive: true,
  });

  const template = await createVariantTemplate(fixture.tenantId, {
    slug: `collision-${fixture.suffix}`,
    label: "Kollisions-Test",
    definition: buildDefinition(),
  });

  await applyVariantTemplateToArticle(fixture.tenantId, fixture.articleId, template.templateId);

  const result = await generateArticleVariants(fixture.tenantId, fixture.articleId, {
    templateId: template.templateId,
  });
  assert.equal(result.createdVariants, 3);

  const variantRows = await db
    .select({ sku: articleVariant.sku, optionValueHash: articleVariant.optionValueHash })
    .from(articleVariant)
    .where(
      and(
        eq(articleVariant.tenantId, fixture.tenantId),
        eq(articleVariant.articleId, fixture.articleId),
      ),
    );

  const collidedRow = variantRows.find((row) =>
    row.sku.startsWith(`${fixture.articleNo}-NV-M-`),
  );
  assert.ok(collidedRow, "collided SKU should carry a hash suffix");
  assert.equal(collidedRow.sku, `${fixture.articleNo}-NV-M-${collidedRow.optionValueHash.slice(0, 8)}`);
});

test("copyVariantAxesFromArticle copies axes into another article", async () => {
  const fixture = await createTemplateFixture();

  const template = await createVariantTemplate(fixture.tenantId, {
    slug: `copy-${fixture.suffix}`,
    label: "Copy-Test",
    definition: buildDefinition(),
  });

  await applyVariantTemplateToArticle(fixture.tenantId, fixture.articleId, template.templateId);

  const [targetArticle] = await db
    .insert(article)
    .values({
      tenantId: fixture.tenantId,
      articleNo: `COPY-${fixture.suffix}`,
      name: `Copy Target ${fixture.suffix}`,
    })
    .returning({ articleId: article.articleId });

  const result = await copyVariantAxesFromArticle(
    fixture.tenantId,
    targetArticle.articleId,
    fixture.articleId,
  );
  assert.equal(result.createdOptions, 2);
  assert.equal(result.createdValues, 4);

  const optionRows = await db
    .select({ name: articleOption.name })
    .from(articleOption)
    .where(
      and(
        eq(articleOption.tenantId, fixture.tenantId),
        eq(articleOption.articleId, targetArticle.articleId),
      ),
    );
  assert.deepEqual(optionRows.map((row) => row.name).sort(), ["Farbe", "Größe"]);
});

test("templates are tenant-isolated", async () => {
  const fixtureA = await createTemplateFixture();
  const fixtureB = await createTemplateFixture();

  const template = await createVariantTemplate(fixtureA.tenantId, {
    slug: `isolated-${fixtureA.suffix}`,
    label: "Isolations-Test",
    definition: buildDefinition(),
  });

  const fromOtherTenant = await getVariantTemplate(fixtureB.tenantId, template.templateId);
  assert.equal(fromOtherTenant, null);

  await assert.rejects(
    applyVariantTemplateToArticle(fixtureB.tenantId, fixtureB.articleId, template.templateId),
    /Variant template not found/,
  );
});

after(async () => {
  await closeDb();
});
