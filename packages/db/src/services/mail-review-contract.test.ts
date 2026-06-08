import assert from "node:assert/strict";
import test from "node:test";

import { normalizeMailReviewPayload } from "./mail-review-contract";

test("normalizeMailReviewPayload coerces malformed bundles and ids into safe primitives", () => {
  const normalized = normalizeMailReviewPayload({
    reviewId: undefined,
    taskScope: undefined,
    headline: undefined,
    summary: undefined,
    intentBadge: {
      label: undefined,
      confidenceScore: "0.75",
    },
    bundles: [
      {
        recommended: true,
        resolverSlots: [
          {
            slotKey: "customer",
            status: "resolved",
            resolvedId: undefined,
            displayValue: "Fallback customer",
            candidates: [
              {
                id: undefined,
                label: undefined,
                score: "0.8",
                recommended: "yes",
              },
            ],
          },
        ],
        warnings: [undefined, "warn"],
      },
    ],
    selectedBundleId: "missing",
    warnings: ["top", null],
    blockingIssues: [
      {
        code: undefined,
        message: undefined,
        resolutionType: undefined,
      },
    ],
    extraReplyInstruction: undefined,
    selectedAddressId: undefined,
    selectedDocumentId: undefined,
  });

  assert.equal(normalized.reviewId, "");
  assert.equal(normalized.taskScope, "");
  assert.equal(normalized.selectedBundleId, "bundle-1");
  assert.equal(normalized.selectedAddressId, null);
  assert.equal(normalized.selectedDocumentId, null);
  assert.equal(normalized.bundles[0].bundleId, "bundle-1");
  assert.equal(normalized.bundles[0].resolverSlots[0].candidates[0].id, "");
  assert.equal(normalized.bundles[0].resolverSlots[0].candidates[0].label, "Unaufgelöst");
  assert.equal(normalized.warnings.length, 1);
  assert.equal(normalized.blockingIssues[0].code, "");
  assert.equal(normalized.extraReplyInstruction, "");
});
