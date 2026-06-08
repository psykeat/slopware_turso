type UnknownRecord = Record<string, unknown>;

const VALID_SLOT_STATUSES = new Set(["resolved", "needs_selection", "missing"]);
const VALID_BUNDLE_READINESS = new Set(["ready", "needs_user_input", "blocked"]);

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

export type NormalizedMailResolverCandidate = {
  id: string;
  label: string;
  score: number | null;
  recommended: boolean;
};

export type NormalizedMailResolverSlot = {
  slotKey: "customer" | "referenceDocument" | "replyIdentity";
  label: string;
  status: "resolved" | "needs_selection" | "missing";
  resolvedId: string | null;
  displayValue: string | null;
  candidates: NormalizedMailResolverCandidate[];
};

export type NormalizedMailActionBundle = {
  bundleId: string;
  title: string;
  description: string;
  confidenceScore: number;
  recommended: boolean;
  readiness: "ready" | "needs_user_input" | "blocked";
  expectedOutcomes: Array<{ type: string; label: string }>;
  resolverSlots: NormalizedMailResolverSlot[];
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

export type NormalizedMailReviewPayload = {
  reviewId: string;
  taskScope: string;
  headline: string;
  summary: string;
  intentBadge: {
    label: string;
    confidenceScore: number;
  };
  bundles: NormalizedMailActionBundle[];
  selectedBundleId: string | null;
  warnings: string[];
  blockingIssues: Array<{
    code: string;
    message: string;
    resolutionType: string;
  }>;
  selectedAddressId: string | null;
  selectedDocumentId: string | null;
  extraReplyInstruction: string;
  sourceContext?: UnknownRecord | null;
  businessCase: string;
  reviewStatus: string;
  proposedApplyPayload?: UnknownRecord | null;
  _llmTrace?: unknown;
};

function normalizeResolverCandidate(candidate: unknown): NormalizedMailResolverCandidate {
  const record = asRecord(candidate);
  return {
    id: asString(record?.id),
    label: asString(record?.label, "Unaufgelöst"),
    score: record?.score == null ? null : asNumber(record.score, 0),
    recommended: asBoolean(record?.recommended),
  };
}

function normalizeResolverSlot(slot: unknown): NormalizedMailResolverSlot {
  const record = asRecord(slot);
  const slotKey =
    record?.slotKey === "customer" ||
    record?.slotKey === "referenceDocument" ||
    record?.slotKey === "replyIdentity"
      ? record.slotKey
      : "customer";
  const status =
    record?.status === "resolved" ||
    record?.status === "needs_selection" ||
    record?.status === "missing"
      ? record.status
      : "missing";

  return {
    slotKey,
    label: asString(record?.label, "Unaufgelöst"),
    status: VALID_SLOT_STATUSES.has(status) ? status : "missing",
    resolvedId: asTrimmedString(record?.resolvedId),
    displayValue: asTrimmedString(record?.displayValue),
    candidates: Array.isArray(record?.candidates)
      ? record.candidates.map(normalizeResolverCandidate)
      : [],
  };
}

function normalizeBundle(bundle: unknown, index: number): NormalizedMailActionBundle {
  const record = asRecord(bundle);
  const readiness =
    record?.readiness === "ready" ||
    record?.readiness === "needs_user_input" ||
    record?.readiness === "blocked"
      ? record.readiness
      : "blocked";

  return {
    bundleId: asString(record?.bundleId, `bundle-${index + 1}`),
    title: asString(record?.title, "Unaufgelöst"),
    description: asString(record?.description, ""),
    confidenceScore: asNumber(record?.confidenceScore, 0),
    recommended: asBoolean(record?.recommended),
    readiness: VALID_BUNDLE_READINESS.has(readiness) ? readiness : "blocked",
    expectedOutcomes: Array.isArray(record?.expectedOutcomes)
      ? record.expectedOutcomes.map((outcome) => {
          const outcomeRecord = asRecord(outcome);
          return {
            type: asString(outcomeRecord?.type, ""),
            label: asString(outcomeRecord?.label, ""),
          };
        })
      : [],
    resolverSlots: Array.isArray(record?.resolverSlots)
      ? record.resolverSlots.map(normalizeResolverSlot)
      : [],
    commandPreview: Array.isArray(record?.commandPreview)
      ? record.commandPreview.map((command) => {
          const commandRecord = asRecord(command);
          return {
            order: asNumber(commandRecord?.order, 0),
            commandKey: asString(commandRecord?.commandKey, ""),
            label: asString(commandRecord?.label, ""),
            mode:
              commandRecord?.mode === "sync" || commandRecord?.mode === "async"
                ? commandRecord.mode
                : "sync",
            blocking: asBoolean(commandRecord?.blocking),
          };
        })
      : [],
    followUpOptions: Array.isArray(record?.followUpOptions)
      ? record.followUpOptions.map((option) => {
          const optionRecord = asRecord(option);
          return {
            optionKey: asString(optionRecord?.optionKey, ""),
            label: asString(optionRecord?.label, ""),
            enabledByDefault: asBoolean(optionRecord?.enabledByDefault),
          };
        })
      : [],
    warnings: Array.isArray(record?.warnings)
      ? record.warnings.map((warning) => asString(warning)).filter(Boolean)
      : [],
  };
}

function pickSelectedBundle(
  bundles: NormalizedMailActionBundle[],
  selectedBundleId: string | null,
): NormalizedMailActionBundle | null {
  if (selectedBundleId) {
    const preferred = bundles.find((bundle) => bundle.bundleId === selectedBundleId);
    if (preferred) return preferred;
  }

  return bundles.find((bundle) => bundle.recommended) ?? bundles[0] ?? null;
}

export function normalizeMailReviewPayload(review: unknown): NormalizedMailReviewPayload {
  const record = asRecord(review);
  const bundles = Array.isArray(record?.bundles) ? record.bundles.map(normalizeBundle) : [];
  const selectedBundleId = asTrimmedString(record?.selectedBundleId);
  const selectedBundle = pickSelectedBundle(bundles, selectedBundleId);
  const selectedAddressId =
    asTrimmedString(record?.selectedAddressId) ??
    selectedBundle?.resolverSlots.find((slot) => slot.slotKey === "customer")?.resolvedId ??
    null;
  const selectedDocumentId =
    asTrimmedString(record?.selectedDocumentId) ??
    selectedBundle?.resolverSlots.find((slot) => slot.slotKey === "referenceDocument")
      ?.resolvedId ??
    null;

  return {
    reviewId: asString(record?.reviewId, ""),
    taskScope: asString(record?.taskScope, ""),
    headline: asString(record?.headline, ""),
    summary: asString(record?.summary, ""),
    intentBadge: {
      label: asString(asRecord(record?.intentBadge)?.label, ""),
      confidenceScore: asNumber(asRecord(record?.intentBadge)?.confidenceScore, 0),
    },
    bundles,
    selectedBundleId: selectedBundle?.bundleId ?? null,
    warnings: Array.isArray(record?.warnings)
      ? record.warnings.map((warning) => asString(warning)).filter(Boolean)
      : [],
    blockingIssues: Array.isArray(record?.blockingIssues)
      ? record.blockingIssues.map((issue) => {
          const issueRecord = asRecord(issue);
          return {
            code: asString(issueRecord?.code, ""),
            message: asString(issueRecord?.message, ""),
            resolutionType: asString(issueRecord?.resolutionType, ""),
          };
        })
      : [],
    selectedAddressId,
    selectedDocumentId,
    extraReplyInstruction: asTrimmedString(record?.extraReplyInstruction) ?? "",
    sourceContext: asRecord(record?.sourceContext),
    businessCase: asTrimmedString(record?.businessCase) ?? "",
    reviewStatus: asTrimmedString(record?.reviewStatus) ?? "",
    proposedApplyPayload: asRecord(record?.proposedApplyPayload),
    _llmTrace: record?._llmTrace,
  };
}
