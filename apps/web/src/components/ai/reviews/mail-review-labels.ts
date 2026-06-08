type AddressLike = {
  addressId?: unknown;
  addressNo?: unknown;
  companyName?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  name?: unknown;
};

type DocumentLike = {
  documentId?: unknown;
  documentNo?: unknown;
  documentType?: unknown;
  companyName?: unknown;
  customerName?: unknown;
};

function asTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeIdPrefix(value: unknown, fallback = "unaufgelöst"): string {
  const id = asTrimmedString(value);
  return id ? id.slice(0, 8) : fallback;
}

export function formatAddressLabel(
  address: AddressLike | null | undefined,
  fallback = "Unaufgelöst",
) {
  if (!address || typeof address !== "object") return fallback;

  const companyName = asTrimmedString(address.companyName);
  if (companyName) return companyName;

  const legacyName = asTrimmedString(address.name);
  if (legacyName) return legacyName;

  const firstName = asTrimmedString(address.firstName);
  const lastName = asTrimmedString(address.lastName);
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  if (name) return name;

  const addressNo =
    asTrimmedString(address.addressNo) ?? safeIdPrefix(address.addressId, "unaufgelöst");
  return `Geschäftspartner #${addressNo}`;
}

export function formatDocumentLabel(
  document: DocumentLike | null | undefined,
  fallback = "Unaufgelöst",
) {
  if (!document || typeof document !== "object") return fallback;

  const type = asTrimmedString(document.documentType) || "Beleg";
  const number =
    asTrimmedString(document.documentNo) || safeIdPrefix(document.documentId, "unaufgelöst");
  const company = asTrimmedString(document.companyName) || asTrimmedString(document.customerName);

  if (!number) return fallback;
  return company ? `${type} ${number} · ${company}` : `${type} ${number}`;
}

export function formatResolverId(value: unknown, fallback = "Unaufgelöst"): string {
  return asTrimmedString(value) ?? fallback;
}

export { safeIdPrefix };
