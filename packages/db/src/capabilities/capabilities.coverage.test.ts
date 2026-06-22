import assert from "node:assert/strict";
import test, { after } from "node:test";

import "../scripts/load-env";
import { closeDb } from "../index";
import { AccountingExportService } from "../services/accounting-export-service";
import { DataService } from "../services/data";
import { DocumentService } from "../services/document-service";
import * as variantTemplateService from "../services/variant-template";
import { getCapability } from "./index";

// Coverage ratchet: every official service operation must either map to a
// capability key or be consciously parked with `null` (+ reason in a comment).
// When a new export/method appears in one of the audited services, this test
// fails until someone makes that decision — that is the whole point.
const NOT_EXPOSED = null;

const moduleFunctionCoverage: Record<string, Record<string, string | null>> = {
  "services/variant-template": {
    listVariantTemplates: "masterdata.articleVariantTemplate.list",
    getVariantTemplate: "masterdata.articleVariantTemplate.get",
    createVariantTemplate: "masterdata.articleVariantTemplate.create",
    updateVariantTemplate: "masterdata.articleVariantTemplate.update",
    applyVariantTemplateToArticle: "masterdata.articleVariantTemplate.applyToArticle",
    copyVariantAxesFromArticle: NOT_EXPOSED, // UI convenience; candidate for phase 3
    VariantTemplateValidationError: NOT_EXPOSED, // error class, not an operation
  },
};

const classMethodCoverage: Record<
  string,
  { ctor: object; methods: Record<string, string | null> }
> = {
  DataService: {
    ctor: DataService,
    methods: {
      list: "masterdata.article.list", // generic CRUD is wrapped per entity; article is the v1 slice
      get: "masterdata.article.get",
      create: "masterdata.article.upsert",
      patch: "masterdata.article.upsert",
      delete: NOT_EXPOSED, // hard delete; capabilities only archive
      // internal helpers (TS-private, but visible at runtime)
      decryptLlmApiKeyListIfNeeded: NOT_EXPOSED,
      encryptLlmSecretFieldsIfNeeded: NOT_EXPOSED,
      getTable: NOT_EXPOSED,
      getPrimaryKey: NOT_EXPOSED,
      normalizeLifecyclePayload: NOT_EXPOSED,
      applyLongTextOverrideMetadata: NOT_EXPOSED,
      enrichArticleVariantRows: NOT_EXPOSED,
      enrichRows: NOT_EXPOSED,
    },
  },
  DocumentService: {
    ctor: DocumentService,
    methods: {
      createDocument: "sales.document.create",
      createDocumentLine: "sales.documentLine.create",
      saveDocumentDraft: "sales.document.saveDraft",
      postDocument: "sales.document.post",
      stornoDocument: "sales.document.storno",
      convertDocument: "sales.document.convert",
      duplicateDocument: "sales.document.duplicate",
      deleteDocument: "sales.document.delete",
      deletePostedDocument: "sales.document.delete",
      getConversionCandidates: NOT_EXPOSED,
      getDuplicateCandidates: NOT_EXPOSED,
      getDocumentTree: "sales.document.tree",
      getDocumentAuditTrail: "sales.document.audit",
      getProductionFactTrace: NOT_EXPOSED,
      resolveVariantPricing: "sales.document.pricing",
      applyDeltaEffect: "sales.documentLine.delta",
    },
  },
  AccountingExportService: {
    ctor: AccountingExportService,
    methods: {
      createExportBatch: "accounting.accountingExportBatch.createBatch",
      buildExportRows: "accounting.accountingExportBatch.buildRows",
      markBatchExported: "accounting.accountingExportBatch.markExported",
      rebuildBatch: "accounting.accountingExportBatch.rebuild",
      generateCsv: "accounting.accountingExportBatch.csv",
      getBatch: "accounting.accountingExportBatch.get",
      listBatches: "accounting.accountingExportBatch.list",
    },
  },
};

function prototypeMethodNames(ctor: object): string[] {
  return Object.getOwnPropertyNames((ctor as { prototype: object }).prototype).filter(
    (name) =>
      name !== "constructor" &&
      typeof (ctor as { prototype: Record<string, unknown> }).prototype[name] === "function",
  );
}

test("audited service modules have full coverage decisions", () => {
  const modules: Record<string, Record<string, unknown>> = {
    "services/variant-template": variantTemplateService,
  };

  for (const [moduleName, moduleExports] of Object.entries(modules)) {
    const coverage = moduleFunctionCoverage[moduleName];
    const exported = Object.keys(moduleExports).filter(
      (name) => typeof moduleExports[name] === "function",
    );

    const unmapped = exported.filter((name) => !(name in coverage));
    assert.deepEqual(
      unmapped,
      [],
      `${moduleName} has exports without a coverage decision: ${unmapped.join(", ")}`,
    );

    const stale = Object.keys(coverage).filter((name) => !exported.includes(name));
    assert.deepEqual(
      stale,
      [],
      `${moduleName} coverage references removed exports: ${stale.join(", ")}`,
    );
  }
});

test("audited service classes have full coverage decisions", () => {
  for (const [className, { ctor, methods }] of Object.entries(classMethodCoverage)) {
    const actual = prototypeMethodNames(ctor);

    const unmapped = actual.filter((name) => !(name in methods));
    assert.deepEqual(
      unmapped,
      [],
      `${className} has methods without a coverage decision: ${unmapped.join(", ")}`,
    );

    const stale = Object.keys(methods).filter((name) => !actual.includes(name));
    assert.deepEqual(
      stale,
      [],
      `${className} coverage references removed methods: ${stale.join(", ")}`,
    );
  }
});

test("all mapped capability keys exist in the registry", () => {
  const allMappings = [
    ...Object.values(moduleFunctionCoverage).flatMap((entry) => Object.values(entry)),
    ...Object.values(classMethodCoverage).flatMap((entry) => Object.values(entry.methods)),
  ];

  for (const key of allMappings) {
    if (key === NOT_EXPOSED) continue;
    assert.ok(getCapability(key), `coverage maps to unknown capability "${key}"`);
  }
});

after(async () => {
  await closeDb();
});
