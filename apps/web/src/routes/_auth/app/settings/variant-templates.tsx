import {
  DEFAULT_SKU_PATTERN,
  parseVariantTemplateDefinition,
  renderSkuPatternPreview,
  type VariantTemplateDefinition,
} from "@repo/db/services/variant-template-schema";
import { Button } from "@repo/ui/components/button";
import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { cn } from "@repo/ui/lib/utils";
import { useActionBar } from "@repo/ui/platform/action-bar-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CopyIcon,
  DownloadIcon,
  PlusIcon,
  SaveIcon,
  SparklesIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_auth/app/settings/variant-templates")({
  component: VariantTemplatesPage,
});

// ── Types ──────────────────────────────────────────────────────────────────
interface VariantTemplateRecord {
  templateId: string;
  slug: string;
  label: string;
  articleGroupId: string | null;
  definition: VariantTemplateDefinition;
  archived: boolean;
}

interface DraftValue {
  _localId: string;
  value: string;
  skuCode: string;
  priceSurcharge: string;
  weightDelta: string;
}

interface DraftAxis {
  _localId: string;
  name: string;
  values: DraftValue[];
}

interface DraftRule {
  _localId: string;
  id: string;
  label: string;
  whenAxis: string;
  whenValue: string;
  excludeAxis: string;
  excludeValues: string[];
}

interface Draft {
  productTypeLabel: string;
  axes: DraftAxis[];
  rules: DraftRule[];
  skuPattern: string;
  priceMode: "inherit" | "surchargeOnBase";
  weightMode: "inherit" | "deltaOnBase";
}

const localId = () => crypto.randomUUID();

const emptyDraft = (): Draft => ({
  productTypeLabel: "",
  axes: [],
  rules: [],
  skuPattern: DEFAULT_SKU_PATTERN,
  priceMode: "inherit",
  weightMode: "inherit",
});

function draftFromDefinition(definition: VariantTemplateDefinition): Draft {
  const axes = [...definition.axes]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((axis) => ({
      _localId: localId(),
      name: axis.name,
      values: [...axis.values]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((value) => ({
          _localId: localId(),
          value: value.value,
          skuCode: value.skuCode ?? "",
          priceSurcharge: value.priceSurcharge != null ? String(value.priceSurcharge) : "",
          weightDelta: value.weightDelta != null ? String(value.weightDelta) : "",
        })),
    }));

  const rules = (definition.exclusions ?? []).map((rule) => ({
    _localId: localId(),
    id: rule.id,
    label: rule.label ?? "",
    whenAxis: rule.when.axis,
    whenValue: rule.when.value,
    excludeAxis: rule.exclude.axis,
    excludeValues: rule.exclude.values,
  }));

  return {
    productTypeLabel: definition.productTypeLabel,
    axes,
    rules,
    skuPattern: definition.skuPattern ?? DEFAULT_SKU_PATTERN,
    priceMode: definition.defaults?.priceMode ?? "inherit",
    weightMode: definition.defaults?.weightMode ?? "inherit",
  };
}

