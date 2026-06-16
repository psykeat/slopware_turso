import assert from "node:assert/strict";
import test from "node:test";

import { resolveLookupMetadata } from "./metadata";

test("articleVariant lookup metadata falls back to SKU and lookupLabel", () => {
  const metadata = resolveLookupMetadata({ lookupTable: "articleVariant" }, []);

  assert.equal(metadata.inferredPkColumn, "variantId");
  assert.equal(metadata.inferredDisplayColumn, "lookupLabel");
  assert.equal(metadata.inferredCodeColumn, "sku");
  assert.equal(metadata.inferredValueColumn, "variantId");
  assert.equal(metadata.lookupSortColumn, "sku");
});

test("country lookup metadata resolves with registries", () => {
  const registries = [
    {
      tableName: "country",
      pkColumn: "iso2Code",
      displayColumn: "name",
      codeColumn: "iso2Code",
      valueColumn: "iso2Code",
      sortColumn: "iso2Code",
    }
  ];
  const metadata = resolveLookupMetadata({ lookupTable: "country" }, registries);

  assert.equal(metadata.inferredPkColumn, "iso2Code");
  assert.equal(metadata.inferredValueColumn, "iso2Code");
  assert.equal(metadata.inferredDisplayColumn, "name");
  assert.equal(metadata.inferredCodeColumn, "iso2Code");
});

test("currency lookup metadata resolves with registries", () => {
  const registries = [
    {
      tableName: "currency",
      pkColumn: "code",
      displayColumn: "name",
      codeColumn: "code",
      valueColumn: "code",
      sortColumn: "code",
    }
  ];
  const metadata = resolveLookupMetadata({ lookupTable: "currency" }, registries);

  assert.equal(metadata.inferredPkColumn, "code");
  assert.equal(metadata.inferredValueColumn, "code");
  assert.equal(metadata.inferredDisplayColumn, "name");
  assert.equal(metadata.inferredCodeColumn, "code");
});
