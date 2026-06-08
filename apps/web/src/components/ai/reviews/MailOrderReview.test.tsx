import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { MailOrderReview } from "./MailOrderReview";

test("MailOrderReview renders safe fallbacks for malformed review ids", () => {
  const html = renderToStaticMarkup(
    <MailOrderReview
      suggestionPayload={{
        reviewId: "review-1",
        taskScope: "mail-order-review",
        headline: "",
        summary: "",
        intentBadge: {
          label: "",
          confidenceScore: 0.5,
        },
        bundles: [
          {
            bundleId: "bundle-1",
            title: "",
            description: "",
            confidenceScore: 0.5,
            recommended: true,
            readiness: "needs_user_input",
            expectedOutcomes: [],
            resolverSlots: [
              {
                slotKey: "customer",
                label: "",
                status: "resolved",
                resolvedId: null,
                displayValue: null,
                candidates: [
                  {
                    id: undefined as unknown as string,
                    label: undefined as unknown as string,
                    score: null,
                    recommended: false,
                  },
                ],
              },
              {
                slotKey: "referenceDocument",
                label: "",
                status: "resolved",
                resolvedId: null,
                displayValue: null,
                candidates: [
                  {
                    id: undefined as unknown as string,
                    label: undefined as unknown as string,
                    score: null,
                    recommended: false,
                  },
                ],
              },
            ],
            commandPreview: [],
            followUpOptions: [],
            warnings: [],
          },
        ],
        selectedBundleId: null,
        warnings: [],
        blockingIssues: [],
        selectedAddressId: null,
        selectedDocumentId: null,
        extraReplyInstruction: null,
      }}
      validation={{}}
      onPatch={() => {}}
    />,
  );

  assert.match(html, /Geschäftspartner #unaufgelöst/i);
  assert.match(html, /Unaufgelöst/);
});
