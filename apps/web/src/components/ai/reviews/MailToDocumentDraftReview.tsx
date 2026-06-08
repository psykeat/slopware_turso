import { cn } from "@repo/ui/lib/utils";
import { ArrowRightIcon, FileTextIcon } from "lucide-react";
import React from "react";

import { safeIdPrefix } from "./mail-review-labels";
import { AddressOption, MailClassificationReview } from "./MailClassificationReview";

/** Intentions for which we must NEVER show document actions */
const NO_DOC_INTENTIONS = new Set([
  "Sonstiges / unklar",
  "Reklamation",
  "Liefertermin-/Statusanfrage",
]);

export interface MailToDocumentDraftReviewProps {
  suggestionPayload: {
    businessIntention?: string;
    confidenceScore?: number;
    blockedReasons?: string[];
    steps: any[];
  };
  validation: any;
  onPatch: (patch: Partial<any>) => void;
}

export function MailToDocumentDraftReview({
  suggestionPayload,
  validation,
  onPatch,
}: MailToDocumentDraftReviewProps) {
  const rawSteps = suggestionPayload.steps || [];
  const steps = rawSteps.map((s: any, idx: number) => ({
    ...s,
    stepIndex: s.stepIndex ?? s.stepId ?? s.step ?? idx + 1,
    actionType: s.actionType || s.type || s.action,
    commandPayload: s.commandPayload || s.commandInput || s.parameters,
  }));
  const intention = suggestionPayload.businessIntention || "";
  const blockDocActions = NO_DOC_INTENTIONS.has(intention);

  // Find document draft command step
  const docStepIndex = steps.findIndex(
    (step: any) =>
      step.actionType === "EXECUTE_COMMAND" &&
      step.commandKey === "create-document-draft-from-ai-plan",
  );
  const docStep = docStepIndex !== -1 ? steps[docStepIndex] : null;
  const currentDocType = docStep?.commandPayload?.docType || "Offer";
  const lines = docStep?.commandPayload?.lines || [];

  // Find convert step (Quote → Order)
  const convertStep = steps.find(
    (step: any) =>
      step.actionType === "EXECUTE_COMMAND" && step.commandKey === "convert-document-from-ai-plan",
  );

  // Resolve source document display value from document LOOKUP step
  const docLookupStep = steps.find(
    (step: any) => step.actionType === "LOOKUP" && step.entityName === "document",
  );
  const sourceDocLabel =
    docLookupStep?.candidateMatches?.[0]?.displayValue ||
    docLookupStep?.lookupCriteria?.name ||
    docLookupStep?.lookupCriteria?.code ||
    "Angebot";

  const handleDocTypeChange = (newDocType: "Offer" | "Order") => {
    const updatedSteps = [...steps];
    if (docStepIndex !== -1) {
      updatedSteps[docStepIndex] = {
        ...updatedSteps[docStepIndex],
        commandPayload: {
          ...updatedSteps[docStepIndex].commandPayload,
          docType: newDocType,
        },
      };
    }
    onPatch({ steps: updatedSteps });
  };

  return (
    <div className="space-y-4">
      {/* Classification + partner section (re-used) */}
      <MailClassificationReview
        suggestionPayload={suggestionPayload}
        validation={validation}
        onPatch={onPatch}
      />

      {/* Conversion card: Quote → Order (takes priority over create-draft) */}
      {convertStep && !blockDocActions && (
        <div className="space-y-3 rounded-md border border-hairline bg-canvas p-4 text-[13px]">
          <div className="text-[11px] font-bold tracking-wider text-ink uppercase">
            2. Angebot → Auftrag umwandeln
          </div>
          <div className="text-[12px] text-ink-secondary">
            Die KI hat erkannt, dass ein bestehendes Angebot bestellt wurde:
          </div>
          <div className="flex items-center gap-3 rounded-sm border border-primary/20 bg-[color-mix(in_oklab,var(--primary)_5%,transparent)] px-3 py-2.5">
            <FileTextIcon className="size-4 shrink-0 text-primary/60" />
            <span className="font-mono font-semibold text-ink">{sourceDocLabel}</span>
            <ArrowRightIcon className="size-4 shrink-0 text-ink-mute" />
            <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
              Auftrag
            </span>
          </div>
          <div className="text-[11px] text-ink-mute">
            Nach dem Buchen wird ein neuer Auftrag aus dem Angebot erstellt und der Thread
            verknüpft.
          </div>
        </div>
      )}

      {/* Create-draft card: only when no conversion step and intention is not blocked */}
      {docStep && !convertStep && !blockDocActions && (
        <div className="space-y-3 rounded-md border border-hairline bg-canvas p-4 text-[13px]">
          <div className="text-[11px] font-bold tracking-wider text-ink uppercase">
            2. Belegentwurf vorschlagen
          </div>
          <div className="text-[12px] text-ink-secondary">
            Die KI schlägt vor, einen neuen Belegentwurf anzulegen:
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleDocTypeChange("Offer")}
              className={cn(
                "h-8 rounded-sm border text-[12px] transition-colors",
                currentDocType === "Offer"
                  ? "border-primary bg-[color-mix(in_oklab,var(--primary)_8%,transparent)] font-medium text-primary"
                  : "border-hairline text-ink-secondary hover:bg-canvas-soft",
              )}
            >
              Angebot (Offer)
            </button>
            <button
              type="button"
              onClick={() => handleDocTypeChange("Order")}
              className={cn(
                "h-8 rounded-sm border text-[12px] transition-colors",
                currentDocType === "Order"
                  ? "border-primary bg-[color-mix(in_oklab,var(--primary)_8%,transparent)] font-medium text-primary"
                  : "border-hairline text-ink-secondary hover:bg-canvas-soft",
              )}
            >
              Auftrag (Order)
            </button>
          </div>

          <div className="space-y-2 rounded-sm border border-hairline bg-canvas-soft p-3">
            <div className="text-[11px] font-semibold tracking-wider text-ink-mute uppercase">
              Extrahierte Positionen
            </div>
            <div className="divide-y divide-hairline">
              {lines.length === 0 ? (
                <div className="py-2 text-center text-[12px] text-ink-mute">
                  Keine Positionen extrahiert
                </div>
              ) : (
                lines.map((line: any, index: number) => (
                  <div
                    key={index}
                    className="flex justify-between py-2 text-[12px] first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="truncate font-semibold text-ink">
                        {line.articleName || line.articleNo || "Gesuchter Artikel"}
                      </div>
                      <div className="truncate font-mono text-[10px] text-ink-mute">
                        ID: {safeIdPrefix(line.articleId, "unbekannt")}
                      </div>
                    </div>
                    <div className="shrink-0 text-right font-mono font-medium text-ink-secondary">
                      {line.quantity} Stk.
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Soft notice when blocked */}
      {blockDocActions && (
        <div className="rounded-md border border-hairline bg-canvas-soft p-4 text-[12px] text-ink-mute">
          Für diese Absicht ist keine Beleganlegung vorgesehen. Der E-Mail-Thread wird klassifiziert
          und dem Kunden zugeordnet.
        </div>
      )}
    </div>
  );
}
