import { createDecipheriv, randomUUID } from "crypto";

import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "../index";
import {
  aiPromptVersion,
  aiRun,
  aiTurn,
  systemSettings,
  aiInterpretation,
  aiReview,
  emailIdentity,
  emailMessage,
  emailThread,
  aiMemory,
} from "../schema/app.schema";
import * as schema from "../schema/index";
import { createAiToolCall, createAiTurn, updateAiToolCallStatus } from "./ai-persistence";
import { EmailDocumentService } from "./email/document-service";
import { runMailAgentLoop, type MailAgentAnalysis } from "./mail-agent-analysis";
import {
  normalizeMailReviewPayload,
  type NormalizedMailReviewPayload,
} from "./mail-review-contract";

const DOC_TYPE_MAP: Record<string, string> = {
  Offer: "N",
  Order: "A",
  DeliveryNote: "L",
  Invoice: "R",
};

const DOC_TYPE_REVERSE_MAP: Record<string, string> = {
  N: "Offer",
  A: "Order",
  L: "DeliveryNote",
  R: "Invoice",
};

const MAIL_BUNDLE_IDS = {
  classifyOnly: "classify_only",
  convertOfferToOrder: "convert_offer_to_order",
  convertAndPrepareReply: "convert_and_prepare_reply",
} as const;

type MailBundleId = (typeof MAIL_BUNDLE_IDS)[keyof typeof MAIL_BUNDLE_IDS];

type MailBundleReadiness = "ready" | "needs_user_input" | "blocked";

type MailBundleSlotCandidate = {
  id: string;
  label: string;
  score: number | null;
  recommended: boolean;
};

type MailBundleSlot = {
  slotKey: "customer" | "referenceDocument" | "replyIdentity";
  label: string;
  status: "resolved" | "needs_selection" | "missing";
  resolvedId: string | null;
  displayValue: string | null;
  candidates: MailBundleSlotCandidate[];
};

type MailActionBundle = {
  bundleId: MailBundleId;
  title: string;
  description: string;
  confidenceScore: number;
  recommended: boolean;
  readiness: MailBundleReadiness;
  expectedOutcomes: Array<{ type: string; label: string }>;
  resolverSlots: MailBundleSlot[];
  commandPreview: Array<{
    order: number;
    commandKey: string;
    label: string;
    mode: "sync" | "async";
    blocking: boolean;
  }>;
  followUpOptions: Array<{
    optionKey: string;
    label: string;
    enabledByDefault: boolean;
  }>;
  warnings: string[];
};

// Encryption secret helper matching slopware configuration
const ENCRYPTION_KEY_HEX = process.env.ENCRYPTION_SECRET ?? "";
const ENCRYPTION_KEY =
  ENCRYPTION_KEY_HEX.length === 64 ? Buffer.from(ENCRYPTION_KEY_HEX, "hex") : null;

