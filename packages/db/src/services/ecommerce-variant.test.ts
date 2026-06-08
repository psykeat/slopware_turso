import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalizeVariantOptionValueIds,
  createArticleVariantOptionValueHash,
} from "./ecommerce-variant";

test("canonicalizeVariantOptionValueIds sorts by option axis and value id", () => {
  assert.deepEqual(
    canonicalizeVariantOptionValueIds([
      { optionName: "Size", valueId: "size-l" },
      { optionName: "Color", valueId: "color-red" },
    ]),
    ["color-red", "size-l"],
  );
});

test("createArticleVariantOptionValueHash is stable across payload order", () => {
  const firstHash = createArticleVariantOptionValueHash([
    { optionName: "Size", valueId: "size-l" },
    { optionName: "Color", valueId: "color-red" },
  ]);
  const secondHash = createArticleVariantOptionValueHash([
    { optionName: "color", valueId: "color-red" },
    { optionName: "size", valueId: "size-l" },
  ]);
  const differentHash = createArticleVariantOptionValueHash([
    { optionName: "Color", valueId: "color-blue" },
    { optionName: "Size", valueId: "size-l" },
  ]);

  assert.equal(firstHash, secondHash);
  assert.notEqual(firstHash, differentHash);
});
