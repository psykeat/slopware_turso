import assert from "node:assert/strict";
import test from "node:test";

import { planTenantFieldReconciliation } from "./seed-metadata";

test("plans inserts for new schema fields and updates for changed field types", () => {
  const discovered = [
    {
      entityName: "article",
      fieldName: "articleNo",
      fieldType: "text",
      label: { en: "Article No", de: "Artikelnummer" },
      isVisible: true,
      isRequired: true,
    },
    {
      entityName: "article",
      fieldName: "netPrice",
      fieldType: "numeric",
      label: { en: "Net Price", de: "Netto-Preis" },
      isVisible: true,
      isRequired: false,
    },
    {
      entityName: "company",
      fieldName: "isActive",
      fieldType: "boolean",
      label: { en: "Active", de: "Aktiv" },
      isVisible: true,
      isRequired: true,
    },
  ];

  const existing = [
    { entityName: "article", fieldName: "articleNo", fieldType: "varchar" },
    { entityName: "company", fieldName: "isActive", fieldType: "boolean" },
  ];

  const plan = planTenantFieldReconciliation(discovered, existing);

  assert.equal(plan.total, 3);
  assert.equal(plan.inserts.length, 1);
  assert.deepEqual(plan.inserts[0], discovered[1]);
  assert.equal(plan.updates.length, 1);
  assert.deepEqual(plan.updates[0], {
    entityName: "article",
    fieldName: "articleNo",
    fieldType: "text",
  });
  assert.equal(plan.unchanged, 1);
});

test("is idempotent after inserts and type patches have been applied", () => {
  const discovered = [
    {
      entityName: "article",
      fieldName: "articleNo",
      fieldType: "text",
      label: { en: "Article No", de: "Artikelnummer" },
      isVisible: true,
      isRequired: true,
    },
    {
      entityName: "article",
      fieldName: "netPrice",
      fieldType: "numeric",
      label: { en: "Net Price", de: "Netto-Preis" },
      isVisible: true,
      isRequired: false,
    },
  ];

  const appliedState = discovered.map(({ entityName, fieldName, fieldType }) => ({
    entityName,
    fieldName,
    fieldType,
  }));

  const plan = planTenantFieldReconciliation(discovered, appliedState);

  assert.equal(plan.inserts.length, 0);
  assert.equal(plan.updates.length, 0);
  assert.equal(plan.unchanged, 2);
});
