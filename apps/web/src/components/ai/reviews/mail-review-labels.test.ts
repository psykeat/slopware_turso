import assert from "node:assert/strict";
import test from "node:test";

import { formatAddressLabel, formatDocumentLabel, safeIdPrefix } from "./mail-review-labels";

test("mail review labels fall back for missing and malformed ids", () => {
  assert.equal(safeIdPrefix(undefined, "unbekannt"), "unbekannt");
  assert.equal(safeIdPrefix("abcdef012345"), "abcdef01");
  assert.equal(formatAddressLabel({ addressId: undefined }), "Geschäftspartner #unaufgelöst");
  assert.equal(formatDocumentLabel({ documentId: null }), "Beleg unaufgelöst");
});
