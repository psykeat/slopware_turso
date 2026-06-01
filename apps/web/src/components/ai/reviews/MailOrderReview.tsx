import { cn } from "@repo/ui/lib/utils";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  FileTextIcon,
  SparklesIcon,
  UserIcon,
} from "lucide-react";
import { useState } from "react";

type ResolverCandidate = {
  id: string;
  label: string;
  score: number | null;
  recommended: boolean;
};

type ResolverSlot = {
  slotKey: "customer" | "referenceDocument" | "replyIdentity";
  label: string;
  status: "resolved" | "needs_selection" | "missing";
  resolvedId: string | null;
  displayValue: string | null;
  candidates: ResolverCandidate[];
};

type ActionBundle = {
  bundleId: string;
  title: string;
  description: string;
  confidenceScore: number;
  recommended: boolean;
  readiness: "ready" | "needs_user_input" | "blocked";
  expectedOutcomes: Array<{ type: string; label: string }>;
  resolverSlots: ResolverSlot[];
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

type BundleReviewPayload = {
  reviewId: string;
  taskScope: string;
  headline: string;
  summary: string;
  intentBadge: {
    label: string;
    confidenceScore: number;
  };
  bundles: ActionBundle[];
  selectedBundleId?: string | null;
  warnings?: string[];
  blockingIssues?: Array<{
    code: string;
    message: string;
    resolutionType: string;
  }>;
  selectedAddressId?: string | null;
  selectedDocumentId?: string | null;
  extraReplyInstruction?: string | null;
};

function slotValue(slot: ResolverSlot) {
  return slot.resolvedId ?? slot.displayValue ?? "";
}

export function MailOrderReview({
  suggestionPayload,
  validation,
  onPatch,
  allAddresses,
  allDocuments = [],
}: {
  suggestionPayload: BundleReviewPayload;
  validation: any;
  onPatch: (patch: Partial<BundleReviewPayload>) => void;
  allAddresses: Array<{
    addressId: string;
    addressNo?: string | null;
    companyName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    city?: string | null;
  }>;
  allDocuments?: Array<{
    documentId: string;
    documentNo?: string | null;
    documentType?: string | null;
    companyName?: string | null;
    customerName?: string | null;
  }>;
}) {
  const [bundleOpen, setBundleOpen] = useState(true);
  const bundles = Array.isArray(suggestionPayload.bundles) ? suggestionPayload.bundles : [];
  const [manualLookupSlot, setManualLookupSlot] = useState<"customer" | "referenceDocument" | null>(
    null,
  );
  const [manualSearchQuery, setManualSearchQuery] = useState("");

  const selectedBundle =
    bundles.find((bundle) => bundle.bundleId === suggestionPayload.selectedBundleId) ||
    bundles.find((bundle) => bundle.recommended) ||
    bundles[0];

  const addressLabel = (addressId: string, fallback?: string) => {
    const address = allAddresses.find((item) => item.addressId === addressId);
    if (!address) return fallback || addressId.slice(0, 8);
    return (
      address.companyName?.trim() ||
      [address.firstName, address.lastName].filter(Boolean).join(" ").trim() ||
      `Geschäftspartner #${address.addressNo || address.addressId.slice(0, 8)}`
    );
  };

  const documentLabel = (documentId: string, fallback?: string) => {
    const document = allDocuments.find((item) => item.documentId === documentId);
    if (!document) return fallback || documentId.slice(0, 8);
    const type = document.documentType?.trim() || "Beleg";
    const number = document.documentNo?.trim() || document.documentId.slice(0, 8);
    const company = document.companyName?.trim() || document.customerName?.trim();
    return company ? `${type} ${number} · ${company}` : `${type} ${number}`;
  };

  const setSelectedSlotValue = (slotKey: ResolverSlot["slotKey"], id: string) => {
    if (slotKey === "customer") {
      onPatch({ selectedAddressId: id });
    } else if (slotKey === "referenceDocument") {
      onPatch({ selectedDocumentId: id });
    }
  };

  const selectedAddressId =
    suggestionPayload.selectedAddressId ||
    selectedBundle?.resolverSlots?.find((slot) => slot.slotKey === "customer")?.resolvedId ||
    null;
  const selectedDocumentId =
    suggestionPayload.selectedDocumentId ||
    selectedBundle?.resolverSlots?.find((slot) => slot.slotKey === "referenceDocument")
      ?.resolvedId ||
    null;
  const extraReplyInstruction = suggestionPayload.extraReplyInstruction || "";
  const warnings = suggestionPayload.warnings || [];
  const documentSearch = manualSearchQuery.trim().toLowerCase();
  const filteredDocuments = documentSearch
    ? allDocuments.filter((document) => {
        const label = documentLabel(document.documentId, "").toLowerCase();
        return (
          label.includes(documentSearch) ||
          (document.documentNo || "").toLowerCase().includes(documentSearch) ||
          (document.companyName || "").toLowerCase().includes(documentSearch)
        );
      })
    : allDocuments.slice(0, 12);

  return (
    <div className="space-y-4 text-[13px]">
      <div className="space-y-3 rounded-md border border-hairline bg-canvas-soft p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold tracking-wider text-ink-mute uppercase">
              KI-Review
            </div>
            <div className="mt-1 text-[15px] font-semibold text-ink">
              {suggestionPayload.headline}
            </div>
          </div>
          <span className="rounded-full border border-primary/20 bg-[color-mix(in_oklab,var(--primary)_8%,transparent)] px-2.5 py-0.5 text-[11px] font-semibold text-primary">
            {suggestionPayload.intentBadge.label}
          </span>
        </div>

        <div className="flex items-center justify-between text-[12px] text-ink-secondary">
          <span>Vertrauen:</span>
          <span className="font-mono font-medium">
            {Math.round((suggestionPayload.intentBadge.confidenceScore ?? 0) * 100)}%
          </span>
        </div>

        <div className="rounded-sm border border-hairline bg-canvas p-3 text-[12px] text-ink-secondary">
          {suggestionPayload.summary}
        </div>

        {warnings.length > 0 && (
          <div className="rounded-sm border border-amber-200 bg-amber-50 p-2.5 text-[12px] text-amber-800">
            <div className="mb-0.5 font-semibold">Hinweise</div>
            <ul className="list-disc space-y-0.5 pl-4">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {validation?.blockingIssues?.length > 0 && (
          <div className="rounded-sm border border-red-200 bg-red-50 p-2.5 text-[12px] text-red-800">
            <div className="mb-0.5 font-semibold">Blocker</div>
            <ul className="list-disc space-y-0.5 pl-4">
              {validation.blockingIssues.map((issue: any) => (
                <li key={issue.code}>{issue.message}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="space-y-3 rounded-md border border-hairline bg-canvas p-4">
        <button
          type="button"
          onClick={() => setBundleOpen((value) => !value)}
          className="flex w-full items-center justify-between text-left"
        >
          <div className="text-[11px] font-bold tracking-wider text-ink uppercase">
            Vorgeschlagene Aktionen
          </div>
          <ChevronDownIcon
            className={cn(
              "size-3.5 text-ink-mute transition-transform",
              bundleOpen && "rotate-180",
            )}
          />
        </button>

        {bundleOpen && (
          <div className="space-y-3">
            <div className="grid gap-2">
              {bundles.map((bundle) => {
                const active = selectedBundle?.bundleId === bundle.bundleId;
                const resolverSlots = Array.isArray(bundle.resolverSlots)
                  ? bundle.resolverSlots
                  : [];
                return (
                  <div
                    key={bundle.bundleId}
                    className={cn(
                      "rounded-md border p-3 text-left transition-colors",
                      active
                        ? "border-primary/30 bg-[color-mix(in_oklab,var(--primary)_6%,transparent)]"
                        : "border-hairline hover:bg-canvas-soft",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <SparklesIcon className="size-3.5 text-primary" />
                          <div className="font-medium text-ink">{bundle.title}</div>
                          {bundle.recommended && (
                            <span className="rounded-full border border-primary/20 bg-[color-mix(in_oklab,var(--primary)_10%,transparent)] px-2 py-0.5 text-[10px] font-semibold text-primary">
                              Empfohlen
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-[12px] text-ink-secondary">
                          {bundle.description}
                        </div>
                        <div className="mt-1 text-[11px] text-ink-mute">
                          Vertrauen: {Math.round((bundle.confidenceScore ?? 0) * 100)}%
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            bundle.readiness === "ready"
                              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                              : bundle.readiness === "needs_user_input"
                                ? "border border-amber-200 bg-amber-50 text-amber-800"
                                : "border border-red-200 bg-red-50 text-red-700",
                          )}
                        >
                          {bundle.readiness}
                        </div>
                        <button
                          type="button"
                          onClick={() => onPatch({ selectedBundleId: bundle.bundleId })}
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition-colors",
                            active
                              ? "border-primary/30 bg-[color-mix(in_oklab,var(--primary)_10%,transparent)] text-primary"
                              : "border-hairline bg-canvas-soft text-ink-secondary hover:bg-canvas",
                          )}
                        >
                          Wählen
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {bundle.expectedOutcomes.map((outcome) => (
                        <div
                          key={outcome.type}
                          className="rounded-sm border border-hairline bg-canvas px-2.5 py-2 text-[11px] text-ink-secondary"
                        >
                          {outcome.label}
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 grid gap-2">
                      {resolverSlots.map((slot) => (
                        <div
                          key={slot.slotKey}
                          className="rounded-md border border-hairline bg-canvas p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-[11px] font-semibold tracking-wider text-ink uppercase">
                                {slot.label}
                              </div>
                              <div className="mt-0.5 text-[11px] text-ink-mute">
                                {slot.status === "resolved"
                                  ? "Aufgelöst"
                                  : slot.status === "needs_selection"
                                    ? "Auswahl nötig"
                                    : "Fehlt"}
                              </div>
                            </div>
                            {slot.resolvedId && (
                              <div className="rounded-full bg-canvas-soft px-2 py-0.5 font-mono text-[10px] text-ink-secondary">
                                {slotValue(slot)}
                              </div>
                            )}
                          </div>

                          {slot.candidates.length > 0 && (
                            <div className="mt-2 space-y-1.5">
                              {slot.candidates.map((candidate) => {
                                const isSelected =
                                  slot.slotKey === "customer"
                                    ? selectedAddressId === candidate.id
                                    : slot.slotKey === "referenceDocument"
                                      ? selectedDocumentId === candidate.id
                                      : slot.resolvedId === candidate.id;

                                return (
                                  <button
                                    key={candidate.id}
                                    type="button"
                                    onClick={() => setSelectedSlotValue(slot.slotKey, candidate.id)}
                                    className={cn(
                                      "flex w-full items-center gap-3 rounded-sm border p-2.5 text-left transition-colors",
                                      isSelected
                                        ? "border-primary/30 bg-[color-mix(in_oklab,var(--primary)_6%,transparent)]"
                                        : "border-hairline hover:bg-canvas-soft",
                                    )}
                                  >
                                    <div
                                      className={cn(
                                        "flex size-7 shrink-0 items-center justify-center rounded-full",
                                        isSelected
                                          ? "bg-primary text-primary-fg"
                                          : "bg-canvas-soft text-ink-mute",
                                      )}
                                    >
                                      {isSelected ? (
                                        <CheckCircle2Icon className="size-4" />
                                      ) : slot.slotKey === "referenceDocument" ? (
                                        <FileTextIcon className="size-3.5" />
                                      ) : (
                                        <UserIcon className="size-3.5" />
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="truncate font-medium text-ink">
                                        {slot.slotKey === "customer"
                                          ? addressLabel(candidate.id, candidate.label)
                                          : candidate.label}
                                      </div>
                                      <div className="truncate text-[11px] text-ink-mute">
                                        {candidate.recommended ? "Vorgeschlagen" : "Alternative"}
                                      </div>
                                    </div>
                                    {candidate.score != null && (
                                      <span className="shrink-0 rounded-full bg-canvas-soft px-1.5 py-0.5 font-mono text-[10px] text-ink-mute">
                                        {Math.round(candidate.score * 100)}%
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          {slot.candidates.length === 0 && (
                            <div className="mt-2 space-y-2">
                              <div className="rounded-sm border border-dashed border-hairline bg-canvas-soft p-2.5 text-[12px] text-ink-mute">
                                Kein eindeutiger Treffer gefunden. Sie können den Slot manuell
                                zuordnen.
                              </div>
                              {slot.slotKey !== "replyIdentity" && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setManualLookupSlot(
                                      slot.slotKey === "customer" ||
                                        slot.slotKey === "referenceDocument"
                                        ? slot.slotKey
                                        : null,
                                    );
                                    setManualSearchQuery("");
                                  }}
                                  className="rounded-full border border-hairline bg-canvas px-2.5 py-0.5 text-[10px] font-semibold text-ink-secondary hover:bg-canvas-soft"
                                >
                                  Manuell zuordnen
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 rounded-md border border-hairline bg-canvas-soft p-3">
                      <div className="text-[11px] font-semibold tracking-wider text-ink-mute uppercase">
                        Geplante Schritte
                      </div>
                      <div className="mt-2 space-y-1.5">
                        {bundle.commandPreview.map((command) => (
                          <div
                            key={command.commandKey}
                            className="flex items-center justify-between rounded-sm border border-hairline bg-canvas px-3 py-2 text-[12px]"
                          >
                            <div className="flex items-center gap-2">
                              <SparklesIcon className="size-3.5 text-primary" />
                              <span className="font-medium text-ink">{command.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {command.blocking && (
                                <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                                  Blockierend
                                </span>
                              )}
                              <span className="rounded-full bg-canvas-soft px-2 py-0.5 text-[10px] text-ink-mute">
                                {command.mode}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {bundle.followUpOptions.length > 0 && (
                      <div className="mt-3 rounded-md border border-hairline bg-canvas p-3">
                        <div className="text-[11px] font-semibold tracking-wider text-ink-mute uppercase">
                          Zusatzsteuerung
                        </div>
                        <div className="mt-2">
                          <textarea
                            value={extraReplyInstruction}
                            onChange={(event) =>
                              onPatch({ extraReplyInstruction: event.target.value })
                            }
                            placeholder="Zusatzanweisung für Antwort"
                            className="min-h-20 w-full rounded-sm border border-hairline bg-canvas-soft px-3 py-2 text-[12px] text-ink outline-none placeholder:text-ink-mute focus:border-primary"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {(selectedBundle?.warnings ?? []).length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800">
                <div className="font-semibold">Bundle-Hinweise</div>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {(selectedBundle?.warnings ?? []).map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {manualLookupSlot && (
              <div className="rounded-md border border-hairline bg-canvas p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-semibold tracking-wider text-ink uppercase">
                    Manuelle Zuordnung
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setManualLookupSlot(null);
                      setManualSearchQuery("");
                    }}
                    className="text-[11px] text-ink-mute hover:text-ink"
                  >
                    Schließen
                  </button>
                </div>
                <div className="mt-2">
                  <input
                    type="text"
                    value={manualSearchQuery}
                    onChange={(event) => setManualSearchQuery(event.target.value)}
                    placeholder={
                      manualLookupSlot === "customer"
                        ? "Name oder Ort suchen..."
                        : "Belegnummer oder Kunde suchen..."
                    }
                    className="h-9 w-full rounded-sm border border-hairline bg-canvas-soft px-3 text-[13px] text-ink outline-none placeholder:text-ink-mute focus:border-primary"
                  />
                </div>
                <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                  {manualLookupSlot === "customer" &&
                    (manualSearchQuery.trim()
                      ? allAddresses.filter((address) => {
                          const label = addressLabel(address.addressId, "").toLowerCase();
                          const query = manualSearchQuery.toLowerCase();
                          return (
                            label.includes(query) ||
                            (address.city || "").toLowerCase().includes(query)
                          );
                        })
                      : allAddresses.slice(0, 12)
                    ).map((address) => (
                      <button
                        key={address.addressId}
                        type="button"
                        onClick={() => {
                          onPatch({ selectedAddressId: address.addressId });
                          setManualLookupSlot(null);
                          setManualSearchQuery("");
                        }}
                        className={cn(
                          "flex w-full items-center justify-between rounded-sm border px-3 py-2 text-left text-[12px] transition-colors",
                          selectedAddressId === address.addressId
                            ? "border-primary/30 bg-[color-mix(in_oklab,var(--primary)_6%,transparent)]"
                            : "border-hairline hover:bg-canvas-soft",
                        )}
                      >
                        <span className="truncate font-medium text-ink">
                          {addressLabel(address.addressId)}
                        </span>
                        {address.city && (
                          <span className="ml-2 shrink-0 text-[11px] text-ink-mute">
                            {address.city}
                          </span>
                        )}
                      </button>
                    ))}

                  {manualLookupSlot === "referenceDocument" &&
                    filteredDocuments.map((document) => (
                      <button
                        key={document.documentId}
                        type="button"
                        onClick={() => {
                          onPatch({ selectedDocumentId: document.documentId });
                          setManualLookupSlot(null);
                          setManualSearchQuery("");
                        }}
                        className={cn(
                          "flex w-full items-center justify-between rounded-sm border px-3 py-2 text-left text-[12px] transition-colors",
                          selectedDocumentId === document.documentId
                            ? "border-primary/30 bg-[color-mix(in_oklab,var(--primary)_6%,transparent)]"
                            : "border-hairline hover:bg-canvas-soft",
                        )}
                      >
                        <span className="truncate font-medium text-ink">
                          {documentLabel(document.documentId)}
                        </span>
                        <span className="ml-2 shrink-0 text-[11px] text-ink-mute">
                          {document.documentType || "Beleg"}
                        </span>
                      </button>
                    ))}

                  {manualLookupSlot === "referenceDocument" && filteredDocuments.length === 0 && (
                    <div className="px-3 py-2 text-[12px] text-ink-mute">Keine Belege gefunden</div>
                  )}
                  {manualLookupSlot === "customer" &&
                    (manualSearchQuery.trim()
                      ? allAddresses.filter((address) => {
                          const label = addressLabel(address.addressId, "").toLowerCase();
                          const query = manualSearchQuery.toLowerCase();
                          return (
                            label.includes(query) ||
                            (address.city || "").toLowerCase().includes(query)
                          );
                        })
                      : allAddresses.slice(0, 12)
                    ).length === 0 && (
                      <div className="px-3 py-2 text-[12px] text-ink-mute">
                        Keine Geschäftspartner gefunden
                      </div>
                    )}
                </div>
              </div>
            )}

            {validation?.blockingIssues?.length > 0 && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-[12px] text-red-800">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertCircleIcon className="size-4" />
                  <span>Offene Punkte</span>
                </div>
                <ul className="mt-2 list-disc space-y-0.5 pl-4">
                  {validation.blockingIssues.map((issue: any) => (
                    <li key={issue.code}>{issue.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
