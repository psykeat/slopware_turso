import { createHash } from "node:crypto";

export const DEFAULT_VARIANT_OPTION_VALUE_HASH =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

export type VariantOptionValueIdentity = {
  optionName: string;
  valueId: string;
};

export function canonicalizeVariantOptionValueIds(
  optionValues: readonly VariantOptionValueIdentity[],
) {
  return optionValues
    .map((optionValue) => ({
      optionName: optionValue.optionName.trim().toLocaleLowerCase("en-US"),
      valueId: optionValue.valueId.trim(),
    }))
    .sort((left, right) => {
      const optionCompare = left.optionName.localeCompare(right.optionName, "en-US");

      if (optionCompare !== 0) {
        return optionCompare;
      }

      return left.valueId.localeCompare(right.valueId, "en-US");
    })
    .map((optionValue) => optionValue.valueId);
}

export function createArticleVariantOptionValueHash(
  optionValues: readonly VariantOptionValueIdentity[],
) {
  const canonicalValueIds = canonicalizeVariantOptionValueIds(optionValues);

  return createHash("sha256").update(canonicalValueIds.join("|")).digest("hex");
}
