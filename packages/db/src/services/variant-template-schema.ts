import { z } from "zod";

// Pure module: imported client-side by the settings route for JSON import
// validation. Only zod is allowed as a dependency (no drizzle, no node:*).

export const VARIANT_TEMPLATE_VERSION = 1 as const;

export const DEFAULT_SKU_PATTERN = "{articleNo}-{hash:8}";

export type VariantTemplateAxisValue = {
  value: string;
  sortOrder: number;
  skuCode?: string;
  priceSurcharge?: number;
  weightDelta?: number;
};

export type VariantTemplateAxis = {
  name: string;
  sortOrder: number;
  values: VariantTemplateAxisValue[];
};

export type VariantTemplateExclusionRule = {
  id: string;
  label?: string;
  when: { axis: string; value: string };
  exclude: { axis: string; values: string[] };
};

export type VariantTemplateDefaults = {
  priceMode: "inherit" | "surchargeOnBase";
  weightMode: "inherit" | "deltaOnBase";
};

export type VariantTemplateChannelRule = {
  channelSlug: string;
  includeWhen?: { axis: string; values: string[] };
};

export type VariantTemplateDefinition = {
  version: typeof VARIANT_TEMPLATE_VERSION;
  productTypeLabel: string;
  axes: VariantTemplateAxis[];
  skuPattern?: string;
  exclusions?: VariantTemplateExclusionRule[];
  defaults?: VariantTemplateDefaults;
  channelVisibility?: VariantTemplateChannelRule[];
};

// Must stay identical to the normalization inside
// canonicalizeVariantOptionValueIds (ecommerce-variant.ts).
export function normalizeAxisName(name: string): string {
  return name.trim().toLocaleLowerCase("en-US");
}

export function normalizeAxisValue(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

const axisValueSchema = z.object({
  value: z.string().trim().min(1),
  sortOrder: z.number().int(),
  skuCode: z.string().trim().min(1).max(12).optional(),
  priceSurcharge: z.number().optional(),
  weightDelta: z.number().optional(),
});

const axisSchema = z.object({
  name: z.string().trim().min(1),
  sortOrder: z.number().int(),
  values: z.array(axisValueSchema).min(1),
});

const exclusionRuleSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().optional(),
  when: z.object({ axis: z.string().trim().min(1), value: z.string().trim().min(1) }),
  exclude: z.object({
    axis: z.string().trim().min(1),
    values: z.array(z.string().trim().min(1)).min(1),
  }),
});

const defaultsSchema = z.object({
  priceMode: z.enum(["inherit", "surchargeOnBase"]),
  weightMode: z.enum(["inherit", "deltaOnBase"]),
});

const channelRuleSchema = z.object({
  channelSlug: z.string().trim().min(1),
  includeWhen: z
    .object({
      axis: z.string().trim().min(1),
      values: z.array(z.string().trim().min(1)).min(1),
    })
    .optional(),
});

