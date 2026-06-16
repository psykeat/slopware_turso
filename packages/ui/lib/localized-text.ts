export type LocalizedText = Record<string, string>;

export function isLocalizedText(value: unknown): value is LocalizedText {
  return typeof value === "object" && value !== null && ("en" in value || "de" in value);
}

export function resolveLocalizedText(value: LocalizedText | null | undefined, lang: string): string {
  if (!value) return "";
  return value[lang] ?? value.en ?? value.de ?? Object.values(value)[0] ?? "";
}
