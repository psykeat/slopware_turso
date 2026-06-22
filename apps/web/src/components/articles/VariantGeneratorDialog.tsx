import { Button } from "@repo/ui/components/button";
import { Dialog, DialogContent } from "@repo/ui/components/dialog";
import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { cn } from "@repo/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CopyIcon,
  SaveIcon,
  SparklesIcon,
  WandIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { capability } from "#/server-fns/capabilities";

interface VariantTemplateSummary {
  templateId: string;
  slug: string;
  label: string;
  archived: boolean;
}

interface CombinationPlan {
  optionValues: Array<{ optionId: string; optionName: string; valueId: string; value: string }>;
  optionValueHash: string;
  status: "create" | "exists" | "excluded";
  excludedByRuleId?: string;
  excludedByRuleLabel?: string;
  sku?: string;
  price?: string | null;
}

interface PreviewResult {
  articleId: string;
  axes: Array<{
    optionId: string;
    optionName: string;
    values: Array<{ valueId: string; value: string }>;
  }>;
  combinations: CombinationPlan[];
  counts: { total: number; create: number; exists: number; excluded: number };
}

interface ArticleSearchRow {
  articleId: string;
  articleNo: string;
  name: string;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error((await res.text()) || `Request failed with status ${res.status}`);
  }
  return (await res.json()) as T;
}

