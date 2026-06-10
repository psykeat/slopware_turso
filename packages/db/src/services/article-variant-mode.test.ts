import assert from "node:assert/strict";
import test from "node:test";

import { resolveArticleVariantMode } from "./article-variant-mode";

test("variant mode is derived from option and variant data", () => {
  assert.equal(resolveArticleVariantMode({ optionCount: 0, variantCount: 1 }), "simple");
  assert.equal(resolveArticleVariantMode({ optionCount: 1, variantCount: 1 }), "variants");
  assert.equal(resolveArticleVariantMode({ optionCount: 0, variantCount: 2 }), "variants");
});
