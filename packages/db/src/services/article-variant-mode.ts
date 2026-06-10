export type ArticleVariantMode = "simple" | "variants";

export function resolveArticleVariantMode(input: {
  optionCount: number;
  variantCount: number;
}): ArticleVariantMode {
  return input.optionCount > 0 || input.variantCount > 1 ? "variants" : "simple";
}