function decryptSecret(encoded: string): string {
  if (!ENCRYPTION_KEY) return encoded;
  const parts = encoded.split(":");
  if (parts.length !== 3) return encoded;
  const [ivHex, authTagHex, cipherHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(cipherHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

function inferProvider(_model: string, provider?: string): string {
  switch (provider) {
    case "openai":
    case "anthropic":
    case "openrouter":
    case "google_ai_studio":
    case "vertex_ai":
      return provider;
    case "gemini":
      return "google_ai_studio";
    default:
      return "google_ai_studio";
  }
}

function defaultModelForProvider(provider: string): string {
  switch (provider) {
    case "openai":
      return "gpt-4o-mini";
    case "anthropic":
      return "claude-sonnet-4-5";
    case "openrouter":
      return "openai/gpt-5";
    case "vertex_ai":
    case "google_ai_studio":
    default:
      return "gemini-2.5-flash";
  }
}

function formatMailPerson(value: any): string {
  if (!value || typeof value !== "object") return "Unknown sender";
  const email = typeof value.email === "string" ? value.email : "";
  const name = typeof value.name === "string" ? value.name : "";
  return (
    [name, email].filter(Boolean).join(" <") + (name && email ? ">" : "") ||
    email ||
    "Unknown sender"
  );
}

function parseMailRecipients(value: any[]): string {
  return (value ?? [])
    .map((item) => item.email?.trim?.() ?? "")
    .filter(Boolean)
    .join(", ");
}

function htmlToText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function textToHtml(value: string): string {
  const escapeHtml = (text: string) =>
    text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const paragraphs = value
    .trim()
    .split(/\n{2,}/)
    .map((part) =>
      part
        .split("\n")
        .map((line) => escapeHtml(line))
        .join("<br />"),
    )
    .filter(Boolean);

  if (paragraphs.length === 0) return "";
  return paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("");
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

type LlmRuntimeConfig = {
  gatewayUrl: string;
  modelName: string;
  providerName: string;
  apiKey: string;
  githubToken: string;
  githubRepo: string;
  vertexCredentials: string;
  vertexProject: string;
  vertexLocation: string;
};

export async function resolveLlmRuntimeConfig(
  tenantId?: string,
  userId?: string,
): Promise<LlmRuntimeConfig> {
  let gatewayUrl = "http://localhost:11435";
  let modelName = "gemini/gemini-2.5-flash";
  let providerName = "google_ai_studio";
  let apiKey = "";
  let githubToken = "";
  let githubRepo = "";
  let vertexCredentials = "";
  let vertexProject = "";
  let vertexLocation = "";

  let activeTenantConfig = null;
  if (tenantId && userId) {
    const [userRow] = await db
      .select({ lastCompanyId: schema.user.lastCompanyId })
      .from(schema.user)
      .where(eq(schema.user.id, userId))
      .limit(1);

    const activeCompanyId = userRow?.lastCompanyId;

    if (activeCompanyId) {
      const configRows = await db
        .select()
        .from(schema.tenantLlmConfig)
        .where(
          and(
            eq(schema.tenantLlmConfig.tenantId, tenantId),
            eq(schema.tenantLlmConfig.companyId, activeCompanyId),
            eq(schema.tenantLlmConfig.isActive, true),
          ),
        )
        .limit(1);
      activeTenantConfig = configRows[0] || null;
    }
  }

  if (activeTenantConfig) {
    gatewayUrl = activeTenantConfig.endpointUrl || "http://localhost:11435";
    providerName = inferProvider(modelName, (activeTenantConfig as any).provider);
    modelName = activeTenantConfig.model || defaultModelForProvider(providerName);
    if (activeTenantConfig.apiKey) {
      const { decryptEmailCredentials } = await import("./email/credential-crypto");
      try {
        apiKey = decryptEmailCredentials<string>(activeTenantConfig.apiKey);
      } catch {
        apiKey = activeTenantConfig.apiKey;
      }
    }
    if ((activeTenantConfig as any).githubToken) {
      const { decryptEmailCredentials } = await import("./email/credential-crypto");
      try {
        githubToken = decryptEmailCredentials<string>((activeTenantConfig as any).githubToken);
      } catch {
        githubToken = (activeTenantConfig as any).githubToken;
      }
    }
    githubRepo = (activeTenantConfig as any).githubRepo ?? "";
    vertexCredentials = decryptSecret((activeTenantConfig as any).vertexCredentials ?? "");
    vertexProject = (activeTenantConfig as any).vertexProject ?? "";
    vertexLocation = (activeTenantConfig as any).vertexLocation ?? "";
  } else {
    const configRow = await db
      .select()
      .from(systemSettings)
      .where(and(eq(systemSettings.scope, "global"), eq(systemSettings.key, "llm_config")))
      .limit(1);

    if (configRow[0]) {
      gatewayUrl = (configRow[0].value as any).endpointUrl || "http://localhost:11435";
      providerName = inferProvider(modelName, (configRow[0].value as any).provider);
      modelName = (configRow[0].value as any).model || defaultModelForProvider(providerName);
      vertexCredentials = decryptSecret((configRow[0].value as any).vertexCredentials || "");
      vertexProject = (configRow[0].value as any).vertexProject ?? "";
      vertexLocation = (configRow[0].value as any).vertexLocation ?? "";
      apiKey = decryptSecret((configRow[0].value as any).apiKey || "");
      githubToken = decryptSecret((configRow[0].value as any).githubToken || "");
      githubRepo = (configRow[0].value as any).githubRepo ?? "";
    }
  }

  return {
    gatewayUrl,
    modelName,
    providerName,
    apiKey,
    githubToken,
    githubRepo,
    vertexCredentials,
    vertexProject,
    vertexLocation,
  };
}

async function generateReplyDraftBody(params: {
  sourceSubject: string | null | undefined;
  sourceSender: string | null;
  sourceEmailText: string;
  documentLabel: string | null;
  documentNo: string | null;
  extraReplyInstruction: string | null;
  tenantId: string;
  userId: string;
}) {
  const llm = await resolveLlmRuntimeConfig(params.tenantId, params.userId);
  const extraReplyInstruction = params.extraReplyInstruction?.trim() || "";
  const prompt = `You are drafting a German business email reply for an ERP system.

Return ONLY valid JSON with this exact structure:
{
  "bodyText": "string"
}

Rules:
- Write in German.
- Keep the reply concise, professional, and ready to send.
- Do not mention internal systems, policies, or that you are an AI.
- Do not use markdown fences.
- If an additional instruction is provided, obey it exactly and integrate it naturally.
- Do not invent facts that are not supported by the context.
- Keep the response focused on the source email and the linked document context.

Context:
- Thread subject: ${params.sourceSubject ?? "(kein Betreff)"}
- Source sender: ${params.sourceSender ?? "(unbekannt)"}
- Linked document: ${params.documentLabel ?? "(kein Beleg)"}
- Linked document number: ${params.documentNo ?? "(unbekannt)"}
- Additional instruction: ${extraReplyInstruction || "(keine)"}

Source email:
"""
${params.sourceEmailText.slice(0, 8000)}
"""
`;

  const fallbackBodyText = [
    "Guten Tag,",
    "",
    "vielen Dank für Ihre Nachricht.",
    params.documentLabel ? `Der Bezug zu ${params.documentLabel} ist berücksichtigt.` : "",
    extraReplyInstruction ? `Zusatzhinweis: ${extraReplyInstruction}` : "",
    "",
    "Viele Grüße",
  ]
    .filter((line) => line !== "")
    .join("\n");

  try {
    const { createConfiguredProvider } = await import("@repo/agent");
    const provider = createConfiguredProvider({
      provider: llm.providerName,
      model: llm.modelName,
      apiKey: llm.apiKey || undefined,
      endpointUrl: llm.gatewayUrl || undefined,
      vertexCredentials: llm.vertexCredentials || undefined,
      vertexProject: llm.vertexProject || undefined,
      vertexLocation: llm.vertexLocation || undefined,
    });

    const responseText = (await provider.chat({
      messages: [{ role: "user", content: prompt }],
    })) as string;

    const cleanContent = responseText
      .replace(/^```json\n?/, "")
      .replace(/\n?```$/, "")
      .trim();
    const parsed = JSON.parse(cleanContent) as { bodyText?: unknown };
    const bodyText = typeof parsed.bodyText === "string" ? parsed.bodyText.trim() : "";
    return {
      bodyText: bodyText || fallbackBodyText,
      bodyHtml: textToHtml(bodyText || fallbackBodyText),
    };
  } catch {
    return {
      bodyText: fallbackBodyText,
      bodyHtml: textToHtml(fallbackBodyText),
    };
  }
}

function getMailDisplayValue(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const email = typeof record.email === "string" ? record.email.trim() : "";
  const name = typeof record.name === "string" ? record.name.trim() : "";
  return [name, email].filter(Boolean).join(" <") + (name && email ? ">" : "") || email || null;
}

function safeJsonParse(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function chunkToTranscriptMessage(chunk: Record<string, unknown>): string | null {
  const chunkAny = chunk as any;
  const type = typeof chunkAny.type === "string" ? chunkAny.type : "";
  switch (type) {
    case "RUN_STARTED":
      return "Agent run started";
    case "STEP_STARTED":
      return `Reasoning started${typeof chunk.id === "string" ? ` (${chunk.id})` : ""}`;
    case "STEP_FINISHED":
      return typeof chunk.content === "string"
        ? chunk.content
        : typeof chunk.delta === "string"
          ? chunk.delta
          : "Reasoning step finished";
    case "TEXT_MESSAGE_END":
      return typeof chunk.content === "string" ? chunk.content : "Assistant message";
    case "TOOL_CALL_START":
      return typeof chunk.toolName === "string"
        ? `Tool call started: ${chunk.toolName}`
        : "Tool call started";
    case "TOOL_CALL_END":
      return typeof chunk.toolName === "string"
        ? `Tool call completed: ${chunk.toolName}`
        : "Tool call completed";
    case "RUN_FINISHED":
      return typeof chunk.finishReason === "string"
        ? `Run finished (${chunk.finishReason})`
        : "Run finished";
    default:
      return null;
  }
}

function isOrderFromOfferIntent(intent: string) {
  return intent === "order_from_existing_offer";
}

function buildMailBundleDefinitions(params: {
  interp: typeof aiInterpretation.$inferSelect;
  resolution: any;
}): MailActionBundle[] {
  const isOrderFromOffer = isOrderFromOfferIntent(params.interp.businessIntent);
  const customerCandidates = (params.resolution.addressResolution?.candidates || []).map(
    (candidate: any) => ({
      id: candidate.addressId,
      label: candidate.displayLabel,
      score: candidate.matchScore != null ? toNumber(candidate.matchScore, 0) : null,
      recommended: toNumber(candidate.matchScore, 0) >= 0.9,
    }),
  );
  const documentCandidates = (params.resolution.documentResolution?.candidates || []).map(
    (candidate: any) => ({
      id: candidate.documentId,
      label: candidate.displayLabel,
      score: candidate.matchScore != null ? toNumber(candidate.matchScore, 0) : null,
      recommended: toNumber(candidate.matchScore, 0) >= 0.9,
    }),
  );

  const addressStatus = params.resolution.addressResolution?.status ?? "missing";
  const documentStatus = params.resolution.documentResolution?.status ?? "missing";
  const addressResolvedId =
    addressStatus === "unique_match" ? (customerCandidates[0]?.id ?? null) : null;
  const documentResolvedId =
    documentStatus === "unique_match" ? (documentCandidates[0]?.id ?? null) : null;

  const baseCustomerSlot: MailBundleSlot = {
    slotKey: "customer",
    label: "Geschäftspartner",
    status:
      addressStatus === "unique_match"
        ? "resolved"
        : addressStatus === "multiple_matches"
          ? "needs_selection"
          : "missing",
    resolvedId: addressResolvedId,
    displayValue: customerCandidates[0]?.label ?? null,
    candidates: customerCandidates,
  };

  const baseDocumentSlot: MailBundleSlot = {
    slotKey: "referenceDocument",
    label: "Referenzbeleg",
    status:
      documentStatus === "unique_match"
        ? "resolved"
        : documentStatus === "multiple_matches"
          ? "needs_selection"
          : "missing",
    resolvedId: documentResolvedId,
    displayValue: documentCandidates[0]?.label ?? null,
    candidates: documentCandidates,
  };

  const replyIdentityCandidates: MailBundleSlotCandidate[] = [];

  const classifyOnly: MailActionBundle = {
    bundleId: MAIL_BUNDLE_IDS.classifyOnly,
    title: "Nur klassifizieren",
    description: "Der Thread wird einem Geschäftspartner zugeordnet, ohne einen Beleg anzulegen.",
    confidenceScore: toNumber(params.interp.confidenceScore, 0),
    recommended: !isOrderFromOffer,
    readiness:
      addressStatus === "unique_match"
        ? "ready"
        : addressStatus === "multiple_matches"
          ? "needs_user_input"
          : "blocked",
    expectedOutcomes: [
      { type: "classification_applied", label: "Thread wird klassifiziert" },
      { type: "customer_linked", label: "Kunde wird verknüpft" },
    ],
    resolverSlots: [baseCustomerSlot],
    commandPreview: [
      {
        order: 1,
        commandKey: "apply-ai-mail-classification",
        label: "E-Mail-Thread klassifizieren & verknüpfen",
        mode: "sync",
        blocking: true,
      },
    ],
    followUpOptions: [],
    warnings:
      addressStatus === "missing" ? ["Es wurde kein eindeutiger Geschäftspartner gefunden."] : [],
  };

  if (!isOrderFromOffer) {
    return [classifyOnly];
  }

  const convertBundle: MailActionBundle = {
    bundleId: MAIL_BUNDLE_IDS.convertOfferToOrder,
    title: "Angebot in Auftrag umwandeln",
    description: "Das referenzierte Angebot wird in einen Auftrag umgewandelt und verknüpft.",
    confidenceScore: toNumber(params.interp.confidenceScore, 0),
    recommended: true,
    readiness:
      addressStatus === "unique_match" && documentStatus === "unique_match"
        ? "ready"
        : addressStatus === "multiple_matches" || documentStatus === "multiple_matches"
          ? "needs_user_input"
          : "blocked",
    expectedOutcomes: [
      { type: "document_created", label: "Neuer Auftrag wird erstellt" },
      { type: "thread_linked", label: "Thread wird mit dem Auftrag verknüpft" },
      { type: "customer_linked", label: "Kunde wird mit dem Vorgang verknüpft" },
    ],
    resolverSlots: [baseCustomerSlot, baseDocumentSlot],
    commandPreview: [
      {
        order: 1,
        commandKey: "convert-document-from-ai-review",
        label: "Angebot in Auftrag umwandeln",
        mode: "sync",
        blocking: true,
      },
      {
        order: 2,
        commandKey: "apply-ai-mail-classification",
        label: "Thread mit Kunde und Auftrag verknüpfen",
        mode: "sync",
        blocking: true,
      },
    ],
    followUpOptions: [],
    warnings: [],
  };

  const replyBundle: MailActionBundle = {
    bundleId: MAIL_BUNDLE_IDS.convertAndPrepareReply,
    title: "Auftrag anlegen und Antwort vorbereiten",
    description:
      "Das Angebot wird in einen Auftrag umgewandelt, der Thread wird verknüpft und ein editierbarer E-Mail-Entwurf wird vorbereitet.",
    confidenceScore: toNumber(params.interp.confidenceScore, 0),
    recommended: true,
    readiness:
      addressStatus === "unique_match" && documentStatus === "unique_match"
        ? "ready"
        : addressStatus === "multiple_matches" || documentStatus === "multiple_matches"
          ? "needs_user_input"
          : "blocked",
    expectedOutcomes: [
      { type: "document_created", label: "Neuer Auftrag wird erstellt" },
      { type: "thread_linked", label: "Thread wird mit dem Auftrag verknüpft" },
      { type: "reply_draft_created", label: "Antwortmail wird als Entwurf vorbereitet" },
    ],
    resolverSlots: [
      baseCustomerSlot,
      baseDocumentSlot,
      {
        slotKey: "replyIdentity",
        label: "Versandidentität",
        status: "resolved",
        resolvedId: null,
        displayValue: null,
        candidates: replyIdentityCandidates,
      },
    ],
    commandPreview: [
      {
        order: 1,
        commandKey: "convert-document-from-ai-review",
        label: "Angebot in Auftrag umwandeln",
        mode: "sync",
        blocking: true,
      },
      {
        order: 2,
        commandKey: "apply-ai-mail-classification",
        label: "Thread mit Kunde und Auftrag verknüpfen",
        mode: "sync",
        blocking: true,
      },
      {
        order: 3,
        commandKey: "prepare-document-email",
        label: "Antwort-Entwurf vorbereiten",
        mode: "sync",
        blocking: false,
      },
    ],
    followUpOptions: [
      {
        optionKey: "extraReplyInstruction",
        label: "Zusatzanweisung für Antwort",
        enabledByDefault: false,
      },
    ],
    warnings: [],
  };

  return [classifyOnly, convertBundle, replyBundle];
}

function resolveBundleSelection(
  bundles: MailActionBundle[],
  bundleId?: string | null,
): MailActionBundle {
  const preferred = bundleId ? bundles.find((bundle) => bundle.bundleId === bundleId) : null;
  return preferred ?? bundles.find((bundle) => bundle.recommended) ?? bundles[0];
}

function extractLegacyBundleOverrides(steps: any[] | undefined) {
  if (!Array.isArray(steps) || steps.length === 0) return {};

  let bundleId: MailBundleId | undefined;
  let selectedAddressId: string | undefined;
  let selectedDocumentId: string | undefined;

  for (const step of steps) {
    if (step?.actionType === "LOOKUP" && step?.entityName === "address") {
      selectedAddressId = step.selectedMatchId || selectedAddressId;
    }
    if (step?.actionType === "LOOKUP" && step?.entityName === "document") {
      selectedDocumentId = step.selectedMatchId || selectedDocumentId;
    }
    if (
      step?.actionType === "EXECUTE_COMMAND" &&
      (step.commandKey === "convert-document-from-ai-review" ||
        step.commandKey === "convert-document-from-ai-plan")
    ) {
      bundleId = MAIL_BUNDLE_IDS.convertOfferToOrder;
    }
    if (step?.actionType === "EXECUTE_COMMAND" && step.commandKey === "prepare-document-email") {
      bundleId = MAIL_BUNDLE_IDS.convertAndPrepareReply;
    }
  }

  if (!bundleId) {
    bundleId = MAIL_BUNDLE_IDS.classifyOnly;
  }

  return {
    bundleId,
    selectedAddressId,
    selectedDocumentId,
  };
}

async function buildMailThreadProjection(threadId: string, tenantId: string) {
  const [thread] = await db
    .select()
    .from(schema.emailThread)
    .where(
      and(
        eq(schema.emailThread.emailThreadId, threadId),
        eq(schema.emailThread.tenantId, tenantId),
      ),
    )
    .limit(1);

  if (!thread) return null;

  const messages = await db
    .select()
    .from(schema.emailMessage)
    .where(
      and(
        eq(schema.emailMessage.emailThreadId, threadId),
        eq(schema.emailMessage.tenantId, tenantId),
      ),
    );

  const threadText = `Subject: ${thread.subject || "(no subject)"}
Messages:
${messages
  .map((message: any) => {
    const body = message.bodyText || htmlToText(message.bodyHtml || "");
    return `From: ${formatMailPerson(message.fromJson)}
To: ${parseMailRecipients(message.toJson)}
Body: ${body}`;
  })
  .join("\n---\n")}`;

  return {
    threadId: thread.emailThreadId,
    subject: thread.subject,
    relatedDocumentId: thread.relatedDocumentId,
    relatedAddressId: thread.relatedAddressId,
    content: threadText,
  };
}

export class AIOrchestratorService {
  /**
   * Phase A: LLM-driven interpretation of the thread.
   */
  static async interpretMailThread(params: {
    threadId: string;
    rawInput?: string;
    customInstructions?: string;
    tenantId: string;
    userId: string;
  }): Promise<{ interpretationId: string; interpretation: any }> {
    const startTime = Date.now();

    // 1. Check or Create aiRun in pending status
    const [run] = await db
      .insert(aiRun)
      .values({
        tenantId: params.tenantId,
        userId: params.userId,
        taskScope: "mail-interpret-thread",
        status: "pending",
      })
      .returning();

    const mailContext = params.rawInput
      ? null
      : await buildMailThreadProjection(params.threadId, params.tenantId);
    if (!mailContext && !params.rawInput) {
      throw new Error("Mail thread not found");
    }

    // 2. Fetch or seed system prompt
    let [promptVer] = await db.select().from(aiPromptVersion).limit(1);
    if (!promptVer) {
      const systemPrompt = `You are a highly capable AI interpretation assistant in an ERP system (slopware).
Analyze the incoming email thread and extract the structured intent, evidence quotes, entity references, and requested resolvers.

Response constraints:
- Return ONLY valid JSON matching the schema. No markdown wrapping.
- For businessIntent, output one of:
  - "order_from_existing_offer" (if accept/order an offer like ANG-000002)
  - "new_quote_request" (if asking for pricing/quote for new articles)
  - "complaint" (complaining about invoice/delivery)
  - "delivery_status_request"
  - "invoice_or_document"
  - "other_unclear"
- Under extractedReferences, pull:
  - documentNo (like ANG-000002)
  - documentTypeHint ("Offer", "Order", "Invoice", "Unknown")
  - senderEmail, senderName, companyName.
- Under requestedResolvers, ask for resolvers like "address" or "document" if needed.`;

      const [inserted] = await db
        .insert(aiPromptVersion)
        .values({
          systemPrompt,
          inputSchema: { type: "object", properties: { businessIntent: { type: "string" } } },
          modelConfig: { model: "gemini/gemini-2.5-flash", temperature: 0.2 },
        })
        .returning();
      promptVer = inserted;
    }

    // 3. Resolve LLM Config
    const llm = await resolveLlmRuntimeConfig(params.tenantId, params.userId);
    const modelName = llm.modelName;
    const _apiKey = llm.apiKey;

    // Assemble LLM prompt
    const prompt = `${promptVer.systemPrompt}

### Specialized Mail Interpretation Prompt:
Produce a valid JSON object matching the following structure:
{
  "businessIntent": "order_from_existing_offer" | "new_quote_request" | "complaint" | "delivery_status_request" | "invoice_or_document" | "other_unclear",
  "confidenceScore": 0.0 to 1.0,
  "summary": "German one-sentence summary of request",
  "evidence": [
    { "quote": "exact quote from email", "explanation": "why this matches intent" }
  ],
  "extractedReferences": {
    "documentNo": "ANG-XXXXXX" or null,
    "documentType": "Offer" or null,
    "customerNo": "K-XXXXX" or null,
    "companyName": "company" or null
  },
  "requestedResolvers": [
    { "resolverType": "address", "hint": { "email": "email", "senderName": "name", "companyName": "company" }, "reason": "reason" },
    { "resolverType": "document", "hint": { "documentNo": "ANG-XXXXXX", "documentType": "Offer" }, "reason": "reason" }
  ],
  "blockingQuestions": ["select_customer" or "select_reference_document" if ambiguous]
}

${params.customInstructions ? `### Additional Instructions:\n${params.customInstructions}\n` : ""}
### Unstructured Mail Thread Context:
"${params.rawInput ?? JSON.stringify(mailContext)}"`;

    let responseJson: any = {};
    try {
      const { createConfiguredProvider } = await import("@repo/agent");
      const provider = createConfiguredProvider({
        provider: llm.providerName,
        model: modelName,
        apiKey: _apiKey || undefined,
        endpointUrl: llm.gatewayUrl || undefined,
        vertexCredentials: llm.vertexCredentials || undefined,
        vertexProject: llm.vertexProject || undefined,
        vertexLocation: llm.vertexLocation || undefined,
      });

      const responseText = (await provider.chat({
        messages: [{ role: "user", content: prompt }],
      })) as string;

      const cleanContent = responseText
        .replace(/^```json\n?/, "")
        .replace(/\n?```$/, "")
        .trim();
      responseJson = JSON.parse(cleanContent);
    } catch (e: any) {
      responseJson = {
        businessIntent: "other_unclear",
        confidenceScore: 0.1,
        summary: `Interpretation fehlgeschlagen: ${e.message}`,
        evidence: [],
        extractedReferences: {},
        requestedResolvers: [],
        blockingQuestions: [],
      };
    }

    // Save Interpretation to DB
    const [interpretation] = await db
      .insert(aiInterpretation)
      .values({
        tenantId: params.tenantId,
        sourceThreadId: params.threadId,
        runId: run.runId,
        promptVersionId: promptVer.promptVersionId,
        businessIntent: responseJson.businessIntent || "other_unclear",
        confidenceScore: String(responseJson.confidenceScore ?? 0.5),
        summary: responseJson.summary || "Unklare E-Mail",
        evidenceJson: responseJson.evidence || [],
        extractedReferencesJson: responseJson.extractedReferences || {},
        requestedResolversJson: responseJson.requestedResolvers || [],
        blockingQuestionsJson: responseJson.blockingQuestions || [],
        rawLlmTrace: {
          prompt,
          response: JSON.stringify(responseJson, null, 2),
          model: modelName,
        },
      })
      .returning();

    await db
      .update(aiRun)
      .set({ status: "completed", durationMs: Date.now() - startTime })
      .where(eq(aiRun.runId, run.runId));

    return {
      interpretationId: interpretation.interpretationId,
      interpretation,
    };
  }

  /**
   * Phase B: Deterministic server-side candidates resolution.
   */
  static async resolveMailThread(params: {
    interpretationId: string;
    tenantId: string;
  }): Promise<{ resolutionId: string; resolution: any }> {
    const [interp] = await db
      .select()
      .from(aiInterpretation)
      .where(
        and(
          eq(aiInterpretation.interpretationId, params.interpretationId),
          eq(aiInterpretation.tenantId, params.tenantId),
        ),
      )
      .limit(1);

    if (!interp) throw new Error("Interpretation not found");

    const storedResolution = (interp.rawLlmTrace as any)?.resolution;
    if (storedResolution && typeof storedResolution === "object") {
      return {
        resolutionId: randomUUID(),
        resolution: storedResolution,
      };
    }

    const requestedResolvers = (interp.requestedResolversJson || []) as any[];
    const refs = (interp.extractedReferencesJson || {}) as Record<string, any>;

    const addressCandidates: any[] = [];
    const documentCandidates: any[] = [];
    let addressStatus = "not_requested";
    let documentStatus = "not_requested";
    let resolvedDocumentCustomerId: string | null = null;

    // 1. Resolve Address
    const addressReq = requestedResolvers.find((r) => r.resolverType === "address");
    if (addressReq || refs.senderEmail) {
      addressStatus = "no_match";
      const email = refs.senderEmail || addressReq?.hint?.email;
      const companyName = refs.companyName || addressReq?.hint?.companyName || "";

      // Strategy A: Perfect match on email through addressContact
      if (email) {
        const contacts = await db
          .select()
          .from(schema.addressContact)
          .where(
            and(
              eq(schema.addressContact.tenantId, params.tenantId),
              sql`lower(${schema.addressContact.email}) = ${email.toLowerCase()}`,
            ),
          )
          .limit(3);

        for (const contact of contacts) {
          const [addr] = await db
            .select()
            .from(schema.address)
            .where(
              and(
                eq(schema.address.addressId, contact.addressId),
                eq(schema.address.tenantId, params.tenantId),
              ),
            )
            .limit(1);

          if (addr) {
            addressCandidates.push({
              addressId: addr.addressId,
              displayLabel: `${addr.companyName || [contact.firstName, contact.lastName].filter(Boolean).join(" ") || addr.addressNo} (${addr.city})`,
              matchScore: 1.0,
              reasons: [`Direkter Treffer über Kontakt-E-Mail: ${email}`],
            });
          }
        }
      }

      // Strategy B: Perfect match on companyName fuzzy search if no matches found
      if (addressCandidates.length === 0 && companyName) {
        const fuzzyComp = await db
          .select()
          .from(schema.address)
          .where(
            and(
              eq(schema.address.tenantId, params.tenantId),
              sql`lower(${schema.address.companyName}) LIKE ${`%${companyName.toLowerCase()}%`}`,
            ),
          )
          .limit(3);

        for (const addr of fuzzyComp) {
          addressCandidates.push({
            addressId: addr.addressId,
            displayLabel: `${addr.companyName} (${addr.city})`,
            matchScore: 0.85,
            reasons: [`Fuzzy-Match über Firmennamen: ${companyName}`],
          });
        }
      }

      // Resolve address candidates status
      if (addressCandidates.length === 1) {
        addressStatus = "unique_match";
      } else if (addressCandidates.length > 1) {
        addressStatus = "multiple_matches";
      }
    }

    // 2. Resolve Document
    const docReq = requestedResolvers.find((r) => r.resolverType === "document");
    if (docReq || refs.documentNo) {
      documentStatus = "no_match";
      const docNo = refs.documentNo || docReq?.hint?.documentNo;
      const typeHint = refs.documentTypeHint || docReq?.hint?.documentType;

      if (docNo) {
        const queryCond = [
          eq(schema.document.tenantId, params.tenantId),
          sql`lower(${schema.document.documentNo}) = ${docNo.toLowerCase()}`,
        ];

        if (interp.businessIntent === "order_from_existing_offer") {
          // If customer accepting quote, filter to Offer (N) documents
          queryCond.push(eq(schema.document.documentType, "N"));
        } else if (typeHint && DOC_TYPE_MAP[typeHint]) {
          queryCond.push(eq(schema.document.documentType, DOC_TYPE_MAP[typeHint]));
        }

        const documents = await db
          .select()
          .from(schema.document)
          .where(and(...queryCond))
          .limit(3);

        for (const doc of documents) {
          const typeName = DOC_TYPE_REVERSE_MAP[doc.documentType] || doc.documentType;
          documentCandidates.push({
            documentId: doc.documentId,
            documentNo: doc.documentNo,
            documentType: typeName,
            displayLabel: `${typeName} ${doc.documentNo} vom ${doc.documentDate} (Betrag: ${doc.totalGross || "0.00"})`,
            matchScore: 1.0,
            customerId: doc.customerId ?? null,
            reasons: [`Direkter Treffer auf Belegnummer: ${docNo}`],
          });
          if (doc.customerId) {
            resolvedDocumentCustomerId = doc.customerId;
          }
        }
      }

      if (documentCandidates.length === 1) {
        documentStatus = "unique_match";
      } else if (documentCandidates.length > 1) {
        documentStatus = "multiple_matches";
      }
    }

    if (addressCandidates.length === 0 && resolvedDocumentCustomerId) {
      const [addr] = await db
        .select()
        .from(schema.address)
        .where(
          and(
            eq(schema.address.addressId, resolvedDocumentCustomerId),
            eq(schema.address.tenantId, params.tenantId),
          ),
        )
        .limit(1);

      if (addr) {
        addressCandidates.push({
          addressId: addr.addressId,
          displayLabel: `${addr.companyName || addr.addressNo || addr.addressId}`,
          matchScore: 0.95,
          reasons: ["Kunde aus referenziertem Beleg abgeleitet"],
        });
        addressStatus = "unique_match";
      }
    }

    if (addressCandidates.length === 1 && addressStatus === "no_match") {
      addressStatus = "unique_match";
    } else if (addressCandidates.length > 1) {
      addressStatus = "multiple_matches";
    } else if (addressCandidates.length === 1 && addressStatus !== "unique_match") {
      addressStatus = "unique_match";
    }

    const resolutionStatus =
      addressStatus === "no_match" || documentStatus === "no_match"
        ? "partially_resolved"
        : "resolved";

    const resolution = {
      interpretationId: interp.interpretationId,
      resolutionStatus,
      addressResolution: {
        status: addressStatus,
        candidates: addressCandidates,
      },
      documentResolution: {
        status: documentStatus,
        candidates: documentCandidates,
      },
      articleResolutions: [],
      unresolvedItems: [],
      warnings: [],
    };

    // Return the resolutionId (for state consistency, we use randomUUID here or resolution object directly)
    return {
      resolutionId: randomUUID(),
      resolution,
    };
  }

  static async runMailAgentAnalysis(params: {
    threadId: string;
    tenantId: string;
    userId: string;
    rawInput?: string;
    customInstructions?: string;
    sessionId?: string;
    provider?: any;
    projection?: any;
    onChunk?: (chunk: Record<string, unknown>) => void;
  }): Promise<{
    interpretationId: string;
    interpretation: typeof aiInterpretation.$inferSelect;
    analysis: MailAgentAnalysis;
  }> {
    const startedAt = Date.now();
    const [run] = await db
      .insert(aiRun)
      .values({
        tenantId: params.tenantId,
        userId: params.userId,
        taskScope: "mail-agent-cycle",
        status: "running",
      })
      .returning();

    const toolCallIds = new Map<string, string>();
    const assistantTurnBuffer = new Map<string, string>();

    const persistChunk = async (chunk: Record<string, unknown>) => {
      if (!params.sessionId) return;
      const chunkAny = chunk as any;
      const type = typeof chunkAny.type === "string" ? chunkAny.type : "";
      const transcriptMessage = chunkToTranscriptMessage(chunk);

      if (type === "RUN_STARTED") {
        await createAiTurn({
          sessionId: params.sessionId,
          role: "assistant",
          message: "Mail agent run started",
        });
        return;
      }

      if (type === "TOOL_CALL_START") {
        const toolCallId =
          typeof chunkAny.toolCallId === "string"
            ? chunkAny.toolCallId
            : typeof chunkAny.id === "string"
              ? chunkAny.id
              : randomUUID();
        const toolName = typeof chunkAny.toolName === "string" ? chunkAny.toolName : "unknown_tool";
        const [turn] = await db
          .insert(aiTurn)
          .values({
            sessionId: params.sessionId,
            role: "assistant",
            message: `Tool call started: ${toolName}`,
          })
          .returning();

        const record = await createAiToolCall({
          turnId: turn.turnId,
          toolName,
          input: safeJsonParse(chunk.args ?? chunk.input ?? {}) ?? {},
          status: "running",
        });
        toolCallIds.set(toolCallId, record.toolCallId);
        return;
      }

      if (type === "TOOL_CALL_ARGS") {
        const toolCallId = typeof chunkAny.toolCallId === "string" ? chunkAny.toolCallId : "";
        const recordId = toolCallIds.get(toolCallId);
        if (recordId) {
          await updateAiToolCallStatus({
            toolCallId: recordId,
            status: "running",
            input: safeJsonParse(chunk.args ?? chunk.delta ?? {}),
          });
        }
        return;
      }

      if (type === "TOOL_CALL_END") {
        const toolCallId = typeof chunkAny.toolCallId === "string" ? chunkAny.toolCallId : "";
        const recordId = toolCallIds.get(toolCallId);
        if (recordId) {
          await updateAiToolCallStatus({
            toolCallId: recordId,
            status: "done",
            input: safeJsonParse(chunk.args ?? chunk.input ?? {}),
            output: safeJsonParse(chunk.result ?? chunk.output ?? chunk.content ?? {}),
          });
        }
      }

      if (type === "TEXT_MESSAGE_START") {
        const textId = typeof chunkAny.id === "string" ? chunkAny.id : "assistant";
        assistantTurnBuffer.set(textId, "");
        return;
      }

      if (type === "TEXT_MESSAGE_CONTENT") {
        const textId = typeof chunkAny.id === "string" ? chunkAny.id : "assistant";
        const nextValue = assistantTurnBuffer.get(textId) ?? "";
        assistantTurnBuffer.set(
          textId,
          nextValue + (typeof chunkAny.delta === "string" ? chunkAny.delta : ""),
        );
        return;
      }

      if (type === "TEXT_MESSAGE_END") {
        const textId = typeof chunkAny.id === "string" ? chunkAny.id : "assistant";
        const message =
          typeof chunkAny.content === "string"
            ? chunkAny.content
            : (assistantTurnBuffer.get(textId) ?? "");
        if (message.trim()) {
          await createAiTurn({
            sessionId: params.sessionId,
            role: "assistant",
            message,
          });
        }
        assistantTurnBuffer.delete(textId);
        return;
      }

      if (type === "STEP_FINISHED") {
        const message =
          typeof chunkAny.content === "string"
            ? chunkAny.content
            : typeof chunkAny.delta === "string"
              ? chunkAny.delta
              : "";
        if (message.trim()) {
          await createAiTurn({
            sessionId: params.sessionId,
            role: "assistant",
            message: `Reasoning: ${message}`,
          });
        }
        return;
      }

      if (transcriptMessage) {
        await createAiTurn({
          sessionId: params.sessionId,
          role: "assistant",
          message: transcriptMessage,
        });
      }
    };

    try {
      const llmConfig = await resolveLlmRuntimeConfig(params.tenantId, params.userId);
      let [promptVer] = await db.select().from(aiPromptVersion).limit(1);
      if (!promptVer) {
        [promptVer] = await db
          .insert(aiPromptVersion)
          .values({
            systemPrompt: "Mail agentic analysis",
            inputSchema: { type: "object" },
            modelConfig: { model: llmConfig.modelName, temperature: 0.1 },
          })
          .returning();
      }

      if (params.sessionId) {
        await createAiTurn({
          sessionId: params.sessionId,
          role: "user",
          message: [
            `Mail thread: ${params.threadId}`,
            params.rawInput?.trim() ? `Context: ${params.rawInput.slice(0, 8000)}` : "",
            params.customInstructions?.trim()
              ? `Instructions: ${params.customInstructions.trim()}`
              : "",
          ]
            .filter(Boolean)
            .join("\n\n"),
        });
      }

      const { analysis, finalText } = await runMailAgentLoop({
        tenantId: params.tenantId,
        threadId: params.threadId,
        rawInput: params.rawInput,
        customInstructions: params.customInstructions,
        provider: params.provider,
        projection: params.projection,
        providerConfig: llmConfig,
        onChunk: async (chunk) => {
          params.onChunk?.(chunk as Record<string, unknown>);
          await persistChunk(chunk as Record<string, unknown>);
        },
      });

      const [interpretation] = await db
        .insert(aiInterpretation)
        .values({
          tenantId: params.tenantId,
          sourceThreadId: params.threadId,
          runId: run.runId,
          promptVersionId: promptVer.promptVersionId,
          businessIntent: analysis.businessIntent || "other_unclear",
          confidenceScore: String(analysis.confidenceScore ?? 0),
          summary: analysis.summary || "Unklare E-Mail",
          evidenceJson: analysis.evidence || [],
          extractedReferencesJson: analysis.extractedReferences || {},
          requestedResolversJson: analysis.requestedResolvers || [],
          blockingQuestionsJson: analysis.blockingQuestions || [],
          rawLlmTrace: {
            response: finalText,
            analysis,
            resolution: analysis.resolution,
            model: llmConfig.modelName,
            provider: llmConfig.providerName,
          },
        })
        .returning();

      await db
        .update(aiRun)
        .set({ status: "completed", durationMs: Date.now() - startedAt })
        .where(eq(aiRun.runId, run.runId));

      return {
        interpretationId: interpretation.interpretationId,
        interpretation,
        analysis,
      };
    } catch (error) {
      await db
        .update(aiRun)
        .set({ status: "failed", durationMs: Date.now() - startedAt })
        .where(eq(aiRun.runId, run.runId));
      throw error;
    }
  }

  /**
   * Phase C: Building the UI-Review payload.
   */
  static async buildMailReview(params: {
    interpretationId: string;
    resolution: any;
    tenantId: string;
  }): Promise<{ reviewId: string; review: NormalizedMailReviewPayload }> {
    const [interp] = await db
      .select()
      .from(aiInterpretation)
      .where(
        and(
          eq(aiInterpretation.interpretationId, params.interpretationId),
          eq(aiInterpretation.tenantId, params.tenantId),
        ),
      )
      .limit(1);

    if (!interp) throw new Error("Interpretation not found");
    if (!interp.sourceThreadId) throw new Error("Missing source thread reference");

    const bundles = buildMailBundleDefinitions({
      interp,
      resolution: params.resolution,
    });
    const selectedBundle = resolveBundleSelection(
      bundles,
      params.resolution?.selectedBundleId ?? null,
    );
    const reviewStatus =
      selectedBundle.readiness === "ready" ? "ready_for_review" : "requires_user_input";
    const blockingIssues =
      selectedBundle.readiness === "ready"
        ? []
        : selectedBundle.readiness === "needs_user_input"
          ? [
              {
                code: "select_bundle",
                message:
                  "Bitte wählen Sie einen Bundle-Plan mit vollständig aufgelösten Resolvern.",
                resolutionType: "select_bundle",
              },
            ]
          : [
              {
                code: "bundle_blocked",
                message: "Der ausgewählte Bundle-Plan ist im aktuellen Kontext nicht ausführbar.",
                resolutionType: "select_bundle",
              },
            ];

    const isOrderFromOffer = isOrderFromOfferIntent(interp.businessIntent);
    const summary = isOrderFromOffer
      ? `Die E-Mail verweist auf ein bestehendes Angebot. Wählen Sie einen Bundle-Plan für Auftrag, Verknüpfung und optionalen Antwort-Entwurf.`
      : `Die E-Mail wird als Klassifizierungsfall behandelt.`;

    const reviewId = randomUUID();
    const reviewPayload = normalizeMailReviewPayload({
      reviewId,
      taskScope: "mail-order-review",
      sourceContext: {
        contextType: "email_thread",
        threadId: interp.sourceThreadId,
      },
      headline: isOrderFromOffer ? "Auftragsbezogene E-Mail-Aktion" : "E-Mail klassifizieren",
      summary,
      intentBadge: {
        label: isOrderFromOffer ? "Bestellung / Auftrag" : "Sonstiges / unklar",
        confidenceScore: toNumber(interp.confidenceScore, 0),
      },
      businessCase: isOrderFromOffer ? "order_existing_offer" : "classification_only",
      reviewStatus,
      bundles,
      selectedBundleId: selectedBundle.bundleId,
      warnings: bundles.flatMap((bundle) => bundle.warnings),
      blockingIssues,
      proposedApplyPayload: {
        bundleId: selectedBundle.bundleId,
        overrides: {},
      },
      _llmTrace: interp.rawLlmTrace,
    });

    const [reviewRow] = await db
      .insert(aiReview)
      .values({
        reviewId,
        tenantId: params.tenantId,
        interpretationId: interp.interpretationId,
        runId: interp.runId,
        reviewStatus,
        businessCase: reviewPayload.businessCase,
        headline: reviewPayload.headline,
        summary: reviewPayload.summary,
        intentBadgeJson: reviewPayload.intentBadge,
        sectionsJson: {
          sourceContext: reviewPayload.sourceContext,
          bundles: reviewPayload.bundles,
          selectedBundleId: reviewPayload.selectedBundleId,
        },
        warningsJson: reviewPayload.warnings,
        blockingIssuesJson: reviewPayload.blockingIssues,
        proposedApplyPayloadJson: reviewPayload.proposedApplyPayload,
      })
      .returning();

    return {
      reviewId: reviewRow.reviewId,
      review: reviewPayload,
    };
  }

  /**
   * Phase D: validation dry-run
   */
  static async validateMailReview(params: {
    reviewId: string;
    overrides?: any;
    tenantId: string;
  }): Promise<any> {
    const [review] = await db
      .select()
      .from(aiReview)
      .where(and(eq(aiReview.reviewId, params.reviewId), eq(aiReview.tenantId, params.tenantId)))
      .limit(1);

    if (!review) throw new Error("Review not found");

    const [interpretation] = await db
      .select()
      .from(aiInterpretation)
      .where(
        and(
          eq(aiInterpretation.interpretationId, review.interpretationId),
          eq(aiInterpretation.tenantId, params.tenantId),
        ),
      )
      .limit(1);

    if (!interpretation) throw new Error("Interpretation not found");
    if (!interpretation.sourceThreadId) {
      throw new Error("Missing source thread reference");
    }
    const sections = normalizeMailReviewPayload({
      reviewId: review.reviewId,
      taskScope: "mail-order-review",
      ...(review.sectionsJson as any),
      selectedBundleId: (review.proposedApplyPayloadJson as any)?.bundleId ?? null,
    });
    const overrides = params.overrides || {};
    const legacyOverrides = extractLegacyBundleOverrides(overrides.steps);
    const extraReplyInstruction =
      typeof overrides.extraReplyInstruction === "string"
        ? overrides.extraReplyInstruction.trim()
        : "";
    const bundles = sections.bundles;
    const selectedBundle = resolveBundleSelection(
      bundles as MailActionBundle[],
      overrides.bundleId ??
        legacyOverrides.bundleId ??
        sections.selectedBundleId ??
        (review.proposedApplyPayloadJson as any)?.bundleId,
    );

    const finalAddressId =
      overrides.selectedAddressId ||
      legacyOverrides.selectedAddressId ||
      selectedBundle.resolverSlots.find((slot) => slot.slotKey === "customer")?.resolvedId ||
      null;
    const finalDocumentId =
      overrides.selectedDocumentId ||
      legacyOverrides.selectedDocumentId ||
      selectedBundle.resolverSlots.find((slot) => slot.slotKey === "referenceDocument")
        ?.resolvedId ||
      null;

    const blockingIssues: any[] = [];
    const commandDryRun: any[] = selectedBundle.commandPreview.map((command) => ({
      commandKey: command.commandKey,
      status: command.blocking ? "ok" : "optional",
      message: command.label,
    }));

    if (!finalAddressId) {
      blockingIssues.push({ code: "select_address", message: "Bitte weisen Sie einen Kunden zu." });
    }

    if (
      (selectedBundle.bundleId === MAIL_BUNDLE_IDS.convertOfferToOrder ||
        selectedBundle.bundleId === MAIL_BUNDLE_IDS.convertAndPrepareReply) &&
      !finalDocumentId
    ) {
      blockingIssues.push({
        code: "select_document",
        message: "Bitte weisen Sie ein referenziertes Angebot zu.",
      });
    }

    if (selectedBundle.bundleId === MAIL_BUNDLE_IDS.convertAndPrepareReply) {
      const [thread] = await db
        .select()
        .from(emailThread)
        .where(
          and(
            eq(emailThread.tenantId, params.tenantId),
            eq(emailThread.emailThreadId, interpretation.sourceThreadId),
          ),
        )
        .limit(1);

      const accountId = thread?.emailAccountId ?? null;
      if (!accountId) {
        blockingIssues.push({
          code: "missing_identity",
          message: "Es konnte kein Versandkonto für den Antwort-Entwurf gefunden werden.",
        });
      } else {
        const identities = await db
          .select()
          .from(emailIdentity)
          .where(
            and(
              eq(emailIdentity.tenantId, params.tenantId),
              eq(emailIdentity.emailAccountId, accountId),
              eq(emailIdentity.canSend, true),
              eq(emailIdentity.archived, false),
            ),
          )
          .limit(5);
        if (identities.length === 0) {
          blockingIssues.push({
            code: "missing_identity",
            message: "Es wurde keine sendefähige Identität für den Antwort-Entwurf gefunden.",
          });
        }
      }
    }

    const validationStatus = blockingIssues.length > 0 ? "blocked" : "valid";

    // Persist status back to review row
    await db
      .update(aiReview)
      .set({
        reviewStatus: validationStatus === "blocked" ? "blocked" : "ready_for_review",
        appliedOverridesJson: {
          ...overrides,
          bundleId: selectedBundle.bundleId,
          extraReplyInstruction: extraReplyInstruction || undefined,
        },
      })
      .where(eq(aiReview.reviewId, params.reviewId));

    return {
      reviewId: review.reviewId,
      selectedBundleId: selectedBundle.bundleId,
      validationStatus,
      blockingIssues,
      commandDryRun,
    };
  }

  /**
   * Phase E: Transactional commands execution.
   */
  static async applyMailReview(params: {
    reviewId: string;
    overrides?: any;
    tenantId: string;
    userId: string;
  }): Promise<{
    success: boolean;
    appliedCommands: any[];
    nextUiActions?: any[];
    extractedMemories?: any[];
  }> {
    const [review] = await db
      .select()
      .from(aiReview)
      .where(and(eq(aiReview.reviewId, params.reviewId), eq(aiReview.tenantId, params.tenantId)))
      .limit(1);

    if (!review) throw new Error("Review not found");

    const sections = normalizeMailReviewPayload({
      reviewId: review.reviewId,
      taskScope: "mail-order-review",
      ...(review.sectionsJson as any),
      selectedBundleId: (review.proposedApplyPayloadJson as any)?.bundleId ?? null,
    });
    const overrides = params.overrides || {};
    const legacyOverrides = extractLegacyBundleOverrides(overrides.steps);
    const extraReplyInstruction =
      typeof overrides.extraReplyInstruction === "string"
        ? overrides.extraReplyInstruction.trim()
        : "";
    const bundles = sections.bundles;
    const selectedBundle = resolveBundleSelection(
      bundles as MailActionBundle[],
      overrides.bundleId ??
        legacyOverrides.bundleId ??
        sections.selectedBundleId ??
        (review.proposedApplyPayloadJson as any)?.bundleId,
    );
    const finalAddressId =
      overrides.selectedAddressId ||
      legacyOverrides.selectedAddressId ||
      selectedBundle.resolverSlots.find((slot) => slot.slotKey === "customer")?.resolvedId ||
      null;
    const finalDocumentId =
      overrides.selectedDocumentId ||
      legacyOverrides.selectedDocumentId ||
      selectedBundle.resolverSlots.find((slot) => slot.slotKey === "referenceDocument")
        ?.resolvedId ||
      null;

    if (!finalAddressId) throw new Error("Fehlende Geschäftspartner-Zuordnung");
    if (
      (selectedBundle.bundleId === MAIL_BUNDLE_IDS.convertOfferToOrder ||
        selectedBundle.bundleId === MAIL_BUNDLE_IDS.convertAndPrepareReply) &&
      !finalDocumentId
    ) {
      throw new Error("Fehlende Referenz auf das Angebot");
    }

    const appliedCommands: any[] = [];
    const nextUiActions: any[] = [];

    const [interpretation] = await db
      .select()
      .from(aiInterpretation)
      .where(
        and(
          eq(aiInterpretation.interpretationId, review.interpretationId),
          eq(aiInterpretation.tenantId, params.tenantId),
        ),
      )
      .limit(1);

    if (!interpretation?.sourceThreadId) {
      throw new Error("Missing source thread reference");
    }

    const [thread] = await db
      .select()
      .from(schema.emailThread)
      .where(
        and(
          eq(schema.emailThread.emailThreadId, interpretation.sourceThreadId),
          eq(schema.emailThread.tenantId, params.tenantId),
        ),
      )
      .limit(1);

    if (!thread) throw new Error("E-Mail-Thread nicht gefunden");

    let resultingOrderId: string | null = null;
    let resultingOrderNo: string | null = null;
    let replyDraftId: string | null = null;

    if (
      selectedBundle.bundleId === MAIL_BUNDLE_IDS.convertOfferToOrder ||
      selectedBundle.bundleId === MAIL_BUNDLE_IDS.convertAndPrepareReply
    ) {
      const { DocumentService } = await import("./document-service");
      const docSvc = new DocumentService();
      const candidates = await docSvc.getConversionCandidates(
        finalDocumentId as string,
        params.tenantId,
      );
      if (candidates.length === 0) {
        throw new Error("Keine Zielgruppe für die Wandlung dieses Belegs gefunden.");
      }
      const candidate =
        candidates.find((c: any) => c.documentType.toLowerCase() === "a") || candidates[0];
      const result = await docSvc.convertDocument(
        finalDocumentId as string,
        params.userId,
        params.tenantId,
        candidate.documentGroupId,
      );
      if (!result.success || !result.newDocumentId) {
        throw new Error("Fehler bei der Belegwandlung.");
      }

      resultingOrderId = result.newDocumentId;
      const [newDocRecord] = await db
        .select()
        .from(schema.document)
        .where(eq(schema.document.documentId, resultingOrderId))
        .limit(1);
      resultingOrderNo = newDocRecord?.documentNo || null;

      appliedCommands.push({
        commandKey: "convert-document-from-ai-review",
        status: "applied",
        resultingEntity: "document",
        resultingId: resultingOrderId,
        resultingLabel: `Auftrag ${resultingOrderNo || ""}`,
      });
    }

    await db
      .update(schema.emailThread)
      .set({
        relatedAddressId: finalAddressId,
        relatedDocumentId:
          selectedBundle.bundleId === MAIL_BUNDLE_IDS.classifyOnly
            ? undefined
            : resultingOrderId || finalDocumentId || undefined,
      })
      .where(eq(schema.emailThread.emailThreadId, thread.emailThreadId));

    appliedCommands.push({
      commandKey: "apply-ai-mail-classification",
      status: "applied",
      resultingEntity: "emailThread",
      resultingId: thread.emailThreadId,
      resultingLabel: "Thread verknüpft mit Kunde",
    });

    if (selectedBundle.bundleId === MAIL_BUNDLE_IDS.convertAndPrepareReply) {
      const accountId = thread.emailAccountId;
      if (!accountId) throw new Error("Kein Versandkonto für den Antwort-Entwurf gefunden");

      const identities = await db
        .select()
        .from(emailIdentity)
        .where(
          and(
            eq(emailIdentity.tenantId, params.tenantId),
            eq(emailIdentity.emailAccountId, accountId),
            eq(emailIdentity.canSend, true),
            eq(emailIdentity.archived, false),
          ),
        )
        .limit(5);
      const identity = identities.find((item) => item.isPrimary) ?? identities[0];
      if (!identity)
        throw new Error("Keine sendefähige Identität für den Antwort-Entwurf gefunden");

      const inboundMessages = await db
        .select()
        .from(emailMessage)
        .where(
          and(
            eq(emailMessage.tenantId, params.tenantId),
            eq(emailMessage.emailThreadId, thread.emailThreadId),
            eq(emailMessage.direction, "inbound"),
          ),
        )
        .orderBy(desc(emailMessage.createdAt))
        .limit(1);
      const fallbackMessages = inboundMessages.length
        ? inboundMessages
        : await db
            .select()
            .from(emailMessage)
            .where(
              and(
                eq(emailMessage.tenantId, params.tenantId),
                eq(emailMessage.emailThreadId, thread.emailThreadId),
              ),
            )
            .orderBy(desc(emailMessage.createdAt))
            .limit(1);
      const sourceMessage = fallbackMessages[0];
      if (!sourceMessage) {
        throw new Error("Keine Nachricht für den Antwort-Entwurf gefunden");
      }

      const sourceSender = getMailDisplayValue(sourceMessage.fromJson);
      const replyToEmail =
        typeof sourceMessage.fromJson === "object" &&
        sourceMessage.fromJson !== null &&
        typeof (sourceMessage.fromJson as Record<string, unknown>).email === "string"
          ? String((sourceMessage.fromJson as Record<string, unknown>).email)
          : null;

      const generatedReply = await generateReplyDraftBody({
        sourceSubject: thread.subject,
        sourceSender,
        sourceEmailText: [
          sourceMessage.subject ? `Subject: ${sourceMessage.subject}` : "",
          sourceMessage.bodyText || htmlToText(sourceMessage.bodyHtml || ""),
        ]
          .filter(Boolean)
          .join("\n\n"),
        documentLabel:
          resultingOrderNo != null
            ? `Auftrag ${resultingOrderNo}`
            : finalDocumentId
              ? `Beleg ${finalDocumentId}`
              : null,
        documentNo: resultingOrderNo ?? finalDocumentId,
        extraReplyInstruction,
        tenantId: params.tenantId,
        userId: params.userId,
      });

      const replyDraft = await new EmailDocumentService(
        params.tenantId,
        params.userId,
      ).prepareDocumentEmail({
        documentId: resultingOrderId || finalDocumentId || "",
        emailIdentityId: identity.emailIdentityId,
        subject: `Re: ${thread.subject ?? ""}`.trim(),
        to: replyToEmail ? [{ email: replyToEmail, name: sourceSender ?? undefined }] : undefined,
        bodyText: generatedReply?.bodyText,
        bodyHtml: generatedReply?.bodyHtml,
      });

      replyDraftId = replyDraft.draft?.outbox?.emailOutboxId ?? null;
      appliedCommands.push({
        commandKey: "prepare-document-email",
        status: "applied",
        resultingEntity: "emailOutbox",
        resultingId: replyDraftId,
        resultingLabel: "Antwort-Entwurf vorbereitet",
      });

      if (replyDraftId) {
        nextUiActions.push({
          type: "open_email_draft",
          label: "Antwort-Entwurf öffnen",
          targetId: replyDraftId,
        });
      }
    }

    if (resultingOrderId) {
      nextUiActions.unshift({
        type: "open_document",
        label: "Auftrag öffnen",
        targetId: resultingOrderId,
      });
    }

    let extractedMemories: any[] = [];
    try {
      const llm = await resolveLlmRuntimeConfig(params.tenantId, params.userId);
      const threadMsgs = await db
        .select()
        .from(emailMessage)
        .where(
          and(
            eq(emailMessage.tenantId, params.tenantId),
            eq(emailMessage.emailThreadId, thread.emailThreadId),
          ),
        )
        .orderBy(desc(emailMessage.createdAt))
        .limit(5);

      const messagesText = [
        thread.subject ? `Subject: ${thread.subject}` : "",
        ...threadMsgs.map(
          (m: any) =>
            `From: ${formatMailPerson(m.fromJson)}\nTo: ${parseMailRecipients(m.toJson)}\nBody: ${m.bodyText || htmlToText(m.bodyHtml || "")}`,
        ),
      ]
        .filter(Boolean)
        .join("\n---\n");

      const prompt = `Du bist ein KI-System zur Extraktion von langfristigen Gedächtniseinträgen (Memory Facts).
Wir haben gerade eine E-Mail-Klassifizierung und Aktion durchgeführt.
E-Mail-Thread:
${messagesText}

Durchgeführte Aktionen:
- Verknüpfung mit Adresse: ${finalAddressId}
- Erstellter/Verknüpfter Beleg: ${resultingOrderId || finalDocumentId || "Keiner"}
- Bundle ID: ${selectedBundle.bundleId}

Extrahiere wichtige langfristige geschäftliche Fakten, Klassifizierungsmuster, explizite Regeln oder Schreibstile, die für zukünftige Interaktionen mit diesem Kunden nützlich sein könnten.
Gib eine JSON-Liste von Objekten zurück mit folgendem Format:
\`\`\`json
[
  {
    "kind": "business_fact" | "classification_pattern" | "explicit_rule" | "writing_style" | "personal_shorthand",
    "text": "Prägnante Beschreibung des Faktums auf Deutsch (z.B. 'Kunde legt Wert auf formelle Ansprache')",
    "confidence": 0.85
  }
]
\`\`\`
Antworte ausschließlich mit dem validen JSON-Array. Wenn keine nützlichen Fakten gefunden werden, gib ein leeres Array [] zurück.`;

      const { createConfiguredProvider } = await import("@repo/agent");
      const provider = createConfiguredProvider({
        provider: llm.providerName,
        model: llm.modelName,
        apiKey: llm.apiKey || undefined,
        endpointUrl: llm.gatewayUrl || undefined,
        vertexCredentials: llm.vertexCredentials || undefined,
        vertexProject: llm.vertexProject || undefined,
        vertexLocation: llm.vertexLocation || undefined,
      });

      const responseText = (await provider.chat({
        messages: [{ role: "user", content: prompt }],
      })) as string;

      const cleanContent = responseText
        .replace(/^```json\n?/, "")
        .replace(/\n?```$/, "")
        .trim();
      const parsed = JSON.parse(cleanContent);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item.kind && item.text && typeof item.confidence === "number") {
            const [inserted] = await db
              .insert(aiMemory)
              .values({
                tenantId: params.tenantId,
                userId: params.userId,
                kind: item.kind,
                text: item.text,
                confidence: String(item.confidence),
                sourceReviewId: params.reviewId,
              })
              .returning({
                memoryId: aiMemory.memoryId,
                kind: aiMemory.kind,
                text: aiMemory.text,
                confidence: aiMemory.confidence,
              });
            extractedMemories.push(inserted);
          }
        }
      }
    } catch (e) {
      console.error("Failed to extract memory facts:", e);
    }

    return {
      success: true,
      appliedCommands,
      nextUiActions,
      extractedMemories,
    };
  }
}
