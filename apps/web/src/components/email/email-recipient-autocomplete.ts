import { formatAddressContactName } from "#/routes/api/data/-address-contact-lookup";

export type RecipientAutocompleteContact = {
  contactId: string;
  addressId: string;
  firstName: string | null;
  lastName: string;
  email: string | null;
  isPrimary?: boolean;
  name?: string | null;
};

export function formatRecipientAutocompleteContact(contact: RecipientAutocompleteContact) {
  const email = contact.email?.trim() || "";
  const name =
    contact.name?.trim() || formatAddressContactName(contact.firstName, contact.lastName);

  if (name && email) return `${name} <${email}>`;
  if (name) return name;
  return email;
}

export function getRecipientTokenRange(
  value: string,
  selectionStart: number,
  selectionEnd: number,
) {
  const caretStart = Math.max(0, Math.min(selectionStart, value.length));
  const caretEnd = Math.max(caretStart, Math.min(selectionEnd, value.length));
  const prefix = value.slice(0, caretStart);
  const tokenStart = Math.max(prefix.lastIndexOf(",") + 1, 0);
  const suffix = value.slice(caretEnd);
  const nextCommaIndex = suffix.indexOf(",");
  const tokenEnd = nextCommaIndex === -1 ? value.length : caretEnd + nextCommaIndex;

  return {
    start: tokenStart,
    end: tokenEnd,
    query: value.slice(tokenStart, caretStart).trim(),
  };
}

export function replaceRecipientToken(
  value: string,
  range: { start: number; end: number },
  replacement: string,
) {
  const prefix = value.slice(0, range.start);
  const suffix = value.slice(range.end).trimStart();
  if (!suffix) return `${prefix}${replacement}`;
  return `${prefix}${replacement}, ${suffix.replace(/^,\s*/, "")}`;
}
