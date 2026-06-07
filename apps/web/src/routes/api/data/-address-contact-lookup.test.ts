import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAddressContactSearchTerm,
  formatAddressContactName,
  normalizeAddressContactLookupRow,
} from "./-address-contact-lookup";

test("formatAddressContactName joins first and last names", () => {
  assert.equal(formatAddressContactName("Max", "Mustermann"), "Max Mustermann");
  assert.equal(formatAddressContactName(null, "Mustermann"), "Mustermann");
});

test("buildAddressContactSearchTerm trims the term", () => {
  assert.equal(buildAddressContactSearchTerm("  max  "), "%max%");
});

test("normalizeAddressContactLookupRow ensures a usable name field", () => {
  const row = normalizeAddressContactLookupRow({
    contactId: "contact-1",
    addressId: "address-1",
    name: null,
    firstName: "Max",
    lastName: "Mustermann",
    email: "max@example.com",
    isPrimary: true,
  });

  assert.deepEqual(row, {
    contactId: "contact-1",
    addressId: "address-1",
    name: "Max Mustermann",
    firstName: "Max",
    lastName: "Mustermann",
    email: "max@example.com",
    isPrimary: true,
  });
});
