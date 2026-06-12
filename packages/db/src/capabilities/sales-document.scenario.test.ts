import assert from "node:assert/strict";
import crypto from "node:crypto";
import test, { after } from "node:test";

import "../scripts/load-env";
import { closeDb, db } from "../index";
import {
  article,
  articleVariant,
  company,
  document,
  documentGroup,
  documentLine,
  organization,
  tenant,
  warehouse,
} from "../schema/app.schema";
import { executeCapability, type ExecutionContext } from "./index";

// Protect tests for the document lifecycle BEFORE the capability-runtime
// refactor: they pin the behavior of the official sales.document.* execute
// path so the UI/route migration cannot silently change semantics.

async function createDocumentFixture() {
  const suffix = crypto.randomUUID().slice(0, 8);

  const [org] = await db
    .insert(organization)
    .values({ name: `Doc Cap Org ${suffix}`, slug: `doc-cap-org-${suffix}` })
    .returning({ organizationId: organization.organizationId });

  const [tenantRow] = await db
    .insert(tenant)
    .values({
      organizationId: org.organizationId,
      name: `Doc Cap Tenant ${suffix}`,
      slug: `doc-cap-tenant-${suffix}`,
    })
    .returning({ tenantId: tenant.tenantId });

  const [companyRow] = await db
    .insert(company)
    .values({
      tenantId: tenantRow.tenantId,
      companyNo: `DCT-${suffix}`,
      name: `Doc Cap Company ${suffix}`,
      countryCode: "DE",
      currencyId: "EUR",
    })
    .returning({ companyId: company.companyId });

  const [warehouseRow] = await db
    .insert(warehouse)
    .values({
      tenantId: tenantRow.tenantId,
      companyId: companyRow.companyId,
      code: `WH-${suffix}`,
      name: `Doc Cap Warehouse ${suffix}`,
    })
    .returning({ warehouseId: warehouse.warehouseId });

  const [deliveryGroup] = await db
    .insert(documentGroup)
    .values({
      tenantId: tenantRow.tenantId,
      companyId: companyRow.companyId,
      name: `Delivery Group ${suffix}`,
      documentType: "L",
      groupNumber: 1,
      direction: "OUTBOUND",
      defaultWarehouseId: warehouseRow.warehouseId,
      requireSerialTracking: false,
      requireBatchTracking: false,
    })
    .returning({ documentGroupId: documentGroup.documentGroupId });

  const [invoiceGroup] = await db
    .insert(documentGroup)
    .values({
      tenantId: tenantRow.tenantId,
      companyId: companyRow.companyId,
      name: `Invoice Group ${suffix}`,
      documentType: "R",
      groupNumber: 2,
      direction: "OUTBOUND",
      defaultWarehouseId: warehouseRow.warehouseId,
      requireSerialTracking: false,
      requireBatchTracking: false,
    })
    .returning({ documentGroupId: documentGroup.documentGroupId });

  const [articleRow] = await db
    .insert(article)
    .values({
      tenantId: tenantRow.tenantId,
      articleNo: `DOC-${suffix}`,
      name: `Doc Cap Article ${suffix}`,
    })
    .returning({ articleId: article.articleId });

  const [variantRow] = await db
    .insert(articleVariant)
    .values({
      tenantId: tenantRow.tenantId,
      articleId: articleRow.articleId,
      sku: `SKU-${suffix}`,
      optionValueHash: `hash-${suffix}`,
      isActive: true,
    })
    .returning({ variantId: articleVariant.variantId });

  const ctx: ExecutionContext = {
    tenantId: tenantRow.tenantId,
    organizationId: org.organizationId,
    userId: `doc-cap-user-${suffix}`,
    actorMode: "test",
    role: "system",
  };

  return {
    ctx,
    suffix,
    companyId: companyRow.companyId,
    warehouseId: warehouseRow.warehouseId,
    deliveryGroupId: deliveryGroup.documentGroupId,
    invoiceGroupId: invoiceGroup.documentGroupId,
    variantId: variantRow.variantId,
  };
}

function expectOk<T>(result: { ok: true; data: T } | { ok: false; error: unknown }): T {
  assert.equal(result.ok, true, `expected ok envelope, got ${JSON.stringify(result)}`);
  return (result as { ok: true; data: T }).data;
}

const today = () => new Date().toISOString().slice(0, 10);

