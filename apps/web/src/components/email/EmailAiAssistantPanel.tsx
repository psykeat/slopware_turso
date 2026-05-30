import { cn } from "@repo/ui/lib/utils";
import { RefreshCcwIcon, SparklesIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type EmailMessage = {
  fromJson: { email?: string; name?: string } | Record<string, unknown>;
  toJson: Array<{ email: string; name?: string | null }>;
  subject: string | null;
  bodyHtml: string | null;
  bodyText: string | null;
};

type EmailThreadDetail = {
  emailThreadId: string;
  subject: string | null;
  messages: EmailMessage[];
};

type AddressOption = {
  addressId: string;
  name?: string | null;
  city?: string | null;
};

export function EmailAiAssistantPanel({
  selectedThreadId,
  threadDetail,
  allAddresses,
  onApplied,
  onClose,
}: {
  selectedThreadId: string;
  threadDetail: EmailThreadDetail | null | undefined;
  allAddresses: AddressOption[];
  onApplied: () => void;
  onClose: () => void;
}) {
  const [requestToken, setRequestToken] = useState(0);
  const [isPlanning, setIsPlanning] = useState(false);
  const [planResult, setPlanResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [selectedDocType, setSelectedDocType] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchAiPlan = async () => {
      setPlanResult(null);
      setError(null);
      setSelectedAddressId(null);
      setSelectedDocType(null);
      setIsPlanning(true);

      try {
        if (!threadDetail) throw new Error("Kein Thread geladen");
        const threadText = `Subject: ${threadDetail.subject || "(no subject)"}
Messages:
${threadDetail.messages
  .map(
    (message) => `From: ${fromJsonToPerson(message.fromJson)}
To: ${parsePeople(message.toJson)}
Body: ${message.bodyText || htmlToText(message.bodyHtml || "")}`,
  )
  .join("\n---\n")}`;

        const rawInput = JSON.stringify({
          emailThreadId: threadDetail.emailThreadId,
          content: threadText,
        });

        const res = await fetch("/api/ai/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskScope: ["mail-classification", "mail-to-document-draft"],
            rawInput,
          }),
        });

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(errorText || "Fehler bei der KI-Analyse");
        }

        const planData = await res.json();
        if (cancelled) return;
        setPlanResult(planData);

        const steps = planData?.planJson?.steps || [];
        const lookupStep = steps.find(
          (step: any) => step.actionType === "LOOKUP" && step.entityName === "address",
        );
        const bestMatch = lookupStep?.candidateMatches?.[0]?.id;
        if (bestMatch) setSelectedAddressId(bestMatch);

        const commandStep = steps.find(
          (step: any) =>
            step.actionType === "EXECUTE_COMMAND" &&
            step.commandKey === "create-document-draft-from-ai-plan",
        );
        if (commandStep) setSelectedDocType(commandStep.commandPayload?.docType || "Offer");
      } catch (err: any) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setIsPlanning(false);
      }
    };

    void fetchAiPlan();

    return () => {
      cancelled = true;
    };
  }, [requestToken, threadDetail]);

  const applyPlan = async () => {
    if (!planResult) return;
    setIsApplying(true);
    try {
      const lookupIndex =
        planResult.planJson.steps.findIndex(
          (step: any) => step.actionType === "LOOKUP" && step.entityName === "address",
        ) + 1;
      const overrideSteps = planResult.planJson.steps.map((step: any) => {
        if (step.actionType === "LOOKUP" && step.entityName === "address") {
          return {
            ...step,
            selectedMatchId: selectedAddressId || undefined,
          };
        }
        if (
          step.actionType === "EXECUTE_COMMAND" &&
          step.commandKey === "create-document-draft-from-ai-plan"
        ) {
          return {
            ...step,
            commandPayload: {
              ...step.commandPayload,
              docType: selectedDocType || step.commandPayload.docType,
              customerId: selectedAddressId
                ? `dependency:${lookupIndex}`
                : step.commandPayload.customerId,
            },
          };
        }
        if (
          step.actionType === "EXECUTE_COMMAND" &&
          step.commandKey === "apply-ai-mail-classification"
        ) {
          return {
            ...step,
            commandPayload: {
              ...step.commandPayload,
              emailThreadId: step.commandPayload.emailThreadId || selectedThreadId,
              relatedAddressId: selectedAddressId || undefined,
              relatedDocumentId: step.commandPayload.relatedDocumentId || undefined,
            },
          };
        }
        return step;
      });

      const res = await fetch(`/api/ai/plans/${planResult.planId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userOverrides: { steps: overrideSteps },
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Fehler beim Ausführen der Aktionen");
      }

      const applyResult = await res.json();
      if (applyResult.status === "failed") {
        throw new Error(applyResult.errorLogs || "Fehler beim Ausführen");
      }

      toast.success("KI-Plan erfolgreich gebucht!");
      onApplied();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
      {isPlanning && (
        <div className="flex h-64 flex-col items-center justify-center gap-3">
          <RefreshCcwIcon className="size-6 animate-spin text-primary" />
          <span className="text-[13px] text-ink-mute">E-Mail wird analysiert...</span>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/20 bg-[color-mix(in_oklab,var(--destructive)_8%,transparent)] p-4 text-[13px]">
          <div className="font-semibold text-ink">Analyse fehlgeschlagen</div>
          <div className="mt-1 text-ink-secondary">{error}</div>
          <button
            onClick={() => setRequestToken((value) => value + 1)}
            className="mt-3 rounded-sm bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-fg hover:opacity-90"
          >
            Erneut versuchen
          </button>
        </div>
      )}

      {planResult && (
        <div className="space-y-4 text-[13px]">
          <div className="space-y-3 rounded-md border border-hairline bg-canvas-soft p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-wider text-ink-mute uppercase">
                Erkannte Absicht
              </span>
              <span
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                  (planResult.planJson.businessIntention || "").startsWith("Bestellung")
                    ? "border-primary/20 bg-[color-mix(in_oklab,var(--primary)_8%,transparent)] text-primary"
                    : (planResult.planJson.businessIntention || "").startsWith("Angebotsanfrage")
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : (planResult.planJson.businessIntention || "").startsWith("Reklamation")
                        ? "border-red-200 bg-red-50 text-red-800"
                        : "border-gray-200 bg-gray-50 text-gray-800",
                )}
              >
                {planResult.planJson.businessIntention || "Unklar"}
              </span>
            </div>

            <div className="flex items-center justify-between text-[12px] text-ink-secondary">
              <span>Wahrscheinlichkeit:</span>
              <span className="font-mono font-medium">
                {Math.round(parseFloat(planResult.planJson.confidenceScore ?? "1") * 100)}%
              </span>
            </div>

            {planResult.planJson.blockedReasons?.length > 0 && (
              <div className="rounded-sm border border-red-200 bg-red-50 p-2.5 text-[12px] text-red-800">
                <div className="mb-0.5 font-semibold">Blockierende Fehler:</div>
                <ul className="list-disc space-y-0.5 pl-4">
                  {planResult.planJson.blockedReasons.map((reason: string, index: number) => (
                    <li key={index}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}

            {planResult.validation?.warnings?.length > 0 && (
              <div className="rounded-sm border border-amber-200 bg-amber-50 p-2.5 text-[12px] text-amber-800">
                <div className="mb-0.5 font-semibold">Hinweise / Warnungen:</div>
                <ul className="list-disc space-y-0.5 pl-4">
                  {planResult.validation.warnings.map((warning: string, index: number) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-md border border-hairline bg-canvas p-4">
            <div className="text-[11px] font-bold tracking-wider text-ink uppercase">
              1. Geschäftspartner zuordnen
            </div>
            <div className="text-[12px] text-ink-secondary">
              Wählen Sie den zuzuordnenden Kunden / Partner aus:
            </div>
            <select
              value={selectedAddressId || ""}
              onChange={(event) => setSelectedAddressId(event.target.value || null)}
              className="h-9 w-full rounded-sm border border-hairline bg-canvas px-2 text-[13px] text-ink outline-none focus:border-primary"
            >
              <option value="">-- Nicht zugeordnet / Unbekannt --</option>
              {allAddresses.map((address) => (
                <option key={address.addressId} value={address.addressId}>
                  {address.name} {address.city ? `(${address.city})` : ""}
                </option>
              ))}
            </select>
          </div>

          {planResult.planJson.steps.some(
            (step: any) => step.commandKey === "create-document-draft-from-ai-plan",
          ) && (
            <div className="space-y-3 rounded-md border border-hairline bg-canvas p-4">
              <div className="text-[11px] font-bold tracking-wider text-ink uppercase">
                2. Belegentwurf vorschlagen
              </div>
              <div className="text-[12px] text-ink-secondary">
                Die KI schlägt vor, einen neuen Belegentwurf anzulegen:
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDocType("Offer")}
                  className={cn(
                    "h-8 rounded-sm border text-[12px] transition-colors",
                    selectedDocType === "Offer"
                      ? "border-primary bg-[color-mix(in_oklab,var(--primary)_8%,transparent)] font-medium text-primary"
                      : "border-hairline text-ink-secondary hover:bg-canvas-soft",
                  )}
                >
                  Angebot (Offer)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDocType("Order")}
                  className={cn(
                    "h-8 rounded-sm border text-[12px] transition-colors",
                    selectedDocType === "Order"
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
                  {planResult.planJson.steps
                    .find((step: any) => step.commandKey === "create-document-draft-from-ai-plan")
                    ?.commandPayload?.lines?.map((line: any, index: number) => (
                      <div
                        key={index}
                        className="flex justify-between py-2 text-[12px] first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="truncate font-semibold text-ink">
                            {line.articleName || line.articleNo || "Gesuchter Artikel"}
                          </div>
                          <div className="truncate font-mono text-[10px] text-ink-mute">
                            ID: {line.articleId ? line.articleId.slice(0, 8) : "unbekannt"}
                          </div>
                        </div>
                        <div className="shrink-0 text-right font-mono font-medium text-ink-secondary">
                          {line.quantity} Stk.
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 border-t border-hairline pt-4">
            <button
              onClick={applyPlan}
              disabled={isApplying || planResult.planJson.applyReadiness === "blocked"}
              className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-sm bg-primary text-[12px] font-medium text-primary-fg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isApplying ? (
                <>
                  <RefreshCcwIcon className="size-4 animate-spin" />
                  <span>Wird gebucht...</span>
                </>
              ) : (
                <>
                  <SparklesIcon className="size-4" />
                  <span>Aktionen buchen</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="h-9 rounded-sm border border-hairline px-3 text-[12px] text-ink-secondary hover:bg-canvas-soft"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function htmlToText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function parsePeople(value: Array<{ email: string; name?: string | null }> | undefined | null) {
  return (value ?? [])
    .map((item) => item.email.trim())
    .filter(Boolean)
    .join(", ");
}

function fromJsonToPerson(
  value: Record<string, unknown> | { email?: string; name?: string } | undefined,
) {
  if (!value || typeof value !== "object") return "Unknown sender";
  const email = typeof value.email === "string" ? value.email : "";
  const name = typeof value.name === "string" ? value.name : "";
  return (
    [name, email].filter(Boolean).join(" <") + (name && email ? ">" : "") ||
    email ||
    "Unknown sender"
  );
}
