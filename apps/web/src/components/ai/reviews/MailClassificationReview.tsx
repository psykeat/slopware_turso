import { cn } from "@repo/ui/lib/utils";
import { CheckCircle2Icon, ChevronDownIcon, SearchIcon, UserIcon } from "lucide-react";
import React, { useState } from "react";

import { useAddresses } from "../hooks/useAiData";
import { formatAddressLabel, safeIdPrefix } from "./mail-review-labels";

export interface AddressOption {
  addressId: string;
  addressNo?: string | null;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  city?: string | null;
  /** Legacy field — not in DB, kept for type-compat */
  name?: string | null;
}

/** Intention categories that have transaction relevance → show partner assignment */
const TRANSACTION_INTENTIONS = new Set([
  "Bestellung / Auftrag",
  "Angebotsanfrage",
  "Rechnung / Beleg",
]);

function addressLabel(a: AddressOption): string {
  return formatAddressLabel(a);
}

function searchText(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

export interface MailClassificationReviewProps {
  suggestionPayload: {
    businessIntention?: string;
    confidenceScore?: number;
    blockedReasons?: string[];
    applyReadiness?: string;
    targetEntities?: string[];
    steps: any[];
  };
  validation: any;
  onPatch: (patch: Partial<any>) => void;
}

export function MailClassificationReview({
  suggestionPayload,
  validation,
  onPatch,
}: MailClassificationReviewProps) {
  const { data: allAddressesData } = useAddresses();
  const allAddresses = allAddressesData ?? [];
  const rawSteps = suggestionPayload.steps || [];
  const steps = rawSteps.map((s: any, idx: number) => ({
    ...s,
    stepIndex: s.stepIndex ?? s.stepId ?? s.step ?? idx + 1,
    actionType: s.actionType || s.type || s.action,
    commandPayload: s.commandPayload || s.commandInput || s.parameters,
  }));
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [planOpen, setPlanOpen] = useState(false);
  const [traceOpen, setTraceOpen] = useState(false);

  // Find the address lookup step
  const lookupIndex = steps.findIndex(
    (step: any) => step.actionType === "LOOKUP" && step.entityName === "address",
  );
  const lookupStep = lookupIndex !== -1 ? steps[lookupIndex] : null;
  const candidateMatches: Array<{ id: string; displayValue?: string; confidence?: number }> =
    lookupStep?.candidateMatches || [];
  const currentAddressId = lookupStep?.selectedMatchId || candidateMatches[0]?.id || "";

  const intention = suggestionPayload.businessIntention || "";
  const showPartnerSection = TRANSACTION_INTENTIONS.has(intention) || candidateMatches.length > 0;

  const handleAddressChange = (newAddressId: string) => {
    const updatedSteps = [...steps];
    if (lookupIndex !== -1) {
      updatedSteps[lookupIndex] = {
        ...updatedSteps[lookupIndex],
        selectedMatchId: newAddressId || undefined,
      };
    }

    // Propagate to dependent command steps
    const classificationIndex = steps.findIndex(
      (step: any) =>
        step.actionType === "EXECUTE_COMMAND" && step.commandKey === "apply-ai-mail-classification",
    );
    if (classificationIndex !== -1) {
      updatedSteps[classificationIndex] = {
        ...updatedSteps[classificationIndex],
        commandPayload: {
          ...updatedSteps[classificationIndex].commandPayload,
          relatedAddressId: newAddressId || undefined,
        },
      };
    }

    const documentIndex = steps.findIndex(
      (step: any) =>
        step.actionType === "EXECUTE_COMMAND" &&
        step.commandKey === "create-document-draft-from-ai-plan",
    );
    if (documentIndex !== -1) {
      updatedSteps[documentIndex] = {
        ...updatedSteps[documentIndex],
        commandPayload: {
          ...updatedSteps[documentIndex].commandPayload,
          customerId: newAddressId ? `dependency:${lookupIndex + 1}` : undefined,
        },
      };
    }

    onPatch({ steps: updatedSteps });
  };

  const confidence = suggestionPayload.confidenceScore ?? 1.0;

  // Resolve display name for a candidate ID using allAddresses
  const resolveCandidate = (candidateId: string, displayValue?: string) => {
    const addr = allAddresses.find((a: any) => a.addressId === candidateId);
    return addr ? addressLabel(addr) : displayValue || safeIdPrefix(candidateId);
  };

  // Filtered addresses for manual search
  const filteredAddresses = searchQuery.trim()
    ? allAddresses.filter((a: any) => {
        const label = addressLabel(a).toLowerCase();
        const q = searchQuery.toLowerCase();
        return label.includes(q) || searchText(a.city).includes(q);
      })
    : allAddresses.slice(0, 12);

  return (
    <div className="space-y-4">
      {/* 1. Intent card */}
      <div className="space-y-3 rounded-md border border-hairline bg-canvas-soft p-4 text-[13px]">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-wider text-ink-mute uppercase">
            Erkannte Absicht
          </span>
          <span
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
              intention.startsWith("Bestellung")
                ? "border-primary/20 bg-[color-mix(in_oklab,var(--primary)_8%,transparent)] text-primary"
                : intention.startsWith("Angebotsanfrage")
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : intention.startsWith("Reklamation")
                    ? "border-red-200 bg-red-50 text-red-800"
                    : "border-gray-200 bg-gray-50 text-gray-800",
            )}
          >
            {intention || "Unklar"}
          </span>
        </div>

        <div className="flex items-center justify-between text-[12px] text-ink-secondary">
          <span>Wahrscheinlichkeit:</span>
          <span
            className={cn(
              "font-mono font-medium",
              confidence >= 0.85
                ? "text-emerald-600"
                : confidence >= 0.6
                  ? "text-amber-600"
                  : "text-red-500",
            )}
          >
            {Math.round(confidence * 100)}%
          </span>
        </div>

        {suggestionPayload.blockedReasons && suggestionPayload.blockedReasons.length > 0 && (
          <div className="rounded-sm border border-red-200 bg-red-50 p-2.5 text-[12px] text-red-800">
            <div className="mb-0.5 font-semibold">Blockierende Fehler:</div>
            <ul className="list-disc space-y-0.5 pl-4">
              {suggestionPayload.blockedReasons.map((reason: string, index: number) => (
                <li key={index}>{reason}</li>
              ))}
            </ul>
          </div>
        )}

        {validation?.warnings?.length > 0 && (
          <div className="rounded-sm border border-amber-200 bg-amber-50 p-2.5 text-[12px] text-amber-800">
            <div className="mb-0.5 font-semibold">Hinweise / Warnungen:</div>
            <ul className="list-disc space-y-0.5 pl-4">
              {validation.warnings.map((warning: string, index: number) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Plan transparency toggle */}
        <button
          type="button"
          onClick={() => setPlanOpen((v) => !v)}
          className="flex w-full items-center justify-between text-[11px] text-ink-mute transition-colors hover:text-ink"
        >
          <span className="font-semibold tracking-wider uppercase">
            Geplante Schritte ({steps.length})
          </span>
          <ChevronDownIcon
            className={cn("size-3.5 transition-transform", planOpen && "rotate-180")}
          />
        </button>

        {planOpen && (
          <div className="space-y-1.5">
            {steps.length === 0 ? (
              <div className="text-[11px] text-ink-mute italic">Keine Schritte geplant.</div>
            ) : (
              steps.map((rawStep: any, index: number) => {
                const step = {
                  actionType: rawStep.actionType || rawStep.type || rawStep.action,
                  entityName: rawStep.entityName,
                  lookupCriteria: rawStep.lookupCriteria,
                  candidateMatches: rawStep.candidateMatches,
                  commandKey: rawStep.commandKey,
                  commandPayload:
                    rawStep.commandPayload || rawStep.commandInput || rawStep.parameters,
                  selectedMatchId: rawStep.selectedMatchId,
                  ...rawStep,
                };

                return (
                  <div
                    key={index}
                    className="flex gap-2.5 rounded-sm border border-hairline bg-canvas px-2.5 py-2 text-[11px]"
                  >
                    <span className="mt-px shrink-0 rounded-sm bg-canvas-soft px-1.5 py-0.5 font-mono font-semibold text-ink-mute">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      {step.actionType === "LOOKUP" && (
                        <>
                          <span className="font-semibold text-primary">LOOKUP</span>
                          <span className="text-ink"> → {step.entityName}</span>
                          {step.lookupCriteria && Object.keys(step.lookupCriteria).length > 0 && (
                            <span className="ml-1 text-ink-mute">
                              (
                              {Object.entries(step.lookupCriteria)
                                .map(([k, v]) => `${k}: ${v as any}`)
                                .join(", ")}
                              )
                            </span>
                          )}
                          {step.candidateMatches?.length > 0 && (
                            <span className="ml-1 text-emerald-600">
                              — {step.candidateMatches.length} Treffer (
                              {resolveCandidate(
                                step.selectedMatchId || step.candidateMatches[0].id,
                                step.candidateMatches[0].displayValue,
                              )}
                              )
                            </span>
                          )}
                          {step.candidateMatches?.length === 0 && (
                            <span className="ml-1 text-red-500"> — kein Treffer</span>
                          )}
                        </>
                      )}
                      {step.actionType === "EXECUTE_COMMAND" && (
                        <>
                          <span className="font-semibold text-amber-700">COMMAND</span>
                          <span className="text-ink"> → {step.commandKey}</span>
                          {step.commandPayload && (
                            <div className="mt-0.5 font-mono text-[10px] break-all text-ink-mute">
                              {Object.entries(step.commandPayload)
                                .filter(([, v]) => v !== null && v !== undefined && v !== "")
                                .map(([k, v]) => (
                                  <span key={k} className="mr-2">
                                    {k}: <span className="text-ink">{String(v)}</span>
                                  </span>
                                ))}
                            </div>
                          )}
                        </>
                      )}
                      {step.actionType !== "LOOKUP" && step.actionType !== "EXECUTE_COMMAND" && (
                        <span className="text-ink">{step.actionType || JSON.stringify(step)}</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            {suggestionPayload.applyReadiness && (
              <div className="flex items-center justify-between pt-1 text-[11px] text-ink-mute">
                <span>Bereit zum Buchen:</span>
                <span
                  className={cn(
                    "font-semibold",
                    suggestionPayload.applyReadiness === "ready"
                      ? "text-emerald-600"
                      : suggestionPayload.applyReadiness === "blocked"
                        ? "text-red-500"
                        : "text-amber-600",
                  )}
                >
                  {suggestionPayload.applyReadiness}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Partner assignment — only shown when intention is transaction-relevant */}
      {showPartnerSection && (
        <div className="space-y-3 rounded-md border border-hairline bg-canvas p-4 text-[13px]">
          <div className="text-[11px] font-bold tracking-wider text-ink uppercase">
            1. Geschäftspartner
          </div>

          {/* AI Candidate cards */}
          {candidateMatches.length > 0 ? (
            <div className="space-y-2">
              <div className="text-[12px] text-ink-secondary">
                KI-Vorschlag{candidateMatches.length > 1 ? "e" : ""} auf Basis der E-Mail:
              </div>
              {candidateMatches.map((cand) => {
                const isSelected = currentAddressId === cand.id;
                const label = resolveCandidate(cand.id, cand.displayValue);
                const addr = allAddresses.find((a: any) => a.addressId === cand.id);
                return (
                  <button
                    key={cand.id}
                    type="button"
                    onClick={() => handleAddressChange(cand.id)}
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
                        isSelected ? "bg-primary text-primary-fg" : "bg-canvas-soft text-ink-mute",
                      )}
                    >
                      {isSelected ? (
                        <CheckCircle2Icon className="size-4" />
                      ) : (
                        <UserIcon className="size-3.5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-ink">{label}</div>
                      {addr?.city && (
                        <div className="truncate text-[11px] text-ink-mute">{addr.city}</div>
                      )}
                    </div>
                    {cand.confidence != null && (
                      <span className="shrink-0 rounded-full bg-canvas-soft px-1.5 py-0.5 font-mono text-[10px] text-ink-mute">
                        {Math.round(cand.confidence * 100)}%
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-sm border border-hairline bg-canvas-soft p-2.5 text-[12px] text-ink-mute">
              Kein eindeutiger Geschäftspartner erkannt. Bitte manuell zuordnen.
            </div>
          )}

          {/* Manual search toggle */}
          {!searchOpen ? (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-1.5 text-[12px] text-ink-secondary underline-offset-2 hover:text-ink hover:underline"
            >
              <SearchIcon className="size-3.5" />
              Anderen Kunden manuell suchen
            </button>
          ) : (
            <div className="space-y-1.5">
              <div className="relative">
                <SearchIcon className="absolute top-2.5 left-2.5 size-3.5 text-ink-mute" />
                <input
                  type="text"
                  placeholder="Name oder Ort suchen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 w-full rounded-sm border border-hairline bg-canvas pr-3 pl-8 text-[13px] text-ink outline-none focus:border-primary"
                />
              </div>
              <div className="max-h-40 overflow-y-auto rounded-sm border border-hairline bg-canvas">
                <button
                  type="button"
                  onClick={() => handleAddressChange("")}
                  className="w-full px-3 py-2 text-left text-[12px] text-ink-mute hover:bg-canvas-soft"
                >
                  — Nicht zugeordnet
                </button>
                {filteredAddresses.map((addr: any) => (
                  <button
                    key={addr.addressId}
                    type="button"
                    onClick={() => {
                      handleAddressChange(addr.addressId);
                      setSearchOpen(false);
                      setSearchQuery("");
                    }}
                    className={cn(
                      "flex w-full items-center justify-between px-3 py-2 text-left text-[12px] hover:bg-canvas-soft",
                      currentAddressId === addr.addressId
                        ? "font-semibold text-primary"
                        : "text-ink",
                    )}
                  >
                    <span className="truncate">{addressLabel(addr)}</span>
                    {addr.city && (
                      <span className="ml-2 shrink-0 text-[11px] text-ink-mute">{addr.city}</span>
                    )}
                  </button>
                ))}
                {filteredAddresses.length === 0 && (
                  <div className="px-3 py-2 text-[12px] text-ink-mute">Keine Treffer</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      {/* 3. Collapsible LLM trace logger */}
      {(suggestionPayload as any)._llmTrace && (
        <div className="rounded-md border border-hairline bg-canvas p-4 text-[13px]">
          <button
            type="button"
            onClick={() => setTraceOpen((v) => !v)}
            className="flex w-full items-center justify-between text-[11px] font-bold tracking-wider text-ink-mute uppercase transition-colors hover:text-ink"
          >
            <span>KI-Protokoll / LLM Trace</span>
            <ChevronDownIcon
              className={cn("size-3.5 transition-transform", traceOpen && "rotate-180")}
            />
          </button>

          {traceOpen && (
            <div className="mt-3 space-y-3 border-t border-hairline pt-3 font-mono text-[10px] text-ink-secondary">
              <div>
                <span className="font-bold text-ink">Modell:</span>{" "}
                <span className="rounded border border-hairline bg-canvas-soft px-1.5 py-0.5">
                  {(suggestionPayload as any)._llmTrace.model || "gemini-2.5-flash"}
                </span>
              </div>
              <div className="space-y-1">
                <span className="block font-bold text-ink">
                  Ausgehender Prompt (System & Catalogs):
                </span>
                <pre className="max-h-60 overflow-y-auto rounded-sm border border-hairline bg-canvas-soft p-2.5 font-mono leading-relaxed whitespace-pre-wrap text-emerald-700 select-all">
                  {(suggestionPayload as any)._llmTrace.prompt}
                </pre>
              </div>
              <div className="space-y-1">
                <span className="block font-bold text-ink">Eingehende Antwort (Raw JSON):</span>
                <pre className="max-h-60 overflow-y-auto rounded-sm border border-hairline bg-canvas-soft p-2.5 font-mono leading-relaxed font-medium whitespace-pre-wrap text-amber-700 select-all">
                  {(suggestionPayload as any)._llmTrace.response}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