export const variantTemplateDefinitionSchema = z
  .object({
    version: z.literal(VARIANT_TEMPLATE_VERSION),
    productTypeLabel: z.string().trim().min(1),
    axes: z.array(axisSchema).min(1),
    skuPattern: z.string().trim().min(1).optional(),
    exclusions: z.array(exclusionRuleSchema).optional(),
    defaults: defaultsSchema.optional(),
    channelVisibility: z.array(channelRuleSchema).optional(),
  })
  .superRefine((definition, ctx) => {
    const axisByNormalizedName = new Map<string, VariantTemplateAxis>();

    for (const [axisIndex, axis] of definition.axes.entries()) {
      const normalized = normalizeAxisName(axis.name);
      if (axisByNormalizedName.has(normalized)) {
        ctx.addIssue({
          code: "custom",
          path: ["axes", axisIndex, "name"],
          message: `Achse "${axis.name}" ist doppelt definiert`,
        });
        continue;
      }
      axisByNormalizedName.set(normalized, axis);

      const seenValues = new Set<string>();
      for (const [valueIndex, axisValue] of axis.values.entries()) {
        const normalizedValue = normalizeAxisValue(axisValue.value);
        if (seenValues.has(normalizedValue)) {
          ctx.addIssue({
            code: "custom",
            path: ["axes", axisIndex, "values", valueIndex, "value"],
            message: `Wert "${axisValue.value}" ist in Achse "${axis.name}" doppelt definiert`,
          });
        }
        seenValues.add(normalizedValue);
      }
    }

    const axisHasValue = (axisName: string, value: string) => {
      const axis = axisByNormalizedName.get(normalizeAxisName(axisName));
      if (!axis) return false;
      const normalizedValue = normalizeAxisValue(value);
      return axis.values.some(
        (axisValue) => normalizeAxisValue(axisValue.value) === normalizedValue,
      );
    };

    const seenRuleIds = new Set<string>();
    for (const [ruleIndex, rule] of (definition.exclusions ?? []).entries()) {
      if (seenRuleIds.has(rule.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["exclusions", ruleIndex, "id"],
          message: `Regel-ID "${rule.id}" ist doppelt vergeben`,
        });
      }
      seenRuleIds.add(rule.id);

      if (!axisByNormalizedName.has(normalizeAxisName(rule.when.axis))) {
        ctx.addIssue({
          code: "custom",
          path: ["exclusions", ruleIndex, "when", "axis"],
          message: `Regel "${rule.id}": Achse "${rule.when.axis}" existiert nicht`,
        });
      } else if (!axisHasValue(rule.when.axis, rule.when.value)) {
        ctx.addIssue({
          code: "custom",
          path: ["exclusions", ruleIndex, "when", "value"],
          message: `Regel "${rule.id}": Wert "${rule.when.value}" existiert nicht in Achse "${rule.when.axis}"`,
        });
      }

      if (!axisByNormalizedName.has(normalizeAxisName(rule.exclude.axis))) {
        ctx.addIssue({
          code: "custom",
          path: ["exclusions", ruleIndex, "exclude", "axis"],
          message: `Regel "${rule.id}": Achse "${rule.exclude.axis}" existiert nicht`,
        });
      } else {
        for (const [valueIndex, value] of rule.exclude.values.entries()) {
          if (!axisHasValue(rule.exclude.axis, value)) {
            ctx.addIssue({
              code: "custom",
              path: ["exclusions", ruleIndex, "exclude", "values", valueIndex],
              message: `Regel "${rule.id}": Wert "${value}" existiert nicht in Achse "${rule.exclude.axis}"`,
            });
          }
        }
      }
    }

    for (const [channelIndex, channelRule] of (definition.channelVisibility ?? []).entries()) {
      const includeWhen = channelRule.includeWhen;
      if (!includeWhen) continue;
      if (!axisByNormalizedName.has(normalizeAxisName(includeWhen.axis))) {
        ctx.addIssue({
          code: "custom",
          path: ["channelVisibility", channelIndex, "includeWhen", "axis"],
          message: `Kanalregel "${channelRule.channelSlug}": Achse "${includeWhen.axis}" existiert nicht`,
        });
      }
    }
  });

export type ParseVariantTemplateDefinitionResult =
  | { ok: true; definition: VariantTemplateDefinition }
  | { ok: false; errors: string[] };

export function parseVariantTemplateDefinition(
  input: unknown,
): ParseVariantTemplateDefinitionResult {
  const result = variantTemplateDefinitionSchema.safeParse(input);

  if (result.success) {
    return { ok: true, definition: result.data };
  }

  return {
    ok: false,
    errors: result.error.issues.map((issue) => {
      const path = issue.path.join(".");
      return path.length > 0 ? `${path}: ${issue.message}` : issue.message;
    }),
  };
}

export type SkuPatternContext = {
  articleNo: string;
  hash: string;
  axisValues: Array<{ axisName: string; value: string; skuCode?: string }>;
};

function slugifySkuValue(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 6);
}

const SKU_TOKEN_PATTERN = /\{([^{}]+)\}/g;

function renderSkuTokens(pattern: string, context: SkuPatternContext): string {
  const rendered = pattern.replace(SKU_TOKEN_PATTERN, (_match, rawToken: string) => {
    const token = String(rawToken).trim();

    if (token === "articleNo") {
      return context.articleNo;
    }

    if (token === "hash") {
      return context.hash;
    }

    const hashMatch = /^hash:(\d+)$/.exec(token);
    if (hashMatch) {
      return context.hash.slice(0, Number(hashMatch[1]));
    }

    const axisMatch = /^axis:(.+)$/.exec(token);
    if (axisMatch) {
      const normalized = normalizeAxisName(axisMatch[1]);
      const axisValue = context.axisValues.find(
        (candidate) => normalizeAxisName(candidate.axisName) === normalized,
      );
      if (!axisValue) return "";
      return axisValue.skuCode?.trim() || slugifySkuValue(axisValue.value);
    }

    return "";
  });

  return rendered.replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "");
}

export function renderSkuPattern(pattern: string, context: SkuPatternContext): string {
  const rendered = renderSkuTokens(pattern, context);
  if (rendered.length > 0) {
    return rendered;
  }
  return renderSkuTokens(DEFAULT_SKU_PATTERN, context);
}

export function renderSkuPatternPreview(pattern: string, context: SkuPatternContext): string {
  return renderSkuPattern(pattern, context);
}

export function createEmptyVariantTemplateDefinition(): VariantTemplateDefinition {
  return {
    version: VARIANT_TEMPLATE_VERSION,
    productTypeLabel: "",
    axes: [],
    skuPattern: DEFAULT_SKU_PATTERN,
    exclusions: [],
    defaults: { priceMode: "inherit", weightMode: "inherit" },
  };
}
