import assert from "node:assert/strict";
import test from "node:test";

import {
  formatRecipientAutocompleteContact,
  getRecipientTokenRange,
  replaceRecipientToken,
} from "./email-recipient-autocomplete";

test("formatRecipientAutocompleteContact prefers full name and email", () => {
  assert.equal(
    formatRecipientAutocompleteContact({
      contactId: "contact-1",
      addressId: "address-1",
      firstName: "Max",
      lastName: "Mustermann",
      email: "max@example.com",
    }),
    "Max Mustermann <max@example.com>",
  );
});

test("formatRecipientAutocompleteContact falls back to the stored name", () => {
  assert.equal(
    formatRecipientAutocompleteContact({
      contactId: "contact-1",
      addressId: "address-1",
      firstName: null,
      lastName: "Mustermann",
      email: "max@example.com",
      name: "Max Mustermann",
    }),
    "Max Mustermann <max@example.com>",
  );
});

test("getRecipientTokenRange isolates the active recipient token", () => {
  assert.deepEqual(getRecipientTokenRange("a@example.com, be", 17, 17), {
    start: 14,
    end: 17,
    query: "be",
  });
});

test("replaceRecipientToken preserves trailing recipients", () => {
  assert.equal(
    replaceRecipientToken(
      "be, ce@example.com",
      { start: 0, end: 2 },
      "Ben Example <ben@example.com>",
    ),
    "Ben Example <ben@example.com>, ce@example.com",
  );
});
