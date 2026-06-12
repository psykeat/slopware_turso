import assert from "node:assert/strict";
import crypto from "node:crypto";
import test, { after } from "node:test";

import "../scripts/load-env";
import { closeDb, db } from "../index";
import { organization, tenant } from "../schema/app.schema";
import type { VariantTemplateDefinition } from "../services/variant-template-schema";
import { executeCapability, type ExecutionContext } from "./index";

async function createTenantFixture() {
  const suffix = crypto.randomUUID().slice(0, 8);

  const [org] = await db
    .insert(organization)
    .values({ name: `Capability Org ${suffix}`, slug: `cap-org-${suffix}` })
    .returning({ organizationId: organization.organizationId });

  const [tenantRow] = await db
    .insert(tenant)
    .values({
      organizationId: org.organizationId,
      name: `Capability Tenant ${suffix}`,
      slug: `cap-tenant-${suffix}`,
    })
    .returning({ tenantId: tenant.tenantId });

  const ctx: ExecutionContext = {
    tenantId: tenantRow.tenantId,
    organizationId: org.organizationId,
    userId: null,
    actorMode: "test",
    role: "system",
  };

  return { ctx, suffix };
}

function buildDefinition(): VariantTemplateDefinition {
  return {
    version: 1,
    productTypeLabel: "T-Shirt",
    axes: [
      {
        name: "Größe",
        sortOrder: 0,
        values: [
          { value: "S", sortOrder: 0 },
          { value: "M", sortOrder: 1 },
        ],
      },
      {
        name: "Farbe",
        sortOrder: 1,
        values: [
          { value: "Rot", sortOrder: 0 },
          { value: "Blau", sortOrder: 1 },
        ],
      },
    ],
  };
}

function expectOk<T>(result: { ok: true; data: T } | { ok: false; error: unknown }): T {
  assert.equal(result.ok, true, `expected ok envelope, got ${JSON.stringify(result)}`);
  return (result as { ok: true; data: T }).data;
}

test("article upsert → list → template apply → archive scenario", async () => {
  const { ctx, suffix } = await createTenantFixture();
  const articleNo = `CAP-${suffix}`;

  const created = expectOk<{ article: { articleId: string }; created: boolean }>(
    await executeCapability("masterdata.article.upsert", ctx, {
      articleNo,
      name: "Capability Shirt",
    }),
  );
  assert.equal(created.created, true);
  const articleId = created.article.articleId;

  // Same natural key again: must patch, not duplicate.
  const updated = expectOk<{ article: { articleId: string; name: string }; created: boolean }>(
    await executeCapability("masterdata.article.upsert", ctx, {
      articleNo,
      name: "Capability Shirt v2",
    }),
  );
  assert.equal(updated.created, false);
  assert.equal(updated.article.articleId, articleId);
  assert.equal(updated.article.name, "Capability Shirt v2");

  const listed = expectOk<{ items: Array<{ articleId: string }> }>(
    await executeCapability("masterdata.article.list", ctx, { search: suffix }),
  );
  assert.ok(listed.items.some((item) => item.articleId === articleId));

  const template = expectOk<{ templateId: string }>(
    await executeCapability("masterdata.articleVariantTemplate.create", ctx, {
      slug: `tshirt-${suffix}`,
      label: "T-Shirt Achsen",
      definition: buildDefinition(),
    }),
  );

  const firstApply = expectOk<{ createdOptions: number; matchedOptions: number }>(
    await executeCapability("masterdata.articleVariantTemplate.applyToArticle", ctx, {
      articleId,
      templateId: template.templateId,
    }),
  );
  assert.equal(firstApply.createdOptions, 2);

  // Merge-only semantics: a second apply matches instead of duplicating.
  const secondApply = expectOk<{ createdOptions: number; matchedOptions: number }>(
    await executeCapability("masterdata.articleVariantTemplate.applyToArticle", ctx, {
      articleId,
      templateId: template.templateId,
    }),
  );
  assert.equal(secondApply.createdOptions, 0);
  assert.equal(secondApply.matchedOptions, 2);

  const archived = expectOk<{ archived: true }>(
    await executeCapability("masterdata.article.archive", ctx, { articleId }),
  );
  assert.equal(archived.archived, true);

  const listedAfterArchive = expectOk<{ items: Array<{ articleId: string }> }>(
    await executeCapability("masterdata.article.list", ctx, { search: suffix }),
  );
  assert.ok(!listedAfterArchive.items.some((item) => item.articleId === articleId));

  // Upserting onto an archived natural key must not silently resurrect it.
  const conflict = await executeCapability("masterdata.article.upsert", ctx, {
    articleNo,
    name: "Resurrected",
  });
  assert.equal(conflict.ok, false);
  assert.equal(!conflict.ok && conflict.error.code, "conflict");
});

test("tenant isolation: foreign tenant cannot read another tenant's article", async () => {
  const [a, b] = await Promise.all([createTenantFixture(), createTenantFixture()]);

  const created = expectOk<{ article: { articleId: string } }>(
    await executeCapability("masterdata.article.upsert", a.ctx, {
      articleNo: `ISO-${a.suffix}`,
      name: "Isolated Article",
    }),
  );

  const foreign = await executeCapability("masterdata.article.get", b.ctx, {
    articleId: created.article.articleId,
  });
  assert.equal(foreign.ok, false);
  assert.equal(!foreign.ok && foreign.error.code, "not_found");
});

test("invalid template definitions fail validation with issue paths", async () => {
  const { ctx, suffix } = await createTenantFixture();
  const definition = buildDefinition();
  definition.axes.push({ ...definition.axes[0] }); // duplicate axis name

  const result = await executeCapability("masterdata.articleVariantTemplate.create", ctx, {
    slug: `broken-${suffix}`,
    label: "Broken",
    definition,
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "validation");
    assert.ok(result.error.issues && result.error.issues.length > 0);
    assert.ok(result.error.issues.some((issue) => issue.path.startsWith("definition.axes")));
  }
});

test("missing records map to not_found", async () => {
  const { ctx } = await createTenantFixture();

  const result = await executeCapability(
    "masterdata.articleVariantTemplate.applyToArticle",
    ctx,
    {
      articleId: crypto.randomUUID(),
      templateId: crypto.randomUUID(),
    },
  );
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.error.code, "not_found");
});

after(async () => {
  await closeDb();
});
