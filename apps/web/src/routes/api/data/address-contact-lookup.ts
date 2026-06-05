export type AddressContactLookupRow = {
  contactId: string;
  addressId: string;
  name: string;
  firstName: string | null;
  lastName: string;
  email: string | null;
  isPrimary: boolean;
};

export function formatAddressContactName(firstName: string | null, lastName: string) {
  return [firstName, lastName].filter(Boolean).join(" ").trim();
}

export function buildAddressContactSearchTerm(value: string) {
  return `%${value.trim()}%`;
}

export function normalizeAddressContactLookupRow(row: {
  contactId: string;
  addressId: string;
  name: string | null;
  firstName: string | null;
  lastName: string;
  email: string | null;
  isPrimary: boolean;
}): AddressContactLookupRow {
  return {
    ...row,
    name: row.name || formatAddressContactName(row.firstName, row.lastName),
  };
}
