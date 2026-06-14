import assert from "node:assert/strict";
import crypto from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after, before } from "node:test";

import "../scripts/load-env";
import { closeDb, db } from "../index";
import {
  article,
  articleVariant,
  company,
  documentGroup,
  organization,
  tenant,
  warehouse,
} from "../schema/app.schema";
import {
  documentPdfStorageKey,
  registerDocumentPdfRenderer,
  type DocumentPdfPrintModel,
} from "../services/document-pdf-service";
import { executeCapability, type ExecutionContext } from "./index";

// Slice 2: sales.document.materializePdf is its own verb. It renders the
// document through the registered render port and persists it at the
// deterministic storage key that emailOutbox.prepareSend references — no
// implicit side effect in prepareSend (ADR 0002). We register a fake renderer
// so the capability is fully testable in-process without @react-pdf.

let storageDir: string;
let lastModel: DocumentPdfPrintModel | null = null;

before(async () => {
  storageDir = await mkdtemp(join(tmpdir(), "slopware-pdf-test-"));
  process.env.STORAGE_PATH = storageDir;
  registerDocumentPdfRenderer(async (model) => {
    lastModel = model;
    return new Uint8Array([0x25, 0x50, 0x44, 0x46]); // "%PDF"
  });
});

function expectOk<T>(result: { ok: true; data: T } | { ok: false; error: unknown }): T {
  assert.equal(result.ok, true, `expected ok envelope, got ${JSON.stringify(result)}`);
  return (result as { ok: true; data: T }).data;
}

const today = () => new Date().toISOString().slice(0, 10);

async function createDocumentFixture() {
  const suffix = crypto.randomUUID().slice(0, 8);

  const [org] = await db
    .insert(organization)
    .values({ name: `PDF Org ${suffix}`, slug: `pdf-org-${suffix}` })
    .returning({ organizationId: organization.organizationId });

  const [tenantRow] = await db
    .insert(tenant)
    .values({
      organizationId: org.organizationId,
      name: `PDF Tenant ${suffix}`,
      slug: `pdf-tenant-${suffix}`,
    })
    .returning({ tenantId: tenant.tenantId });

  const [companyRow] = await db
    .insert(company)
    .values({
      tenantId: tenantRow.tenantId,
      companyNo: `PDF-${suffix}`,
      name: `PDF Company ${suffix}`,
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
      name: `PDF Warehouse ${suffix}`,
    })
    .returning({ warehouseId: warehouse.warehouseId });

  const [group] = await db
    .insert(documentGroup)
    .values({
      tenantId: tenantRow.tenantId,
      companyId: companyRow.companyId,
      name: `PDF Quote Group ${suffix}`,
      documentType: "A",
      groupNumber: 1,
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
      articleNo: `PDF-${suffix}`,
      name: `PDF Article ${suffix}`,
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
    userId: `pdf-user-${suffix}`,
    actorMode: "test",
    role: "system",
  };

  return { ctx, suffix, groupId: group.documentGroupId, variantId: variantRow.variantId };
}

test("materializePdf renders through the port and writes the deterministic key", async () => {
  const fixture = await createDocumentFixture();
  const { ctx } = fixture;
  lastModel = null;

  const created = expectOk<{ documentId: string }>(
    await executeCapability("sales.document.create", ctx, {
      documentGroupId: fixture.groupId,
      documentType: "A",
      documentDirection: "OUTBOUND",
      documentDate: today(),
    }),
  );

  await executeCapability("sales.document.saveDraft", ctx, {
    documentId: created.documentId,
    documentGroupId: fixture.groupId,
    documentType: "A",
    documentDirection: "OUTBOUND",
    documentDate: today(),
    lines: [
      { lineNo: 1, variantId: fixture.variantId, quantity: 2, netPrice: 15, lineType: "article" },
    ],
  });

  const result = expectOk<{ fileId: string }>(
    await executeCapability("sales.document.materializePdf", ctx, {
      documentId: created.documentId,
    }),
  );

  // fileId is the deterministic storage key prepareSend re-derives.
  assert.equal(result.fileId, documentPdfStorageKey(ctx.tenantId, created.documentId));

  // The render port received a real, tenant-scoped print model with the line.
  assert.ok(lastModel, "renderer port was invoked");
  assert.equal(lastModel!.doc.documentId, created.documentId);
  assert.equal(lastModel!.doc.lines.length, 1);

  // The PDF was persisted at the storage key.
  const written = await readFile(join(storageDir, result.fileId));
  assert.deepEqual(new Uint8Array(written), new Uint8Array([0x25, 0x50, 0x44, 0x46]));
});

test("materializePdf rejects a foreign-tenant document", async () => {
  const [a, b] = await Promise.all([createDocumentFixture(), createDocumentFixture()]);

  const created = expectOk<{ documentId: string }>(
    await executeCapability("sales.document.create", a.ctx, {
      documentGroupId: a.groupId,
      documentType: "A",
      documentDirection: "OUTBOUND",
      documentDate: today(),
    }),
  );

  const foreign = await executeCapability("sales.document.materializePdf", b.ctx, {
    documentId: created.documentId,
  });
  assert.equal(foreign.ok, false);
});

after(async () => {
  await closeDb();
  if (storageDir) await rm(storageDir, { recursive: true, force: true });
});