async function insertPostedInvoice(fixture: Awaited<ReturnType<typeof createDocumentFixture>>) {
  const documentId = crypto.randomUUID();
  await db.insert(document).values({
    documentId,
    tenantId: fixture.ctx.tenantId,
    companyId: fixture.companyId,
    documentType: "R",
    documentDirection: "OUTBOUND",
    documentNo: `R-${crypto.randomUUID().slice(0, 8)}`,
    status: "posted",
    postedAt: new Date(),
    postedBy: fixture.ctx.userId,
    documentDate: today(),
    documentGroupId: fixture.invoiceGroupId,
    warehouseId: fixture.warehouseId,
    transactionId: crypto.randomUUID(),
  });
  await db.insert(documentLine).values({
    documentLineId: crypto.randomUUID(),
    tenantId: fixture.ctx.tenantId,
    documentId,
    lineNo: 1,
    variantId: fixture.variantId,
    quantity: "1",
    netPrice: "100",
    warehouseId: fixture.warehouseId,
    lineType: "article",
    transactionId: crypto.randomUUID(),
  });
  return documentId;
}

test("document lifecycle: create → saveDraft → post → duplicate → convert → delete", async () => {
  const fixture = await createDocumentFixture();
  const { ctx } = fixture;

  const created = expectOk<{ documentId: string; documentNo: string }>(
    await executeCapability("sales.document.create", ctx, {
      documentGroupId: fixture.deliveryGroupId,
      documentType: "L",
      documentDirection: "OUTBOUND",
      documentDate: today(),
    }),
  );
  assert.ok(created.documentId);

  const draft = expectOk<{ success: boolean; documentId: string }>(
    await executeCapability("sales.document.saveDraft", ctx, {
      documentId: created.documentId,
      documentGroupId: fixture.deliveryGroupId,
      documentType: "L",
      documentDirection: "OUTBOUND",
      documentDate: today(),
      lines: [
        {
          lineNo: 1,
          variantId: fixture.variantId,
          quantity: 2,
          netPrice: 15,
          lineType: "article",
        },
      ],
    }),
  );
  assert.equal(draft.documentId, created.documentId);

  const posted = expectOk<{ success: boolean }>(
    await executeCapability("sales.document.post", ctx, { documentId: created.documentId }),
  );
  assert.equal(posted.success, true);

  // Posting is a one-way transition: a second post must fail.
  const repost = await executeCapability("sales.document.post", ctx, {
    documentId: created.documentId,
  });
  assert.equal(repost.ok, false);

  const duplicated = expectOk<{ documentId: string; documentNo: string }>(
    await executeCapability("sales.document.duplicate", ctx, {
      documentId: created.documentId,
      targetGroupId: fixture.deliveryGroupId,
    }),
  );
  assert.notEqual(duplicated.documentId, created.documentId);

  const converted = expectOk<{ success: boolean; newDocumentId: string }>(
    await executeCapability("sales.document.convert", ctx, {
      documentId: created.documentId,
      targetGroupId: fixture.invoiceGroupId,
    }),
  );
  assert.equal(converted.success, true);

  const target = expectOk<{ status?: string; parentDocumentId?: string }>(
    await executeCapability("sales.document.get", ctx, {
      documentId: converted.newDocumentId,
    }),
  );
  assert.equal(target.status, "draft");
  assert.equal(target.parentDocumentId, created.documentId);

  // Invoice documents must never be deletable — storno is the only way out.
  const invoiceDelete = await executeCapability("sales.document.delete", ctx, {
    documentId: converted.newDocumentId,
  });
  assert.equal(invoiceDelete.ok, false);

  const deleted = expectOk<{ deleted: boolean; cancelled: boolean }>(
    await executeCapability("sales.document.delete", ctx, {
      documentId: duplicated.documentId,
    }),
  );
  // Business data is never hard-deleted; drafts get cancelled.
  assert.equal(deleted.deleted, false);
  assert.equal(deleted.cancelled, true);
});

test("storno: only posted invoices reverse, and only once", async () => {
  const fixture = await createDocumentFixture();
  const { ctx } = fixture;
  const invoiceId = await insertPostedInvoice(fixture);

  const storno = expectOk<{ success: boolean; stornoDocumentId: string }>(
    await executeCapability("sales.document.storno", ctx, { documentId: invoiceId }),
  );
  assert.equal(storno.success, true);
  assert.ok(storno.stornoDocumentId);

  const again = await executeCapability("sales.document.storno", ctx, {
    documentId: invoiceId,
  });
  assert.equal(again.ok, false);

  // Draft documents (non-invoice type) must not be reversible.
  const created = expectOk<{ documentId: string }>(
    await executeCapability("sales.document.create", ctx, {
      documentGroupId: fixture.deliveryGroupId,
      documentType: "L",
      documentDirection: "OUTBOUND",
      documentDate: today(),
    }),
  );
  const draftStorno = await executeCapability("sales.document.storno", ctx, {
    documentId: created.documentId,
  });
  assert.equal(draftStorno.ok, false);
});

