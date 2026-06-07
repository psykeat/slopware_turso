import {
  createConfiguredProvider,
  createMailResolutionTools,
  maxIterations,
  type AgentProvider,
  type LlmProviderConfig,
  type StreamChunk,
} from "@repo/agent";

import { buildMailThreadProjection } from "./ai-context-projection";

type MailCandidate = {
  id: string;
  label: string;
  score: number;
  recommended: boolean;
  reasons: string[];
};

export type MailAgentAnalysis = {
  businessIntent: string;
  confidenceScore: number;
  summary: string;
  evidence: Array<{ quote: string; explanation: string }>;
  extractedReferences: {
    documentNo: string | null;
    documentType: string | null;
    customerNo: string | null;
    companyName: string | null;
    senderEmail?: string | null;
    senderName?: string | null;
  };
  requestedResolvers: Array<{
    resolverType: "address" | "document";
    hint: Record<string, unknown>;
    reason: string;
  }>;
  blockingQuestions: string[];
  resolution: {
    resolutionStatus: "resolved" | "partially_resolved" | "needs_user_input";
    addressResolution: {
      status: "unique_match" | "multiple_matches" | "no_match" | "not_requested";
      candidates: MailCandidate[];
    };
    documentResolution: {
      status: "unique_match" | "multiple_matches" | "no_match" | "not_requested";
      candidates: MailCandidate[];
    };
    warnings: string[];
    selectedBundleId?: string | null;
  };
  warnings?: string[];
};

export type MailAgentLoopParams = {
  tenantId: string;
  threadId: string;
  rawInput?: string;
  customInstructions?: string;
  providerConfig: LlmProviderConfig;
  provider?: AgentProvider;
  projection?: Awaited<ReturnType<typeof buildMailThreadProjection>> | null;
  onChunk?: (chunk: StreamChunk) => void | Promise<void>;
  abortController?: AbortController;
};

function stripCodeFences(value: string) {
  return value
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function fallbackAnalysis(): MailAgentAnalysis {
  return {
    businessIntent: "other_unclear",
    confidenceScore: 0.1,
    summary: "Mail analysis did not return a structured result.",
    evidence: [],
    extractedReferences: {
      documentNo: null,
      documentType: null,
      customerNo: null,
      companyName: null,
      senderEmail: null,
      senderName: null,
    },
    requestedResolvers: [],
    blockingQuestions: ["select_customer"],
    resolution: {
      resolutionStatus: "needs_user_input",
      addressResolution: { status: "no_match", candidates: [] },
      documentResolution: { status: "no_match", candidates: [] },
      warnings: ["The agent loop did not produce structured JSON."],
    },
    warnings: ["The agent loop did not produce structured JSON."],
  };
}

function buildMailAgentPrompt(params: {
  projection: Awaited<ReturnType<typeof buildMailThreadProjection>>;
  customInstructions?: string;
}) {
  const thread = params.projection;
  return `You are a server-side mail analysis agent in slopware.

Goal:
- Classify the incoming email thread.
- Resolve the customer candidate using read-only tools.
- Resolve the reference document candidate using read-only tools.
- If the customer cannot be uniquely resolved within the tool budget, return a result that makes the unresolved state explicit so the user can choose manually.

Important:
- Use the tools iteratively. Start with sender email, then sender name or company name, then document reference paths.
- Do not invent ids, customer numbers, or document numbers.
- If the lookup remains ambiguous or the loop budget is exhausted, return the best candidates you found and mark the resolution as needing user input.
- Return only valid JSON. No markdown fences, no commentary.

Return this exact top-level structure:
{
  "businessIntent": "order_from_existing_offer" | "new_quote_request" | "complaint" | "delivery_status_request" | "invoice_or_document" | "other_unclear",
  "confidenceScore": 0.0,
  "summary": "German one-sentence summary",
  "evidence": [{ "quote": "exact quote", "explanation": "why this matters" }],
  "extractedReferences": {
    "documentNo": "string | null",
    "documentType": "Offer | Order | Invoice | DeliveryNote | null",
    "customerNo": "string | null",
    "companyName": "string | null",
    "senderEmail": "string | null",
    "senderName": "string | null"
  },
  "requestedResolvers": [
    {
      "resolverType": "address" | "document",
      "hint": {
        "senderEmail": "string | null",
        "senderName": "string | null",
        "companyName": "string | null",
        "documentNo": "string | null",
        "documentTypeHint": "Offer | Order | Invoice | DeliveryNote | null"
      },
      "reason": "string"
    }
  ],
  "blockingQuestions": ["select_customer" | "select_reference_document"],
  "resolution": {
    "resolutionStatus": "resolved" | "partially_resolved" | "needs_user_input",
    "addressResolution": {
      "status": "unique_match" | "multiple_matches" | "no_match" | "not_requested",
      "candidates": [{ "id": "string", "label": "string", "score": 0.0, "recommended": true, "reasons": ["string"] }]
    },
    "documentResolution": {
      "status": "unique_match" | "multiple_matches" | "no_match" | "not_requested",
      "candidates": [{ "id": "string", "label": "string", "score": 0.0, "recommended": true, "reasons": ["string"] }]
    },
    "warnings": ["string"],
    "selectedBundleId": "classify_only | convert_offer_to_order | convert_and_prepare_reply | null"
  },
  "warnings": ["string"]
}

Thread context:
${JSON.stringify(thread, null, 2)}

${params.customInstructions ? `Additional instructions:\n${params.customInstructions}\n` : ""}
`;
}

function parseFinalAnalysis(value: string): MailAgentAnalysis | null {
  const cleaned = stripCodeFences(value);
  if (!cleaned) return null;
  try {
    const parsed = JSON.parse(cleaned) as Partial<MailAgentAnalysis>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      ...fallbackAnalysis(),
      ...parsed,
      resolution: {
        ...fallbackAnalysis().resolution,
        ...(parsed.resolution ?? {}),
        addressResolution: {
          ...fallbackAnalysis().resolution.addressResolution,
          ...(parsed.resolution?.addressResolution ?? {}),
        },
        documentResolution: {
          ...fallbackAnalysis().resolution.documentResolution,
          ...(parsed.resolution?.documentResolution ?? {}),
        },
      },
      extractedReferences: {
        ...fallbackAnalysis().extractedReferences,
        ...(parsed.extractedReferences ?? {}),
      },
      requestedResolvers: Array.isArray(parsed.requestedResolvers)
        ? (parsed.requestedResolvers as MailAgentAnalysis["requestedResolvers"])
        : [],
      evidence: Array.isArray(parsed.evidence) ? parsed.evidence : [],
      blockingQuestions: Array.isArray(parsed.blockingQuestions)
        ? parsed.blockingQuestions.filter((item): item is string => typeof item === "string")
        : [],
      warnings: Array.isArray(parsed.warnings)
        ? parsed.warnings.filter((item): item is string => typeof item === "string")
        : undefined,
    };
  } catch {
    return null;
  }
}