function definitionFromDraft(draft: Draft): VariantTemplateDefinition {
  const parseNumber = (value: string): number | undefined => {
    const trimmed = value.trim().replace(",", ".");
    if (trimmed.length === 0) return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  return {
    version: 1,
    productTypeLabel: draft.productTypeLabel,
    axes: draft.axes.map((axis, axisIndex) => ({
      name: axis.name,
      sortOrder: axisIndex,
      values: axis.values.map((value, valueIndex) => ({
        value: value.value,
        sortOrder: valueIndex,
        ...(value.skuCode.trim() ? { skuCode: value.skuCode.trim() } : {}),
        ...(parseNumber(value.priceSurcharge) != null
          ? { priceSurcharge: parseNumber(value.priceSurcharge) }
          : {}),
        ...(parseNumber(value.weightDelta) != null
          ? { weightDelta: parseNumber(value.weightDelta) }
          : {}),
      })),
    })),
    skuPattern: draft.skuPattern.trim() || DEFAULT_SKU_PATTERN,
    exclusions: draft.rules.map((rule) => ({
      id: rule.id,
      ...(rule.label.trim() ? { label: rule.label.trim() } : {}),
      when: { axis: rule.whenAxis, value: rule.whenValue },
      exclude: { axis: rule.excludeAxis, values: rule.excludeValues },
    })),
    defaults: { priceMode: draft.priceMode, weightMode: draft.weightMode },
  };
}

const inputClass =
  "h-8 rounded border border-hairline bg-canvas px-2.5 text-[13px] focus:border-primary focus:outline-none";
const gridInputClass =
  "h-7 w-full rounded border border-transparent bg-transparent px-1.5 text-[12px] hover:border-hairline focus:border-primary focus:outline-none";

// ── Page ───────────────────────────────────────────────────────────────────
function VariantTemplatesView() {
  const { setSubCrumb } = useActionBar();
  const queryClient = useQueryClient();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [formLabel, setFormLabel] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formArticleGroupId, setFormArticleGroupId] = useState("");
  const [formArchived, setFormArchived] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [selectedAxisId, setSelectedAxisId] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [importText, setImportText] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [aiInput, setAiInput] = useState("");

  useEffect(() => () => setSubCrumb(undefined), [setSubCrumb]);

  const { data: templates = [], isLoading: isTemplatesLoading } = useQuery<
    VariantTemplateRecord[]
  >({
    queryKey: ["variant-templates"],
    queryFn: async () => {
      const res = await fetch("/api/variant-templates?includeArchived=true");
      return res.ok ? res.json() : [];
    },
  });

  const { data: articleGroups = [] } = useQuery<any[]>({
    queryKey: ["data", "articleGroup"],
    queryFn: async () => {
      const res = await fetch("/api/data/articleGroup");
      return res.ok ? res.json() : [];
    },
  });

  const loadTemplate = (template: VariantTemplateRecord) => {
    setSelectedTemplateId(template.templateId);
    setIsCreating(false);
    setFormLabel(template.label);
    setFormSlug(template.slug);
    setFormArticleGroupId(template.articleGroupId ?? "");
    setFormArchived(template.archived);
    const nextDraft = draftFromDefinition(template.definition);
    setDraft(nextDraft);
    setSelectedAxisId(nextDraft.axes[0]?._localId ?? null);
    setValidationErrors([]);
    setShowImport(false);
    setSubCrumb(template.label);
  };

  const startCreate = () => {
    setSelectedTemplateId(null);
    setIsCreating(true);
    setFormLabel("");
    setFormSlug("");
    setFormArticleGroupId("");
    setFormArchived(false);
    setDraft(emptyDraft());
    setSelectedAxisId(null);
    setValidationErrors([]);
    setShowImport(false);
    setSubCrumb("Neue Vorlage");
  };

  const buildPayload = () => {
    const definition = definitionFromDraft({
      ...draft,
      productTypeLabel: draft.productTypeLabel.trim() || formLabel.trim(),
    });
    const parsed = parseVariantTemplateDefinition(definition);
    if (!parsed.ok) {
      setValidationErrors(parsed.errors);
      return null;
    }
    setValidationErrors([]);
    return {
      slug: formSlug.trim(),
      label: formLabel.trim(),
      articleGroupId: formArticleGroupId || null,
      definition: parsed.definition,
    };
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = buildPayload();
      if (!payload) throw new Error("Vorlage ist unvollständig");
      const res = await fetch("/api/variant-templates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<VariantTemplateRecord>;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["variant-templates"] });
      loadTemplate(created);
      toast.success("Vorlage angelegt");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const payload = buildPayload();
      if (!payload) throw new Error("Vorlage ist unvollständig");
      const res = await fetch(`/api/variant-templates/${selectedTemplateId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, archived: formArchived }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<VariantTemplateRecord>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["variant-templates"] });
      toast.success("Vorlage gespeichert");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const suggestMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ai/variant-template-suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "template", name: aiInput.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{
        matchedTemplateId?: string;
        suggestion?: { label: string; definition: VariantTemplateDefinition };
      }>;
    },
    onSuccess: (result) => {
      if (result.matchedTemplateId) {
        const matched = templates.find((t) => t.templateId === result.matchedTemplateId);
        if (matched) {
          loadTemplate(matched);
          toast.success(`Vorhandene Vorlage „${matched.label}" passt — geladen`);
          return;
        }
      }
      if (result.suggestion) {
        const nextDraft = draftFromDefinition(result.suggestion.definition);
        setDraft(nextDraft);
        setSelectedAxisId(nextDraft.axes[0]?._localId ?? null);
        if (!formLabel.trim()) setFormLabel(result.suggestion.label);
        setValidationErrors([]);
        toast.success("KI-Vorschlag geladen — noch nicht gespeichert");
        return;
      }
      toast.info("Kein Vorschlag erhalten");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const normalizeMutation = useMutation({
    mutationFn: async (axisId: string) => {
      const axis = draft.axes.find((candidate) => candidate._localId === axisId);
      const values = (axis?.values ?? [])
        .map((value) => value.value.trim())
        .filter((value) => value.length > 0);
      if (values.length === 0) throw new Error("Keine Werte zum Normalisieren");

      const res = await fetch("/api/ai/variant-template-suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "normalizeValues", values, name: axis?.name ?? "" }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { mappings: Array<{ from: string; to: string }> };
      return { axisId, mappings: data.mappings };
    },
    onSuccess: ({ axisId, mappings }) => {
      const changed = mappings.filter((mapping) => mapping.from !== mapping.to);
      if (changed.length === 0) {
        toast.info("Alle Werte sind bereits sauber");
        return;
      }
      const mappingByFrom = new Map(changed.map((mapping) => [mapping.from, mapping.to]));
      setDraft((d) => ({
        ...d,
        axes: d.axes.map((axis) =>
          axis._localId === axisId
            ? {
                ...axis,
                values: axis.values.map((value) => ({
                  ...value,
                  value: mappingByFrom.get(value.value.trim()) ?? value.value,
                })),
              }
            : axis,
        ),
      }));
      toast.success(`${changed.length} Wert${changed.length === 1 ? "" : "e"} normalisiert`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Draft helpers ──────────────────────────────────────────────────────
  const selectedAxis = draft.axes.find((axis) => axis._localId === selectedAxisId) ?? null;

  const updateAxis = (axisId: string, patch: Partial<Omit<DraftAxis, "_localId" | "values">>) => {
    setDraft((d) => ({
      ...d,
      axes: d.axes.map((axis) => (axis._localId === axisId ? { ...axis, ...patch } : axis)),
    }));
  };

  const addAxis = () => {
    const axis: DraftAxis = { _localId: localId(), name: "", values: [] };
    setDraft((d) => ({ ...d, axes: [...d.axes, axis] }));
    setSelectedAxisId(axis._localId);
  };

  const removeAxis = (axisId: string) => {
    setDraft((d) => ({ ...d, axes: d.axes.filter((axis) => axis._localId !== axisId) }));
    if (selectedAxisId === axisId) setSelectedAxisId(null);
  };

  const moveAxis = (axisId: string, delta: -1 | 1) => {
    setDraft((d) => {
      const index = d.axes.findIndex((axis) => axis._localId === axisId);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= d.axes.length) return d;
      const axes = [...d.axes];
      const [moved] = axes.splice(index, 1);
      axes.splice(target, 0, moved);
      return { ...d, axes };
    });
  };

  const updateValue = (axisId: string, valueId: string, patch: Partial<Omit<DraftValue, "_localId">>) => {
    setDraft((d) => ({
      ...d,
      axes: d.axes.map((axis) =>
        axis._localId === axisId
          ? {
              ...axis,
              values: axis.values.map((value) =>
                value._localId === valueId ? { ...value, ...patch } : value,
              ),
            }
          : axis,
      ),
    }));
  };

  const addValue = (axisId: string) => {
    setDraft((d) => ({
      ...d,
      axes: d.axes.map((axis) =>
        axis._localId === axisId
          ? {
              ...axis,
              values: [
                ...axis.values,
                { _localId: localId(), value: "", skuCode: "", priceSurcharge: "", weightDelta: "" },
              ],
            }
          : axis,
      ),
    }));
  };

  const removeValue = (axisId: string, valueId: string) => {
    setDraft((d) => ({
      ...d,
      axes: d.axes.map((axis) =>
        axis._localId === axisId
          ? { ...axis, values: axis.values.filter((value) => value._localId !== valueId) }
          : axis,
      ),
    }));
  };

  const moveValue = (axisId: string, valueId: string, delta: -1 | 1) => {
    setDraft((d) => ({
      ...d,
      axes: d.axes.map((axis) => {
        if (axis._localId !== axisId) return axis;
        const index = axis.values.findIndex((value) => value._localId === valueId);
        const target = index + delta;
        if (index < 0 || target < 0 || target >= axis.values.length) return axis;
        const values = [...axis.values];
        const [moved] = values.splice(index, 1);
        values.splice(target, 0, moved);
        return { ...axis, values };
      }),
    }));
  };

  const addRule = () => {
    setDraft((d) => ({
      ...d,
      rules: [
        ...d.rules,
        {
          _localId: localId(),
          id: localId().slice(0, 8),
          label: "",
          whenAxis: d.axes[0]?.name ?? "",
          whenValue: "",
          excludeAxis: d.axes[1]?.name ?? d.axes[0]?.name ?? "",
          excludeValues: [],
        },
      ],
    }));
  };

  const updateRule = (ruleId: string, patch: Partial<Omit<DraftRule, "_localId">>) => {
    setDraft((d) => ({
      ...d,
      rules: d.rules.map((rule) => (rule._localId === ruleId ? { ...rule, ...patch } : rule)),
    }));
  };

  const removeRule = (ruleId: string) => {
    setDraft((d) => ({ ...d, rules: d.rules.filter((rule) => rule._localId !== ruleId) }));
  };

  const axisValues = (axisName: string) =>
    draft.axes.find((axis) => axis.name === axisName)?.values ?? [];

  // ── JSON import/export ─────────────────────────────────────────────────
  const currentDefinition = useMemo(
    () =>
      definitionFromDraft({
        ...draft,
        productTypeLabel: draft.productTypeLabel.trim() || formLabel.trim(),
      }),
    [draft, formLabel],
  );

  const exportJson = JSON.stringify(currentDefinition, null, 2);

  const handleCopyJson = async () => {
    await navigator.clipboard.writeText(exportJson);
    toast.success("JSON kopiert");
  };

  const handleDownloadJson = () => {
    const blob = new Blob([exportJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `variantenvorlage-${formSlug || "neu"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = () => {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(importText);
    } catch {
      setValidationErrors(["Ungültiges JSON"]);
      return;
    }

    const parsed = parseVariantTemplateDefinition(parsedJson);
    if (!parsed.ok) {
      setValidationErrors(parsed.errors);
      return;
    }

    const nextDraft = draftFromDefinition(parsed.definition);
    setDraft(nextDraft);
    setSelectedAxisId(nextDraft.axes[0]?._localId ?? null);
    setValidationErrors([]);
    setShowImport(false);
    setImportText("");
    toast.success("Vorlage aus JSON geladen");
  };

  // ── SKU preview ────────────────────────────────────────────────────────
  const skuPreview = useMemo(() => {
    const sampleValues = draft.axes
      .filter((axis) => axis.values.length > 0)
      .map((axis) => ({
        axisName: axis.name,
        value: axis.values[0].value,
        skuCode: axis.values[0].skuCode || undefined,
      }));
    return renderSkuPatternPreview(draft.skuPattern || DEFAULT_SKU_PATTERN, {
      articleNo: "A1000",
      hash: "0123456789abcdef0123456789abcdef",
      axisValues: sampleValues,
    });
  }, [draft.axes, draft.skuPattern]);

  // ── Render ─────────────────────────────────────────────────────────────
  const showPanel = isCreating || selectedTemplateId !== null;
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* ── Left: Template list ── */}
      <div className="flex w-60 shrink-0 flex-col overflow-hidden border-r border-hairline bg-canvas-soft">
        <div className="flex h-8 shrink-0 items-center justify-between border-b border-hairline px-3">
          <span className="text-[11px] font-medium tracking-wider text-ink-mute uppercase">
            Variantenvorlagen
          </span>
          <button
            onClick={startCreate}
            className="flex size-5 items-center justify-center rounded text-ink-mute transition-colors hover:bg-canvas-soft hover:text-ink"
            title="Neue Vorlage"
          >
            <PlusIcon className="size-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {isTemplatesLoading ? (
            <div className="px-3 py-4 text-[12px] text-ink-mute">Lädt…</div>
          ) : templates.length === 0 ? (
            <div className="px-3 py-4 text-[12px] text-ink-mute">Noch keine Vorlagen.</div>
          ) : (
            templates.map((template) => {
              const isActive = template.templateId === selectedTemplateId;
              return (
                <button
                  key={template.templateId}
                  onClick={() => loadTemplate(template)}
                  className={cn(
                    "flex h-auto w-full cursor-pointer flex-col items-start px-3 py-2 text-left transition-colors",
                    isActive
                      ? "bg-primary text-primary-fg"
                      : "text-ink-secondary hover:bg-canvas hover:text-ink",
                    template.archived && !isActive && "opacity-50",
                  )}
                >
                  <span className="w-full truncate text-[13px]">
                    {template.label}
                    {template.archived ? " (archiviert)" : ""}
                  </span>
                  <span
                    className={cn(
                      "font-mono text-[10px]",
                      isActive ? "text-primary-fg/70" : "text-ink-mute",
                    )}
                  >
                    {template.slug}
                  </span>
                </button>
              );
            })
          )}

          {isCreating && (
            <div className="border-l-2 border-primary bg-[color-mix(in_oklab,var(--primary)_8%,var(--canvas))] px-3 py-2 text-[13px] text-ink">
              Neue Vorlage…
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Editor ── */}
      {showPanel ? (
        <div className="min-w-0 flex-1 overflow-y-auto bg-canvas">
          <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-6">
            {/* Header form */}
            <section className="flex flex-col gap-4">
              <h2 className="border-b border-hairline pb-2 text-[14px] font-semibold text-ink">
                {isCreating ? "Neue Variantenvorlage" : "Vorlage bearbeiten"}
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Bezeichnung</Label>
                  <input
                    type="text"
                    value={formLabel}
                    onChange={(e) => setFormLabel(e.target.value)}
                    placeholder="T-Shirt"
                    className={inputClass}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>
                    Slug{" "}
                    {!isCreating && (
                      <span className="text-[10px] text-ink-mute">(schreibgeschützt)</span>
                    )}
                  </Label>
                  <input
                    type="text"
                    value={formSlug}
                    onChange={(e) => isCreating && setFormSlug(e.target.value)}
                    readOnly={!isCreating}
                    placeholder="t-shirt"
                    className={cn(
                      inputClass,
                      "font-mono",
                      !isCreating && "cursor-default bg-canvas-soft opacity-60",
                    )}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Produkttyp</Label>
                  <input
                    type="text"
                    value={draft.productTypeLabel}
                    onChange={(e) => setDraft((d) => ({ ...d, productTypeLabel: e.target.value }))}
                    placeholder="Bekleidung"
                    className={inputClass}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Artikelgruppe (optional)</Label>
                  <Select
                    value={formArticleGroupId || "__none__"}
                    onValueChange={(v) => setFormArticleGroupId(v && v !== "__none__" ? v : "")}
                  >
                    <SelectTrigger className="h-8 text-[13px]">
                      <SelectValue placeholder="Keine" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Keine</SelectItem>
                      {articleGroups.map((group: any) => (
                        <SelectItem key={group.articleGroupId} value={group.articleGroupId}>
                          {typeof group.name === "string"
                            ? group.name
                            : (group.name?.de ?? group.name?.en ?? group.code ?? "—")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {!isCreating && (
                <label className="flex w-fit cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!formArchived}
                    onChange={(e) => setFormArchived(!e.target.checked)}
                    className="size-4 accent-primary"
                  />
                  <span className="text-[13px] text-ink">Aktiv</span>
                </label>
              )}

              <div className="flex items-end gap-2 rounded-md border border-dashed border-hairline p-3">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label>KI-Vorschlag aus Artikelname/Produkttyp</Label>
                  <input
                    type="text"
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    placeholder="z. B. Herren T-Shirt Baumwolle"
                    className={inputClass}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!aiInput.trim() || suggestMutation.isPending}
                  onClick={() => suggestMutation.mutate()}
                >
                  <SparklesIcon className="mr-1.5 size-3.5" />
                  {suggestMutation.isPending ? "KI denkt nach…" : "Vorschlagen"}
                </Button>
              </div>
            </section>

            {/* Axes + values */}
            <section className="flex flex-col gap-3">
              <h2 className="border-b border-hairline pb-2 text-[14px] font-semibold text-ink">
                Achsen & Werte
              </h2>

              <div className="grid grid-cols-[260px_1fr] gap-4">
                {/* Axes list */}
                <div className="flex flex-col gap-2">
                  <div className="overflow-hidden rounded-md border border-hairline">
                    {draft.axes.length === 0 && (
                      <div className="px-3 py-4 text-center text-[12px] text-ink-mute">
                        Noch keine Achsen.
                      </div>
                    )}
                    {draft.axes.map((axis, axisIndex) => (
                      <div
                        key={axis._localId}
                        className={cn(
                          "flex items-center gap-1 border-b border-hairline px-2 py-1 last:border-0",
                          selectedAxisId === axis._localId && "bg-canvas-soft",
                        )}
                      >
                        <input
                          type="text"
                          value={axis.name}
                          onFocus={() => setSelectedAxisId(axis._localId)}
                          onChange={(e) => updateAxis(axis._localId, { name: e.target.value })}
                          placeholder="Achse, z. B. Farbe"
                          className={gridInputClass}
                        />
                        <button
                          onClick={() => moveAxis(axis._localId, -1)}
                          disabled={axisIndex === 0}
                          className="flex size-6 shrink-0 items-center justify-center rounded text-ink-mute hover:text-ink disabled:opacity-30"
                          title="Nach oben"
                        >
                          <ArrowUpIcon className="size-3" />
                        </button>
                        <button
                          onClick={() => moveAxis(axis._localId, 1)}
                          disabled={axisIndex === draft.axes.length - 1}
                          className="flex size-6 shrink-0 items-center justify-center rounded text-ink-mute hover:text-ink disabled:opacity-30"
                          title="Nach unten"
                        >
                          <ArrowDownIcon className="size-3" />
                        </button>
                        <button
                          onClick={() => removeAxis(axis._localId)}
                          className="flex size-6 shrink-0 items-center justify-center rounded text-ink-mute transition-colors hover:bg-red-50 hover:text-red-500"
                          title="Achse entfernen"
                        >
                          <Trash2Icon className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={addAxis}
                    className="flex items-center gap-1.5 text-[13px] text-ink-secondary transition-colors hover:text-ink"
                  >
                    <PlusIcon className="size-3.5" />
                    Achse hinzufügen
                  </button>
                </div>

                {/* Values of the selected axis */}
                <div className="flex flex-col gap-2">
                  {selectedAxis ? (
                    <>
                      <div className="overflow-hidden rounded-md border border-hairline">
                        <table className="w-full text-[12px]">
                          <thead className="border-b border-hairline bg-canvas-soft">
                            <tr>
                              <th className="px-2 py-1.5 text-left text-[10px] font-medium tracking-wider text-ink-mute uppercase">
                                Wert
                              </th>
                              <th className="w-20 px-2 py-1.5 text-left text-[10px] font-medium tracking-wider text-ink-mute uppercase">
                                SKU-Code
                              </th>
                              <th className="w-24 px-2 py-1.5 text-left text-[10px] font-medium tracking-wider text-ink-mute uppercase">
                                Aufpreis
                              </th>
                              <th className="w-24 px-2 py-1.5 text-left text-[10px] font-medium tracking-wider text-ink-mute uppercase">
                                Gewicht ±
                              </th>
                              <th className="w-20" />
                            </tr>
                          </thead>
                          <tbody>
                            {selectedAxis.values.map((value, valueIndex) => (
                              <tr
                                key={value._localId}
                                className="border-b border-hairline last:border-0"
                              >
                                <td className="px-1 py-1">
                                  <input
                                    type="text"
                                    value={value.value}
                                    onChange={(e) =>
                                      updateValue(selectedAxis._localId, value._localId, {
                                        value: e.target.value,
                                      })
                                    }
                                    placeholder="z. B. Navy"
                                    className={gridInputClass}
                                  />
                                </td>
                                <td className="px-1 py-1">
                                  <input
                                    type="text"
                                    value={value.skuCode}
                                    onChange={(e) =>
                                      updateValue(selectedAxis._localId, value._localId, {
                                        skuCode: e.target.value,
                                      })
                                    }
                                    placeholder="NV"
                                    className={cn(gridInputClass, "font-mono")}
                                  />
                                </td>
                                <td className="px-1 py-1">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={value.priceSurcharge}
                                    onChange={(e) =>
                                      updateValue(selectedAxis._localId, value._localId, {
                                        priceSurcharge: e.target.value,
                                      })
                                    }
                                    placeholder="0"
                                    className={cn(gridInputClass, "text-right")}
                                  />
                                </td>
                                <td className="px-1 py-1">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={value.weightDelta}
                                    onChange={(e) =>
                                      updateValue(selectedAxis._localId, value._localId, {
                                        weightDelta: e.target.value,
                                      })
                                    }
                                    placeholder="0"
                                    className={cn(gridInputClass, "text-right")}
                                  />
                                </td>
                                <td className="px-1 py-1">
                                  <div className="flex items-center justify-end gap-0.5">
                                    <button
                                      onClick={() =>
                                        moveValue(selectedAxis._localId, value._localId, -1)
                                      }
                                      disabled={valueIndex === 0}
                                      className="flex size-6 items-center justify-center rounded text-ink-mute hover:text-ink disabled:opacity-30"
                                    >
                                      <ArrowUpIcon className="size-3" />
                                    </button>
                                    <button
                                      onClick={() =>
                                        moveValue(selectedAxis._localId, value._localId, 1)
                                      }
                                      disabled={valueIndex === selectedAxis.values.length - 1}
                                      className="flex size-6 items-center justify-center rounded text-ink-mute hover:text-ink disabled:opacity-30"
                                    >
                                      <ArrowDownIcon className="size-3" />
                                    </button>
                                    <button
                                      onClick={() =>
                                        removeValue(selectedAxis._localId, value._localId)
                                      }
                                      className="flex size-6 items-center justify-center rounded text-ink-mute transition-colors hover:bg-red-50 hover:text-red-500"
                                    >
                                      <Trash2Icon className="size-3" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                            {selectedAxis.values.length === 0 && (
                              <tr>
                                <td
                                  colSpan={5}
                                  className="px-3 py-4 text-center text-[12px] text-ink-mute"
                                >
                                  Noch keine Werte.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => addValue(selectedAxis._localId)}
                          className="flex items-center gap-1.5 text-[13px] text-ink-secondary transition-colors hover:text-ink"
                        >
                          <PlusIcon className="size-3.5" />
                          Wert hinzufügen
                        </button>
                        <button
                          onClick={() => normalizeMutation.mutate(selectedAxis._localId)}
                          disabled={
                            normalizeMutation.isPending || selectedAxis.values.length === 0
                          }
                          className="flex items-center gap-1.5 text-[13px] text-ink-secondary transition-colors hover:text-ink disabled:opacity-40"
                        >
                          <SparklesIcon className="size-3.5" />
                          {normalizeMutation.isPending ? "Normalisiere…" : "Werte normalisieren"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex h-full min-h-24 items-center justify-center rounded-md border border-dashed border-hairline text-[12px] text-ink-mute">
                      Achse auswählen, um Werte zu pflegen
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Exclusion rules */}
            <section className="flex flex-col gap-3">
              <h2 className="border-b border-hairline pb-2 text-[14px] font-semibold text-ink">
                Ausschlussregeln
              </h2>

              {draft.rules.length === 0 && (
                <div className="text-[12px] text-ink-mute">
                  Keine Regeln. Kombinationen werden vollständig erzeugt.
                </div>
              )}

              {draft.rules.map((rule) => (
                <div
                  key={rule._localId}
                  className="flex flex-col gap-2 rounded-md border border-hairline p-3"
                >
                  <div className="flex flex-wrap items-center gap-2 text-[13px]">
                    <span className="text-ink-mute">Wenn</span>
                    <Select
                      value={rule.whenAxis || undefined}
                      onValueChange={(v) =>
                        v && updateRule(rule._localId, { whenAxis: v, whenValue: "" })
                      }
                    >
                      <SelectTrigger className="h-7 w-36 text-[12px]">
                        <SelectValue placeholder="Achse" />
                      </SelectTrigger>
                      <SelectContent>
                        {draft.axes
                          .filter((axis) => axis.name.trim())
                          .map((axis) => (
                            <SelectItem key={axis._localId} value={axis.name}>
                              {axis.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <span className="text-ink-mute">=</span>
                    <Select
                      value={rule.whenValue || undefined}
                      onValueChange={(v) => v && updateRule(rule._localId, { whenValue: v })}
                    >
                      <SelectTrigger className="h-7 w-36 text-[12px]">
                        <SelectValue placeholder="Wert" />
                      </SelectTrigger>
                      <SelectContent>
                        {axisValues(rule.whenAxis)
                          .filter((value) => value.value.trim())
                          .map((value) => (
                            <SelectItem key={value._localId} value={value.value}>
                              {value.value}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <span className="text-ink-mute">→ ausschließen</span>
                    <Select
                      value={rule.excludeAxis || undefined}
                      onValueChange={(v) =>
                        v && updateRule(rule._localId, { excludeAxis: v, excludeValues: [] })
                      }
                    >
                      <SelectTrigger className="h-7 w-36 text-[12px]">
                        <SelectValue placeholder="Achse" />
                      </SelectTrigger>
                      <SelectContent>
                        {draft.axes
                          .filter((axis) => axis.name.trim())
                          .map((axis) => (
                            <SelectItem key={axis._localId} value={axis.name}>
                              {axis.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <button
                      onClick={() => removeRule(rule._localId)}
                      className="ml-auto flex size-6 items-center justify-center rounded text-ink-mute transition-colors hover:bg-red-50 hover:text-red-500"
                      title="Regel entfernen"
                    >
                      <Trash2Icon className="size-3.5" />
                    </button>
                  </div>

                  {/* Value chips for the exclude axis */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {axisValues(rule.excludeAxis)
                      .filter((value) => value.value.trim())
                      .map((value) => {
                        const isSelected = rule.excludeValues.includes(value.value);
                        return (
                          <button
                            key={value._localId}
                            onClick={() =>
                              updateRule(rule._localId, {
                                excludeValues: isSelected
                                  ? rule.excludeValues.filter((v) => v !== value.value)
                                  : [...rule.excludeValues, value.value],
                              })
                            }
                            className={cn(
                              "rounded-full border px-2.5 py-0.5 text-[12px] transition-colors",
                              isSelected
                                ? "border-primary bg-primary text-primary-fg"
                                : "border-hairline text-ink-secondary hover:border-primary/50",
                            )}
                          >
                            {value.value}
                          </button>
                        );
                      })}
                    {axisValues(rule.excludeAxis).length === 0 && (
                      <span className="text-[12px] text-ink-mute">
                        Achse wählen, dann Werte markieren
                      </span>
                    )}
                  </div>

                  <input
                    type="text"
                    value={rule.label}
                    onChange={(e) => updateRule(rule._localId, { label: e.target.value })}
                    placeholder="Beschreibung, z. B. XXL nicht in Kinderlinie"
                    className={cn(inputClass, "h-7 text-[12px]")}
                  />
                </div>
              ))}

              <button
                onClick={addRule}
                disabled={draft.axes.length === 0}
                className="flex w-fit items-center gap-1.5 text-[13px] text-ink-secondary transition-colors hover:text-ink disabled:opacity-40"
              >
                <PlusIcon className="size-3.5" />
                Regel hinzufügen
              </button>
            </section>

            {/* SKU pattern + defaults */}
            <section className="flex flex-col gap-4">
              <h2 className="border-b border-hairline pb-2 text-[14px] font-semibold text-ink">
                SKU & Vererbung
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>SKU-Muster</Label>
                  <input
                    type="text"
                    value={draft.skuPattern}
                    onChange={(e) => setDraft((d) => ({ ...d, skuPattern: e.target.value }))}
                    placeholder={DEFAULT_SKU_PATTERN}
                    className={cn(inputClass, "font-mono")}
                  />
                  <span className="text-[11px] text-ink-mute">
                    Tokens: {"{articleNo}"}, {"{axis:<Achse>}"}, {"{hash:<n>}"} · Vorschau:{" "}
                    <span className="font-mono text-ink">{skuPreview}</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label>Preis</Label>
                    <Select
                      value={draft.priceMode}
                      onValueChange={(v) =>
                        v && setDraft((d) => ({ ...d, priceMode: v as Draft["priceMode"] }))
                      }
                    >
                      <SelectTrigger className="h-8 text-[13px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inherit">Erben (leer lassen)</SelectItem>
                        <SelectItem value="surchargeOnBase">Basispreis + Aufpreise</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Gewicht</Label>
                    <Select
                      value={draft.weightMode}
                      onValueChange={(v) =>
                        v && setDraft((d) => ({ ...d, weightMode: v as Draft["weightMode"] }))
                      }
                    >
                      <SelectTrigger className="h-8 text-[13px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inherit">Erben (leer lassen)</SelectItem>
                        <SelectItem value="deltaOnBase">Basisgewicht ± Delta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </section>

            {/* JSON import/export */}
            <section className="flex flex-col gap-3">
              <h2 className="border-b border-hairline pb-2 text-[14px] font-semibold text-ink">
                JSON
              </h2>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyJson}>
                  <CopyIcon className="mr-1.5 size-3.5" />
                  Kopieren
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadJson}>
                  <DownloadIcon className="mr-1.5 size-3.5" />
                  Download
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowImport((v) => !v)}>
                  <UploadIcon className="mr-1.5 size-3.5" />
                  Import…
                </Button>
              </div>

              {showImport && (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    rows={8}
                    placeholder='{"version": 1, "productTypeLabel": "…", "axes": [...]}'
                    className="rounded border border-hairline bg-canvas px-2.5 py-2 font-mono text-[12px] focus:border-primary focus:outline-none"
                  />
                  <div className="flex justify-end">
                    <Button size="sm" onClick={handleImportJson} disabled={!importText.trim()}>
                      In Editor übernehmen
                    </Button>
                  </div>
                </div>
              )}

              <pre className="max-h-64 overflow-auto rounded-md border border-hairline bg-canvas-soft p-3 font-mono text-[11px] text-ink-secondary">
                {exportJson}
              </pre>
            </section>

            {/* Validation + save */}
            {validationErrors.length > 0 && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3">
                <div className="mb-1 text-[12px] font-semibold text-red-700">
                  Vorlage ist ungültig:
                </div>
                <ul className="list-inside list-disc text-[12px] text-red-600">
                  {validationErrors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end border-t border-hairline pt-4">
              <Button
                onClick={() => (isCreating ? createMutation.mutate() : updateMutation.mutate())}
                disabled={!formLabel.trim() || !formSlug.trim() || isPending}
                size="sm"
              >
                <SaveIcon className="mr-1.5 size-3.5" />
                {isCreating ? "Vorlage anlegen" : "Vorlage speichern"}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center bg-canvas text-[13px] text-ink-mute">
          Vorlage auswählen oder neu anlegen
        </div>
      )}
    </div>
  );
}

function VariantTemplatesPage() {
  return <VariantTemplatesView />;
}