test("candidates and line tracking through the capability surface", async () => {
  const fixture = await createDocumentFixture();
  const { ctx } = fixture;

  const created = expectOk<{ documentId: string }>(
    await executeCapability("sales.document.create", ctx, {
      documentGroupId: fixture.deliveryGroupId,
      documentType: "L",
      documentDirection: "OUTBOUND",
      documentDate: today(),
    }),
  );
  await executeCapability("sales.document.saveDraft", ctx, {
    documentId: created.documentId,
    documentGroupId: fixture.deliveryGroupId,
    documentType: "L",
    documentDirection: "OUTBOUND",
    documentDate: today(),
    lines: [
      { lineNo: 1, variantId: fixture.variantId, quantity: 2, netPrice: 15, lineType: "article" },
    ],
  });

  const convertCandidates = expectOk<{ candidates: Array<{ documentGroupId: string }> }>(
    await executeCapability("sales.document.convertCandidates", ctx, {
      documentId: created.documentId,
    }),
  );
  assert.ok(Array.isArray(convertCandidates.candidates));

  const dupCandidates = expectOk<{ candidates: Array<{ documentGroupId: string }> }>(
    await executeCapability("sales.document.duplicateCandidates", ctx, {
      documentId: created.documentId,
    }),
  );
  assert.ok(dupCandidates.candidates.some((c) => c.documentGroupId === fixture.deliveryGroupId));

  const lines = expectOk<{ items: Array<{ documentLineId: string }> }>(
    await executeCapability("sales.documentLine.list", ctx, { documentId: created.documentId }),
  );
  const lineId = lines.items[0]?.documentLineId;
  assert.ok(lineId);

  const added = expectOk<{ trackingId: string }>(
    await executeCapability("sales.documentLineTracking.add", ctx, {
      documentId: created.documentId,
      documentLineId: lineId,
      batchNo: `BATCH-${fixture.suffix}`,
      qty: 2,
    }),
  );
  assert.ok(added.trackingId);

  // Exactly-one-of constraint must reject mixed inputs.
  const mixed = await executeCapability("sales.documentLineTracking.add", ctx, {
    documentId: created.documentId,
    documentLineId: lineId,
    batchNo: "B",
    serialNo: "S",
    qty: 1,
  });
  assert.equal(mixed.ok, false);
  assert.equal(!mixed.ok && mixed.error.code, "validation");

  const tracked = expectOk<{ items: Array<{ trackingId: string }> }>(
    await executeCapability("sales.documentLine.tracking", ctx, { documentLineId: lineId }),
  );
  assert.equal(tracked.items.length, 1);

  const removed = expectOk<{ success: true }>(
    await executeCapability("sales.documentLineTracking.remove", ctx, {
      documentId: created.documentId,
      documentLineId: lineId,
      trackingId: added.trackingId,
    }),
  );
  assert.equal(removed.success, true);
});

test("tenant isolation: document workflows are invisible to foreign tenants", async () => {
  const [a, b] = await Promise.all([createDocumentFixture(), createDocumentFixture()]);

  const created = expectOk<{ documentId: string }>(
    await executeCapability("sales.document.create", a.ctx, {
      documentGroupId: a.deliveryGroupId,
      documentType: "L",
      documentDirection: "OUTBOUND",
      documentDate: today(),
    }),
  );

  const foreignGet = await executeCapability("sales.document.get", b.ctx, {
    documentId: created.documentId,
  });
  assert.equal(foreignGet.ok, false);
  assert.equal(!foreignGet.ok && foreignGet.error.code, "not_found");

  const foreignPost = await executeCapability("sales.document.post", b.ctx, {
    documentId: created.documentId,
  });
  assert.equal(foreignPost.ok, false);

  const foreignDelete = await executeCapability("sales.document.delete", b.ctx, {
    documentId: created.documentId,
  });
  assert.equal(foreignDelete.ok, false);

  // The document is untouched for its owner.
  const ownGet = expectOk<{ status?: string }>(
    await executeCapability("sales.document.get", a.ctx, { documentId: created.documentId }),
  );
  assert.equal(ownGet.status, "draft");
});

after(async () => {
  await closeDb();
});
