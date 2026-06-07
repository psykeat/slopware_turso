import assert from "node:assert/strict";
import test from "node:test";

import { upsertAiTranscriptEntry } from "./ai-transcript";

test("upsertAiTranscriptEntry appends and updates live transcript entries", () => {
  const base = upsertAiTranscriptEntry([], {
    id: "step-1",
    kind: "reasoning",
    title: "Denken",
    detail: "Analyse ",
  });

  const continued = upsertAiTranscriptEntry(base, {
    id: "step-1",
    kind: "reasoning",
    title: "Denken",
    detail: "läuft",
  });

  const toolStarted = upsertAiTranscriptEntry(continued, {
    id: "tool-1",
    kind: "tool",
    title: "Tool: lookupMailCustomerCandidates",
    detail: "wird ausgeführt",
  });

  const toolFinished = upsertAiTranscriptEntry(
    toolStarted,
    {
      id: "tool-1",
      kind: "tool",
      title: "Tool: lookupMailCustomerCandidates",
      detail: "unique_match",
    },
    true,
  );

  assert.equal(continued[0].detail, "Analyse läuft");
  assert.equal(toolFinished[1].detail, "unique_match");
  assert.equal(toolFinished.length, 2);
});