function postJson<T>(url: string, body: unknown): Promise<T> {
  return fetchJson<T>(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const statusBadge: Record<CombinationPlan["status"], { label: string; className: string }> = {
  create: {
    label: "Neu",
    className: "border-emerald-300 bg-emerald-50 text-emerald-800",
  },
  exists: {
    label: "Vorhanden",
    className: "border-hairline bg-canvas-soft text-ink-mute",
  },
  excluded: {
    label: "Ausgeschlossen",
    className: "border-amber-300 bg-amber-50 text-amber-800",
  },
};

export function VariantGeneratorDialog({
  open,
  onOpenChange,
  articleId,
  onGenerated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  articleId: string;
  onGenerated: () => Promise<void> | void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sw-root max-w-4xl overflow-hidden p-0">
        {open && (
          <GeneratorDialogBody
            articleId={articleId}
            onOpenChange={onOpenChange}
            onGenerated={onGenerated}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// Mounted only while the dialog is open, so all wizard state starts fresh on
// every open without reset effects.
function GeneratorDialogBody({
  articleId,
  onOpenChange,
  onGenerated,
}: {
  articleId: string;
  onOpenChange: (open: boolean) => void;
  onGenerated: () => Promise<void> | void;
}) {
  const queryClient = useQueryClient();

  const [step, setStep] = useState<"source" | "preview">("source");
  const [source, setSource] = useState<"axes" | "template">("axes");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [copySearch, setCopySearch] = useState("");
  const [showCopySearch, setShowCopySearch] = useState(false);
  const [pendingSuggestion, setPendingSuggestion] = useState<{
    label: string;
    definition: unknown;
  } | null>(null);

  const { data: templates = [] } = useQuery<VariantTemplateSummary[]>({
    queryKey: ["variant-templates"],
    queryFn: async () => {
      const { items } = await capability("masterdata.articleVariantTemplate.list")({});
      return items as unknown as VariantTemplateSummary[];
    },
  });

  const { data: copyCandidates = [] } = useQuery<ArticleSearchRow[]>({
    queryKey: ["articles", "search", copySearch],
    queryFn: async () => {
      const { items } = await capability("masterdata.article.search")({
        q: copySearch,
        limit: 10,
      });
      return items as unknown as ArticleSearchRow[];
    },
    enabled: showCopySearch && copySearch.trim().length > 0,
  });

  const invalidateAxes = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["data", "articleOption", articleId] }),
      queryClient.invalidateQueries({ queryKey: ["data", "articleOptionValue"] }),
    ]);
  };

  const applyTemplateMutation = useMutation({
    mutationFn: () =>
      capability("masterdata.articleVariantTemplate.applyToArticle")({
        articleId,
        templateId: selectedTemplateId,
      }),
    onSuccess: async (result) => {
      await invalidateAxes();
      toast.success(
        `Vorlage angewendet: ${result.createdOptions} neue Achsen, ${result.createdValues} neue Werte`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyAxesMutation = useMutation({
    mutationFn: (sourceArticleId: string) =>
      capability("masterdata.articleVariant.copyVariantAxes")({
        targetArticleId: articleId,
        sourceArticleId,
      }),
    onSuccess: async (result) => {
      await invalidateAxes();
      setShowCopySearch(false);
      setCopySearch("");
      toast.success(
        `Achsen kopiert: ${result.createdOptions} neue Achsen, ${result.createdValues} neue Werte`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const suggestMutation = useMutation({
    mutationFn: () =>
      postJson<{
        matchedTemplateId?: string;
        suggestion?: { label: string; definition: unknown };
      }>("/api/ai/variant-template-suggest", { mode: "template", articleId }),
    onSuccess: (result) => {
      if (result.matchedTemplateId) {
        setSource("template");
        setSelectedTemplateId(result.matchedTemplateId);
        setPendingSuggestion(null);
        toast.success("Passende Vorlage gefunden und vorausgewählt");
        return;
      }
      if (result.suggestion) {
        setPendingSuggestion(result.suggestion);
        toast.success("KI-Vorschlag bereit — jetzt als Vorlage speichern oder verwerfen");
        return;
      }
      toast.info("Kein Vorschlag erhalten");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveSuggestionMutation = useMutation({
    mutationFn: async () => {
      if (!pendingSuggestion) throw new Error("No pending suggestion");
      const slugBase = pendingSuggestion.label
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      return capability("masterdata.articleVariantTemplate.create")({
        slug: `${slugBase || "vorlage"}-${crypto.randomUUID().slice(0, 6)}`,
        label: `${pendingSuggestion.label} (KI-Vorschlag)`,
        definition: pendingSuggestion.definition as never,
      }) as unknown as Promise<VariantTemplateSummary>;
    },
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["variant-templates"] });
      setSource("template");
      setSelectedTemplateId(created.templateId);
      setPendingSuggestion(null);
      toast.success("Vorlage gespeichert und vorausgewählt");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const previewMutation = useMutation({
    mutationFn: () =>
      capability("masterdata.articleVariant.previewVariants")({
        articleId,
        templateId: source === "template" && selectedTemplateId ? selectedTemplateId : undefined,
      }) as unknown as Promise<PreviewResult>,
    onSuccess: (result) => {
      setPreview(result);
      setStep("preview");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      capability("masterdata.articleVariant.generateVariants")({
        articleId,
        templateId: source === "template" && selectedTemplateId ? selectedTemplateId : undefined,
      }),
    onSuccess: async (result) => {
      await onGenerated();
      toast.success(
        `${result.createdVariants} Varianten erzeugt (${result.skippedVariants} vorhanden, ${result.excludedVariants} ausgeschlossen)`,
      );
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const combinationLabel = (plan: CombinationPlan) =>
    plan.optionValues.map((optionValue) => optionValue.value).join(" · ");

  const activeTemplates = useMemo(
    () => templates.filter((template) => !template.archived),
    [templates],
  );

  return (
    <div className="flex max-h-[80vh] flex-col">
      <div className="border-b border-hairline px-6 py-4">
        <h3 className="text-[15px] font-medium text-ink">Varianten erzeugen</h3>
        <p className="mt-0.5 text-[12px] text-ink-mute">
          {step === "source"
            ? "Schritt 1 von 2 · Quelle der Achsen und Werte wählen"
            : "Schritt 2 von 2 · Kombinationen prüfen und erzeugen"}
        </p>
      </div>

      {step === "source" ? (
        <div className="flex flex-col gap-5 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-2">
            <label
              aria-label="Aktuelle Achsen verwenden"
              className="flex cursor-pointer items-start gap-2.5"
            >
              <input
                type="radio"
                checked={source === "axes"}
                onChange={() => setSource("axes")}
                className="mt-0.5 size-4 accent-primary"
              />
              <span>
                <span className="block text-[13px] font-medium text-ink">
                  Aktuelle Achsen verwenden
                </span>
                <span className="block text-[12px] text-ink-mute">
                  Erzeugt Kombinationen aus den am Artikel gepflegten Optionen und Werten.
                </span>
              </span>
            </label>

            <label
              aria-label="Vorlage verwenden"
              className="flex cursor-pointer items-start gap-2.5"
            >
              <input
                type="radio"
                checked={source === "template"}
                onChange={() => setSource("template")}
                className="mt-0.5 size-4 accent-primary"
              />
              <span>
                <span className="block text-[13px] font-medium text-ink">Vorlage verwenden</span>
                <span className="block text-[12px] text-ink-mute">
                  Achsen, Ausschlussregeln, SKU-Muster und Aufpreise kommen aus einer
                  Variantenvorlage.
                </span>
              </span>
            </label>
          </div>

          {source === "template" && (
            <div className="flex flex-col gap-3 rounded-md border border-hairline p-4">
              <div className="flex items-end gap-2">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label>Vorlage</Label>
                  <Select
                    value={selectedTemplateId || undefined}
                    onValueChange={(v) => v && setSelectedTemplateId(v)}
                  >
                    <SelectTrigger className="h-8 text-[13px]">
                      <SelectValue placeholder="Vorlage wählen…" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeTemplates.map((template) => (
                        <SelectItem key={template.templateId} value={template.templateId}>
                          {template.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!selectedTemplateId || applyTemplateMutation.isPending}
                  onClick={() => applyTemplateMutation.mutate()}
                >
                  <WandIcon className="mr-1.5 size-3.5" />
                  {applyTemplateMutation.isPending ? "Wird angewendet…" : "Vorlage anwenden"}
                </Button>
              </div>
              <p className="text-[11px] text-ink-mute">
                „Anwenden" ergänzt fehlende Achsen/Werte am Artikel (bestehende bleiben erhalten).
                Die Vorschau nutzt zusätzlich Regeln und SKU-Muster der Vorlage.
              </p>
              {activeTemplates.length === 0 && (
                <p className="text-[12px] text-amber-700">
                  Keine Vorlagen vorhanden — unter Einstellungen → Variantenvorlagen anlegen.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowCopySearch((v) => !v)}>
              <CopyIcon className="mr-1.5 size-3.5" />
              Achsen von Artikel kopieren
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={suggestMutation.isPending}
              onClick={() => suggestMutation.mutate()}
            >
              <SparklesIcon className="mr-1.5 size-3.5" />
              {suggestMutation.isPending ? "KI denkt nach…" : "Passende Vorlage vorschlagen"}
            </Button>
          </div>

          {pendingSuggestion && (
            <div className="flex flex-col gap-3 rounded-md border border-amber-300 bg-amber-50 p-4">
              <div>
                <p className="text-[12px] font-medium text-amber-800">
                  KI-Vorschlag — noch nicht gespeichert
                </p>
                <p className="mt-0.5 text-[12px] text-amber-700">{pendingSuggestion.label}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={saveSuggestionMutation.isPending}
                  onClick={() => saveSuggestionMutation.mutate()}
                >
                  <SaveIcon className="mr-1.5 size-3.5" />
                  {saveSuggestionMutation.isPending ? "Wird gespeichert…" : "Als Vorlage speichern"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPendingSuggestion(null)}>
                  Verwerfen
                </Button>
              </div>
            </div>
          )}

          {showCopySearch && (
            <div className="flex flex-col gap-2 rounded-md border border-hairline p-4">
              <Label>Quellartikel suchen</Label>
              <input
                type="text"
                value={copySearch}
                onChange={(e) => setCopySearch(e.target.value)}
                placeholder="Artikelnummer oder Name…"
                className="h-8 rounded border border-hairline bg-canvas px-2.5 text-[13px] focus:border-primary focus:outline-none"
              />
              <div className="flex max-h-40 flex-col overflow-y-auto">
                {copyCandidates
                  .filter((candidate) => candidate.articleId !== articleId)
                  .map((candidate) => (
                    <button
                      key={candidate.articleId}
                      disabled={copyAxesMutation.isPending}
                      onClick={() => copyAxesMutation.mutate(candidate.articleId)}
                      className="flex items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] text-ink-secondary transition-colors hover:bg-canvas-soft hover:text-ink"
                    >
                      <span className="font-mono text-[12px] text-ink-mute">
                        {candidate.articleNo}
                      </span>
                      <span className="truncate">{candidate.name}</span>
                    </button>
                  ))}
                {copySearch.trim().length > 0 && copyCandidates.length === 0 && (
                  <span className="px-2 py-2 text-[12px] text-ink-mute">Keine Treffer.</span>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-col gap-3 overflow-hidden px-6 py-5">
          {preview && (
            <>
              <div className="flex items-center gap-3 text-[13px]">
                <span className="text-ink">{preview.counts.create} neu</span>
                <span className="text-ink-mute">·</span>
                <span className="text-ink-mute">{preview.counts.exists} vorhanden</span>
                <span className="text-ink-mute">·</span>
                <span className="text-amber-700">{preview.counts.excluded} ausgeschlossen</span>
              </div>

              <div className="min-h-0 flex-1 overflow-auto rounded-md border border-hairline">
                <table className="w-full border-collapse text-[12px]">
                  <thead className="sticky top-0 bg-canvas-soft">
                    <tr className="border-b border-hairline text-left text-[10px] font-medium tracking-wider text-ink-mute uppercase">
                      <th className="px-3 py-2">Kombination</th>
                      <th className="px-3 py-2">SKU</th>
                      <th className="px-3 py-2 text-right">Preis</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.combinations.map((plan) => (
                      <tr
                        key={plan.optionValueHash}
                        className={cn(
                          "border-b border-hairline last:border-0",
                          plan.status === "excluded" && "opacity-70",
                        )}
                      >
                        <td className="px-3 py-1.5 text-ink">{combinationLabel(plan)}</td>
                        <td className="px-3 py-1.5 font-mono text-ink-secondary">
                          {plan.sku ?? "—"}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-ink-secondary tabular-nums">
                          {plan.price != null ? Number(plan.price).toFixed(2) : "—"}
                        </td>
                        <td className="px-3 py-1.5">
                          <span
                            title={plan.excludedByRuleLabel ?? plan.excludedByRuleId}
                            className={cn(
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                              statusBadge[plan.status].className,
                            )}
                          >
                            {statusBadge[plan.status].label}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {preview.combinations.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-ink-mute">
                          Keine Kombinationen — erst Achsen und Werte pflegen (oder eine Vorlage
                          anwenden).
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-hairline px-6 py-4">
        {step === "preview" ? (
          <Button variant="outline" size="sm" onClick={() => setStep("source")}>
            <ArrowLeftIcon className="mr-1.5 size-3.5" />
            Zurück
          </Button>
        ) : (
          <span />
        )}

        {step === "source" ? (
          <Button
            size="sm"
            disabled={previewMutation.isPending || (source === "template" && !selectedTemplateId)}
            onClick={() => previewMutation.mutate()}
          >
            {previewMutation.isPending ? "Berechne…" : "Weiter zur Vorschau"}
            <ArrowRightIcon className="ml-1.5 size-3.5" />
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={generateMutation.isPending || (preview?.counts.create ?? 0) === 0}
            onClick={() => generateMutation.mutate()}
          >
            {generateMutation.isPending
              ? "Erzeuge…"
              : `${preview?.counts.create ?? 0} Varianten erzeugen`}
          </Button>
        )}
      </div>
    </div>
  );
}
