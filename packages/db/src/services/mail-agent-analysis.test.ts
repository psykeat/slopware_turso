import assert from "node:assert/strict";
import test from "node:test";

import { runMailAgentLoop } from "./mail-agent-analysis";

test("mail agent loop iterates through candidate lookups and returns unresolved review state", async () => {
  const observedEvents: string[] = [];
  let capturedOptions: any = null;

  const fakeProvider = {
    stream: async function* (options: any) {
      capturedOptions = options;
      yield { type: "RUN_STARTED", id: "run-1", timestamp: Date.now() };
      yield {
        type: "TOOL_CALL_START",
        toolCallId: "tool-1",
        toolName: "lookupMailCustomerCandidates",
        args: JSON.stringify({ senderEmail: "billing@example.com" }),
        timestamp: Date.now(),
      };
      yield {
        type: "TOOL_CALL_ARGS",
        toolCallId: "tool-1",
        delta: '{"senderEmail":"billing@example.com"}',
        args: '{"senderEmail":"billing@example.com"}',
        timestamp: Date.now(),
      };
      yield {
        type: "TOOL_CALL_END",
        toolCallId: "tool-1",
        toolName: "lookupMailCustomerCandidates",
        output: { status: "multiple_matches" },
        timestamp: Date.now(),
      };
      yield {
        type: "TOOL_CALL_START",
        toolCallId: "tool-2",
        toolName: "lookupMailCustomerCandidates",
        args: JSON.stringify({ companyName: "Example GmbH" }),
        timestamp: Date.now(),
      };
      yield {
        type: "TOOL_CALL_END",
        toolCallId: "tool-2",
        toolName: "lookupMailCustomerCandidates",
        output: { status: "no_match" },
        timestamp: Date.now(),
      };
      yield {
        type: "TOOL_CALL_START",
        toolCallId: "tool-3",
        toolName: "lookupMailReferenceDocumentCandidates",
        args: JSON.stringify({ documentNo: "ANG-000123" }),
        timestamp: Date.now(),
      };
      yield {
        type: "TOOL_CALL_END",
        toolCallId: "tool-3",
        toolName: "lookupMailReferenceDocumentCandidates",
        output: { status: "unique_match" },
        timestamp: Date.now(),
      };
      yield { type: "TEXT_MESSAGE_START", id: "msg-1", timestamp: Date.now() };
      yield {
        type: "TEXT_MESSAGE_CONTENT",
        id: "msg-1",
        delta: `{"businessIntent":"order_from_existing_offer","confidenceScore":0.77,"summary":"Antwort auf Angebot prüfen","evidence":[{"quote":"Bitte bestätigen Sie ANG-000123","explanation":"Dokumentreferenz im Thread"}],"extractedReferences":{"documentNo":"ANG-000123","documentType":"Offer","customerNo":null,"companyName":"Example GmbH","senderEmail":"billing@example.com","senderName":"Muster AG"},"requestedResolvers":[{"resolverType":"address","hint":{"senderEmail":"billing@example.com"},"reason":"Senderdaten prüfen"},{"resolverType":"document","hint":{"documentNo":"ANG-000123","documentTypeHint":"Offer"},"reason":"Angebotsreferenz prüfen"}],"blockingQuestions":["select_customer"],"resolution":{"resolutionStatus":"needs_user_input","addressResolution":{"status":"multiple_matches","candidates":[{"id":"addr-1","label":"Example GmbH","score":0.85,"recommended":false,"reasons":["Fuzzy-Match über Firmennamen: Example GmbH"]}]},"documentResolution":{"status":"unique_match","candidates":[{"id":"doc-1","label":"Offer ANG-000123 vom 2026-01-01 (Betrag: 100.00)","score":1,"recommended":true,"reasons":["Direkter Treffer auf Belegnummer: ANG-000123"]}]},"warnings":["Ambiguous customer"],"selectedBundleId":"classify_only"},"warnings":["Ambiguous customer"]}`,
        timestamp: Date.now(),
      };
      yield {
        type: "TEXT_MESSAGE_END",
        id: "msg-1",
        content:
          '{"businessIntent":"order_from_existing_offer","confidenceScore":0.77,"summary":"Antwort auf Angebot prüfen","evidence":[{"quote":"Bitte bestätigen Sie ANG-000123","explanation":"Dokumentreferenz im Thread"}],"extractedReferences":{"documentNo":"ANG-000123","documentType":"Offer","customerNo":null,"companyName":"Example GmbH","senderEmail":"billing@example.com","senderName":"Muster AG"},"requestedResolvers":[{"resolverType":"address","hint":{"senderEmail":"billing@example.com"},"reason":"Senderdaten prüfen"},{"resolverType":"document","hint":{"documentNo":"ANG-000123","documentTypeHint":"Offer"},"reason":"Angebotsreferenz prüfen"}],"blockingQuestions":["select_customer"],"resolution":{"resolutionStatus":"needs_user_input","addressResolution":{"status":"multiple_matches","candidates":[{"id":"addr-1","label":"Example GmbH","score":0.85,"recommended":false,"reasons":["Fuzzy-Match über Firmennamen: Example GmbH"]}]},"documentResolution":{"status":"unique_match","candidates":[{"id":"doc-1","label":"Offer ANG-000123 vom 2026-01-01 (Betrag: 100.00)","score":1,"recommended":true,"reasons":["Direkter Treffer auf Belegnummer: ANG-000123"]}]},"warnings":["Ambiguous customer"],"selectedBundleId":"classify_only"},"warnings":["Ambiguous customer"]}',
        timestamp: Date.now(),
      };
      yield {
        type: "RUN_FINISHED",
        id: "run-1",
        finishReason: "stop",
        timestamp: Date.now(),
      };
    },
  };

  const result = await runMailAgentLoop({
    tenantId: "019e2889-5cd7-714b-9922-08a75fdfbaac",
    threadId: "thread-1",
    providerConfig: { provider: "google_ai_studio", model: "gemini-2.5-flash" },
    provider: fakeProvider as any,
    projection: {
      threadId: "thread-1",
      subject: "Re: ANG-000123",
      relatedDocumentId: null,
      relatedAddressId: null,
      content: "Please confirm ANG-000123 for Example GmbH.",
    } as any,
    onChunk: (chunk) => {
      observedEvents.push(String((chunk as any).type));
    },
  });

  assert.equal(capturedOptions.agentLoopStrategy({ iterationCount: 7 }), true);
  assert.equal(capturedOptions.agentLoopStrategy({ iterationCount: 8 }), false);

  const toolNames = (capturedOptions.tools ?? []).map(
    (tool: any) => tool.function?.name ?? tool.name,
  );
  assert.ok(toolNames.includes("lookupMailCustomerCandidates"));
  assert.ok(toolNames.includes("lookupMailReferenceDocumentCandidates"));

  assert.deepEqual(observedEvents.slice(0, 4), [
    "RUN_STARTED",
    "TOOL_CALL_START",
    "TOOL_CALL_ARGS",
    "TOOL_CALL_END",
  ]);

  assert.equal(result.analysis.businessIntent, "order_from_existing_offer");
  assert.equal(result.analysis.resolution.addressResolution.status, "multiple_matches");
  assert.equal(result.analysis.resolution.documentResolution.status, "unique_match");
  assert.equal(result.analysis.blockingQuestions[0], "select_customer");
});
