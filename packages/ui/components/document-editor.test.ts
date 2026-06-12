import assert from "node:assert/strict";
import test from "node:test";

import { normalizeLineForSave } from "./document-editor";

test("normalizeLineForSave preserves variantId for article lines", () => {
  const payload = normalizeLineForSave({
    _id: "line-1",
    lineNo: 1,
    articleId: "ART-001",
    variantId: "ART-001-5efa1b49",
    articleNo: "ART-001",
    articleTextSnapshot: "Test article",
    lineType: "article",
    quantity: 2,
    unit: "pcs",
    netPrice: 15,
    discountPercentage: null,
    taxCodeId: null,
    taxRate: null,
    isNew: false,
    isDeleted: false,
  });

  assert.equal(payload.variantId, "ART-001-5efa1b49");
  assert.equal(payload.lineType, "article");
});
