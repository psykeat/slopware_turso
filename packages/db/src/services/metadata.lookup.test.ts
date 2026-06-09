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