export async function runMailAgentLoop(params: MailAgentLoopParams): Promise<{
  analysis: MailAgentAnalysis;
  finalText: string;
}> {
  const projection =
    params.projection !== undefined
      ? params.projection
      : await buildMailThreadProjection(params.threadId, params.tenantId);
  if (!projection) {
    throw new Error("Mail thread not found");
  }

  const provider = params.provider ?? createConfiguredProvider(params.providerConfig);
  const tools = createMailResolutionTools({ tenantId: params.tenantId });
  const textParts: string[] = [];
  const textBuffers = new Map<string, string>();
  const stream = provider.stream({
    messages: [
      {
        role: "user",
        content: buildMailAgentPrompt({
          projection,
          customInstructions: params.customInstructions,
        }),
      },
    ],
    tools,
    agentLoopStrategy: maxIterations(8),
    ...(params.abortController ? { abortController: params.abortController } : {}),
  });

  for await (const chunk of stream) {
    await params.onChunk?.(chunk);
    if (chunk.type === "TEXT_MESSAGE_START") {
      const textId = typeof chunk.id === "string" ? chunk.id : "assistant";
      textBuffers.set(textId, "");
      continue;
    }

    if (chunk.type === "TEXT_MESSAGE_CONTENT") {
      const textId = typeof chunk.id === "string" ? chunk.id : "assistant";
      const delta = typeof chunk.delta === "string" ? chunk.delta : "";
      textBuffers.set(textId, (textBuffers.get(textId) ?? "") + delta);
      continue;
    }

    if (chunk.type === "TEXT_MESSAGE_END") {
      const textId = typeof chunk.id === "string" ? chunk.id : "assistant";
      const message =
        typeof chunk.content === "string" ? chunk.content : (textBuffers.get(textId) ?? "");
      if (message) {
        textParts.push(message);
      }
      textBuffers.delete(textId);
    }
  }

  const finalText = textParts.join("");
  const analysis = parseFinalAnalysis(finalText) ?? fallbackAnalysis();
  return { analysis, finalText };
}
