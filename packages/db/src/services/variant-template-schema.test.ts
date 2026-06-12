import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_SKU_PATTERN,
  parseVariantTemplateDefinition,
  renderSkuPattern,
  type VariantTemplateDefinition,
} from "./variant-template-schema";

function buildValidDefinition(): VariantTemplateDefinition {
  return {
    version: 1,
    productTypeLabel: "T-Shirt",
    axes: [
      {
        name: "Farbe",
        sortOrder: 0,
        values: [
          { value: "Navy", sortOrder: 0, skuCode: "NV", priceSurcharge: 0 },
          { value: "Rot", sortOrder: 1 },
        ],
      },
      {
        name: "Größe",
        sortOrder: 1,
        values: [
          { value: "M", sortOrder: 0 },
          { value: "XL", sortOrder: 1, priceSurcharge: 2 },
        ],
      },
    ],
    skuPattern: "{articleNo}-{axis:Farbe}-{axis:Größe}",
    exclusions: [
      {
        id: "no-rot-xl",
        label: "Rot nicht in XL",
        when: { axis: "Farbe", value: "Rot" },
        exclude: { axis: "Größe", values: ["XL"] },
      },
    ],
    defaults: { priceMode: "surchargeOnBase", weightMode: "inherit" },
  };
}

test("accepts a valid definition", () => {
  const result = parseVariantTemplateDefinition(buildValidDefinition());
  assert.equal(result.ok, true);
});

test("round-trips through JSON", () => {
  const definition = buildValidDefinition();
  const result = parseVariantTemplateDefinition(JSON.parse(JSON.stringify(definition)));
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.definition, definition);
  }
});

test("rejects non-object input", () => {
  const result = parseVariantTemplateDefinition("not a template");
  assert.equal(result.ok, false);
});

test("rejects unknown version", () => {
  const definition = { ...buildValidDefinition(), version: 2 };
  const result = parseVariantTemplateDefinition(definition);
  assert.equal(result.ok, false);
});

test("rejects empty axes", () => {
  const definition = { ...buildValidDefinition(), axes: [] };
  const result = parseVariantTemplateDefinition(definition);
  assert.equal(result.ok, false);
});

test("rejects axis without values", () => {
  const definition = buildValidDefinition();
  definition.axes[0].values = [];
  const result = parseVariantTemplateDefinition(definition);
  assert.equal(result.ok, false);
});

test("rejects duplicate axis names (case-insensitive)", () => {
  const definition = buildValidDefinition();
  definition.axes.push({
    name: " farbe ",
    sortOrder: 2,
    values: [{ value: "Grün", sortOrder: 0 }],
  });
  const result = parseVariantTemplateDefinition(definition);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.some((error) => error.includes("doppelt definiert")));
  }
});

test("rejects duplicate values within an axis", () => {
  const definition = buildValidDefinition();
  definition.axes[0].values.push({ value: "navy", sortOrder: 2 });
  const result = parseVariantTemplateDefinition(definition);
  assert.equal(result.ok, false);
});

test("rejects exclusion rule referencing unknown axis", () => {
  const definition = buildValidDefinition();
  definition.exclusions = [
    {
      id: "bad-axis",
      when: { axis: "Material", value: "Holz" },
      exclude: { axis: "Größe", values: ["XL"] },
    },
  ];
  const result = parseVariantTemplateDefinition(definition);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.some((error) => error.includes("Material")));
  }
});

test("rejects exclusion rule referencing unknown value", () => {
  const definition = buildValidDefinition();
  definition.exclusions = [
    {
      id: "bad-value",
      when: { axis: "Farbe", value: "Lila" },
      exclude: { axis: "Größe", values: ["XL"] },
    },
  ];
  const result = parseVariantTemplateDefinition(definition);
  assert.equal(result.ok, false);
});

test("rejects duplicate exclusion rule ids", () => {
  const definition = buildValidDefinition();
  definition.exclusions = [
    {
      id: "dup",
      when: { axis: "Farbe", value: "Rot" },
      exclude: { axis: "Größe", values: ["XL"] },
    },
    {
      id: "dup",
      when: { axis: "Farbe", value: "Navy" },
      exclude: { axis: "Größe", values: ["M"] },
    },
  ];
  const result = parseVariantTemplateDefinition(definition);
  assert.equal(result.ok, false);
});

test("renders SKU pattern with skuCode and value slug", () => {
  const sku = renderSkuPattern("{articleNo}-{axis:Farbe}-{axis:Größe}", {
    articleNo: "A1000",
    hash: "abcdef1234567890",
    axisValues: [
      { axisName: "Farbe", value: "Navy", skuCode: "NV" },
      { axisName: "Größe", value: "XL" },
    ],
  });
  assert.equal(sku, "A1000-NV-XL");
});

test("renders hash token with length", () => {
  const sku = renderSkuPattern("{articleNo}-{hash:8}", {
    articleNo: "A1000",
    hash: "abcdef1234567890",
    axisValues: [],
  });
  assert.equal(sku, "A1000-abcdef12");
});

test("slugifies values without skuCode (umlauts, spaces, length cap)", () => {
  const sku = renderSkuPattern("{axis:Farbe}", {
    articleNo: "A1000",
    hash: "abcdef1234567890",
    axisValues: [{ axisName: "Farbe", value: "Dunkelgrün metallic" }],
  });
  assert.equal(sku, "DUNKEL");
});

test("collapses separators from unknown axes and trims edges", () => {
  const sku = renderSkuPattern("{articleNo}-{axis:Material}-{axis:Farbe}", {
    articleNo: "A1000",
    hash: "abcdef1234567890",
    axisValues: [{ axisName: "Farbe", value: "Navy", skuCode: "NV" }],
  });
  assert.equal(sku, "A1000-NV");
});

test("falls back to default pattern when result is empty", () => {
  const sku = renderSkuPattern("{axis:Material}", {
    articleNo: "A1000",
    hash: "abcdef1234567890",
    axisValues: [],
  });
  assert.equal(
    sku,
    renderSkuPattern(DEFAULT_SKU_PATTERN, {
      articleNo: "A1000",
      hash: "abcdef1234567890",
      axisValues: [],
    }),
  );
  assert.equal(sku, "A1000-abcdef12");
});
