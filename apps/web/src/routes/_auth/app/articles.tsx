import { ArticleImageStrip } from "@repo/ui/components/article-image-strip";
import { ContextTabs } from "@repo/ui/components/context-tabs";
import { DataGrid, type DataGridHandle, type ColumnDef } from "@repo/ui/components/data-grid";
import { Dialog, DialogContent } from "@repo/ui/components/dialog";
import { EntityMask } from "@repo/ui/components/entity-mask";
import { InlineEditGrid } from "@repo/ui/components/inline-edit-grid";
import { InspectorPanel } from "@repo/ui/components/inspector-panel";
import { InventoryBalanceTable } from "@repo/ui/components/inventory-balance-table";
import { LangTextRecordPanel } from "@repo/ui/components/langtext-record-panel";
import { NavigationTree, type TreeNode } from "@repo/ui/components/navigation-tree";
import { StockLedgerTable } from "@repo/ui/components/stock-ledger-table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@repo/ui/components/tabs";
import { TriViewWorkspace } from "@repo/ui/components/triview-workspace";
import { formatDate } from "@repo/ui/lib/formatters";
import { useActionBar } from "@repo/ui/platform/action-bar-context";
import { useCommands } from "@repo/ui/platform/command-registry";
import { useFocus } from "@repo/ui/platform/focus-manager";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ImageIcon } from "lucide-react";
import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { VariantGeneratorDialog } from "#/components/articles/VariantGeneratorDialog";
import { useGridUrlState } from "#/hooks/use-grid-url-state";
import { entityDelete, entityGet, entityList, entitySave } from "#/lib/entity-capabilities";
import { useCapabilityQuery } from "#/queries/capability";
const DEFAULT_VARIANT_OPTION_VALUE_HASH =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
import { resolveArticleVariantMode } from "@repo/db/services/article-variant-mode";

export const Route = createFileRoute("/_auth/app/articles")({
  component: ArticlesModule,
});

const EMPTY_ARRAY: any[] = [];

const ARTICLE_FIELD_OVERRIDES = [
  {
    key: "bomType",
    type: "select" as const,
    options: [
      { value: "none", label: "None" },
      { value: "sales", label: "Sales (H)" },
      { value: "production", label: "Production (P)" },
    ],
  },
  {
    key: "trackingMode",
    type: "select" as const,
    options: [
      { value: "none", label: "None" },
      { value: "serial", label: "Serial" },
      { value: "batch", label: "Batch" },
    ],
  },
];

const ARTICLE_TEXT_FIELD_OVERRIDES = [
  { key: "notiztext", visible: false },
  { key: "langtext", visible: false },
  { key: "kurzbeschreibung", visible: false },
  { key: "warntext", visible: false },
];

const ARTICLE_EDIT_FIELD_OVERRIDES = [...ARTICLE_FIELD_OVERRIDES, ...ARTICLE_TEXT_FIELD_OVERRIDES];

const ARTICLE_LANGTEXT_FIELDS = [
  { field: "notiztext", label: "Notiztext" },
  { field: "langtext", label: "Langtext" },
  { field: "kurzbeschreibung", label: "Kurzbeschreibung" },
  { field: "warntext", label: "Warntext" },
];

type SalesDraft = {
  price: string;
  ean: string;
  weight: string;
  isActive: boolean;
  trackingMode: string;
};

const EMPTY_SALES_DRAFT: SalesDraft = {
  price: "",
  ean: "",
  weight: "",
  isActive: true,
  trackingMode: "",
};

function ArticleSalesBlock({
  defaultVariant,
  articleRecord,
  variantMode,
  draft,
  onDraftChange,
}: {
  defaultVariant: Record<string, any> | null;
  articleRecord?: { trackingMode?: string | null } | null;
  variantMode?: "simple" | "variants";
  draft: SalesDraft;
  onDraftChange: (d: SalesDraft) => void;
}) {
  const { t } = useTranslation("ui");
  const queryClient = useQueryClient();
  const isEdit = defaultVariant !== null;

  const [localValues, setLocalValues] = useState(() => ({
    price: String(defaultVariant?.price ?? draft.price ?? ""),
    ean: String(defaultVariant?.ean ?? draft.ean ?? ""),
    weight: String(defaultVariant?.weight ?? draft.weight ?? ""),
    isActive: Boolean(defaultVariant?.isActive ?? draft.isActive ?? true),
    trackingMode: String(articleRecord?.trackingMode ?? draft.trackingMode ?? ""),
  }));

  const persistField = useCallback(
    async (field: keyof SalesDraft, value: string | boolean) => {
      const articleId = defaultVariant?.articleId;
      if (!articleId) return;
      if (field === "trackingMode") {
        await entitySave("article", articleId, { trackingMode: value || null });
        await queryClient.invalidateQueries({ queryKey: ["data", "article", articleId] });
        return;
      }
      const variantId = defaultVariant?.variantId;
      if (!variantId) return;
      const payload =
        field === "isActive" ? { isActive: Boolean(value) } : { [field]: value || null };
      await entitySave("articleVariant", variantId, payload);
      await queryClient.invalidateQueries({
        queryKey: ["data", "articleVariant", articleId],
      });
    },
    [defaultVariant, queryClient],
  );

  const handleChange = useCallback(
    (field: keyof SalesDraft, value: string | boolean) => {
      const next = { ...localValues, [field]: value };
      setLocalValues(next);
      if (!isEdit) {
        onDraftChange({
          price: next.price,
          ean: next.ean,
          weight: next.weight,
          isActive: next.isActive,
          trackingMode: next.trackingMode,
        });
      }
    },
    [isEdit, localValues, onDraftChange],
  );

  const handleBlur = useCallback(
    async (field: keyof SalesDraft) => {
      if (!isEdit) return;
      await persistField(field, localValues[field]).catch((err) =>
        toast.error(err instanceof Error && err.message ? err.message : `Failed to save ${field}`),
      );
    },
    [isEdit, localValues, persistField],
  );

  const subtitle =
    variantMode === "variants"
      ? t("article.salesVariants", {
          defaultValue: "Sales data is written to the default variant row.",
        })
      : t("article.salesSimple", {
          defaultValue: "Default values are written to the single sellable variant.",
        });

  return (
    <section className="rounded-md border border-hairline bg-canvas shadow-sm">
      <div className="border-b border-hairline bg-canvas-soft px-3 py-2">
        <div className="text-[11px] font-medium tracking-wider text-ink-mute uppercase">
          {t("article.sales", { defaultValue: "Sales" })}
        </div>
        <div className="mt-0.5 text-[12px] text-ink-secondary">{subtitle}</div>
      </div>
      <div className="grid gap-3 p-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-[12px] font-medium text-ink-secondary">Price</span>
          <input
            type="number"
            step="0.0001"
            className="h-8 rounded border border-hairline bg-canvas px-2 text-[13px] text-ink outline-none"
            value={localValues.price}
            onChange={(e) => handleChange("price", e.target.value)}
            onBlur={() => void handleBlur("price")}
            placeholder="0.00"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-ink-secondary">EAN</span>
          <input
            type="text"
            className="h-8 rounded border border-hairline bg-canvas px-2 text-[13px] text-ink outline-none"
            value={localValues.ean}
            onChange={(e) => handleChange("ean", e.target.value)}
            onBlur={() => void handleBlur("ean")}
            placeholder="EAN"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-ink-secondary">Weight</span>
          <input
            type="number"
            step="0.0001"
            className="h-8 rounded border border-hairline bg-canvas px-2 text-[13px] text-ink outline-none"
            value={localValues.weight}
            onChange={(e) => handleChange("weight", e.target.value)}
            onBlur={() => void handleBlur("weight")}
            placeholder="0.0000"
          />
        </label>
        <label className="flex items-center gap-2 sm:col-span-2">
          <input
            type="checkbox"
            className="size-4 rounded border-hairline-input accent-[var(--primary)]"
            checked={localValues.isActive}
            onChange={(e) => {
              handleChange("isActive", e.target.checked);
              if (isEdit) {
                void persistField("isActive", e.target.checked).catch((err) =>
                  toast.error(
                    err instanceof Error ? err.message : "Failed to save bookable status",
                  ),
                );
              }
            }}
          />
          <span className="text-[13px] text-ink">Bookable</span>
        </label>
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-[12px] font-medium text-ink-secondary">Tracking</span>
          <select
            className="h-8 rounded border border-hairline bg-canvas px-2 text-[13px] text-ink outline-none"
            value={localValues.trackingMode}
            onChange={(e) => handleChange("trackingMode", e.target.value)}
            onBlur={() => void handleBlur("trackingMode")}
          >
            <option value="">None</option>
            <option value="serial">Serial</option>
            <option value="batch">Batch</option>
          </select>
        </label>
        {!isEdit && (
          <p className="text-[12px] text-ink-mute sm:col-span-2">
            {t("article.salesCreateHint", {
              defaultValue:
                "These values are applied to the default variant after the article is saved.",
            })}
          </p>
        )}
      </div>
    </section>
  );
}

function ArticleVariantEditForm({
  variant,
  onOpenChange,
  onSaved,
}: {
  variant: Record<string, any>;
  onOpenChange: (v: boolean) => void;
  onSaved: (record: unknown) => void;
}) {
  const { t } = useTranslation("ui");
  const [form, setForm] = useState({
    sku: String(variant.sku ?? ""),
    price: String(variant.price ?? ""),
    ean: String(variant.ean ?? ""),
    weight: String(variant.weight ?? ""),
    isActive: Boolean(variant.isActive ?? true),
  });
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const saved = await entitySave("articleVariant", variant.variantId, {
        sku: form.sku || null,
        price: form.price || null,
        ean: form.ean || null,
        weight: form.weight || null,
        isActive: form.isActive,
      });
      onSaved(saved);
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Failed to save variant");
    } finally {
      setSaving(false);
    }
  }, [form, onSaved, variant.variantId]);

  return (
    <div className="flex flex-col gap-0">
      <div className="border-b border-hairline bg-canvas-soft px-4 py-3">
        <div className="text-[14px] font-medium text-ink">
          {t("article.variants.edit", { defaultValue: "Edit Variant" })}
        </div>
        {variant.variantOptionSummary && (
          <div className="mt-0.5 text-[12px] text-ink-secondary">
            {variant.variantOptionSummary}
          </div>
        )}
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-[12px] font-medium text-ink-secondary">SKU</span>
          <input
            type="text"
            className="h-8 rounded border border-hairline bg-canvas px-2 font-mono text-[13px] text-ink outline-none"
            value={form.sku}
            onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))}
            placeholder="SKU"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-ink-secondary">Price</span>
          <input
            type="number"
            step="0.0001"
            className="h-8 rounded border border-hairline bg-canvas px-2 text-[13px] text-ink outline-none"
            value={form.price}
            onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
            placeholder="0.00"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-ink-secondary">EAN</span>
          <input
            type="text"
            className="h-8 rounded border border-hairline bg-canvas px-2 text-[13px] text-ink outline-none"
            value={form.ean}
            onChange={(e) => setForm((p) => ({ ...p, ean: e.target.value }))}
            placeholder="EAN"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-ink-secondary">Weight</span>
          <input
            type="number"
            step="0.0001"
            className="h-8 rounded border border-hairline bg-canvas px-2 text-[13px] text-ink outline-none"
            value={form.weight}
            onChange={(e) => setForm((p) => ({ ...p, weight: e.target.value }))}
            placeholder="0.0000"
          />
        </label>
        <label className="flex items-center gap-2 sm:col-span-2">
          <input
            type="checkbox"
            className="size-4 rounded border-hairline-input accent-[var(--primary)]"
            checked={form.isActive}
            onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
          />
          <span className="text-[13px] text-ink">Bookable</span>
        </label>
      </div>
      <div className="flex justify-end gap-2 border-t border-hairline bg-canvas-soft px-4 py-3">
        <button
          type="button"
          className="h-8 rounded border border-hairline px-4 text-[13px] hover:bg-canvas-soft"
          onClick={() => onOpenChange(false)}
          disabled={saving}
        >
          {t("actions.cancel", { defaultValue: "Cancel" })}
        </button>
        <button
          type="button"
          className="h-8 rounded bg-primary px-4 text-[13px] text-white hover:opacity-90 disabled:opacity-60"
          onClick={() => void handleSave()}
          disabled={saving}
        >
          {saving
            ? t("common.saving", { defaultValue: "Saving…" })
            : t("actions.save", { defaultValue: "Save" })}
        </button>
      </div>
    </div>
  );
}

function ArticleVariantEditDialog({
  variant,
  open,
  onOpenChange,
  onSaved,
}: {
  variant: Record<string, any> | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: (record: unknown) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sw-root max-w-lg overflow-hidden p-0" variant="form">
        {variant && (
          <ArticleVariantEditForm
            key={variant.variantId}
            variant={variant}
            onOpenChange={onOpenChange}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ArticleVariantsAndOptionsTab({
  articleId,
  articleLabel,
  articleNo,
}: {
  articleId: string | null;
  articleLabel: string;
  articleNo: string | null;
}) {
  const { t } = useTranslation("ui");
  const queryClient = useQueryClient();
  const variantGridRef = useRef<DataGridHandle>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [variantEditId, setVariantEditId] = useState<string | null>(null);
  const [showVariantEdit, setShowVariantEdit] = useState(false);
  const [showBulkPriceDialog, setShowBulkPriceDialog] = useState(false);
  const [bulkPriceMode, setBulkPriceMode] = useState<"set" | "adjust">("set");
  const [bulkPriceField, setBulkPriceField] = useState<"price" | "weight">("price");
  const [bulkPriceValue, setBulkPriceValue] = useState("");
  const [bulkPriceVariantIds, setBulkPriceVariantIds] = useState<string[]>([]);
  const [bulkPriceSubmitting, setBulkPriceSubmitting] = useState(false);
  const [showGeneratorDialog, setShowGeneratorDialog] = useState(false);
  const [showSurchargeDialog, setShowSurchargeDialog] = useState(false);
  const [surchargeVariantIds, setSurchargeVariantIds] = useState<string[]>([]);
  const [surchargeValueId, setSurchargeValueId] = useState<string | null>(null);
  const [surchargeAmount, setSurchargeAmount] = useState("");
  const [surchargeSubmitting, setSurchargeSubmitting] = useState(false);

  const { data: optionData, isLoading: isOptionsLoading } = useCapabilityQuery(
    "masterdata.articleOption.list",
    { articleId: articleId! },
    { enabled: !!articleId, placeholderData: keepPreviousData },
  );
  const optionRows = optionData?.items ?? EMPTY_ARRAY;

  const { data: variantData, isLoading: isVariantsLoading } = useCapabilityQuery(
    "masterdata.articleVariant.list",
    { articleId: articleId! },
    { enabled: !!articleId, placeholderData: keepPreviousData },
  );
  const variantRows = variantData?.items ?? EMPTY_ARRAY;
  const variantMode = resolveArticleVariantMode({
    optionCount: optionRows.length,
    variantCount: variantRows.length,
  });
  const orderedVariantRows = useMemo(
    () =>
      [...variantRows].sort((left: any, right: any) => {
        const leftIsDefault = left.optionValueHash === DEFAULT_VARIANT_OPTION_VALUE_HASH;
        const rightIsDefault = right.optionValueHash === DEFAULT_VARIANT_OPTION_VALUE_HASH;
        if (leftIsDefault !== rightIsDefault) return leftIsDefault ? -1 : 1;
        return String(left.sku ?? "").localeCompare(String(right.sku ?? ""));
      }),
    [variantRows],
  );
  const resolvedSelectedOptionId =
    selectedOptionId && optionRows.some((row: any) => row.optionId === selectedOptionId)
      ? selectedOptionId
      : (optionRows[0]?.optionId ?? null);

  const selectedOption = useMemo(
    () => optionRows.find((row: any) => row.optionId === resolvedSelectedOptionId) ?? null,
    [optionRows, resolvedSelectedOptionId],
  );
  const optionsSubtitle = isOptionsLoading
    ? t("common.loading", { defaultValue: "Loading..." })
    : articleLabel || t("nav.articles", { defaultValue: "Articles" });
  const [showVariantSetup, setShowVariantSetup] = useState(false);

  const openVariantEditor = useCallback((row: any) => {
    setVariantEditId(row.variantId);
    setShowVariantEdit(true);
  }, []);

  const variantById = useMemo<Map<string, any>>(
    () => new Map<string, any>(variantRows.map((row: any) => [row.variantId, row])),
    [variantRows],
  );

  const patchEntity = useCallback(
    (entityName: string, id: string, body: Record<string, unknown>) =>
      entitySave(entityName, id, body),
    [],
  );

  const refreshVariants = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["data", "articleVariant", articleId] });
  }, [articleId, queryClient]);

  const patchVariantInventorySku = useCallback(
    async (variantId: string, sku: string) => {
      const items = await entityList<any>("inventoryItem", { variantId }, { limit: 1 });
      const item = items[0] ?? null;
      if (!item?.itemId) return;
      await patchEntity("inventoryItem", item.itemId, { sku });
    },
    [patchEntity],
  );

  const bulkVariantRows = useMemo(
    () =>
      bulkPriceVariantIds
        .map((variantId) => variantById.get(variantId))
        .filter((row): row is any => Boolean(row)),
    [bulkPriceVariantIds, variantById],
  );

  const bulkPricePreview = useMemo(() => {
    const parsed = Number(bulkPriceValue);
    if (!showBulkPriceDialog || !Number.isFinite(parsed)) return [];

    return bulkVariantRows.map((row: any) => {
      const current = Number(row[bulkPriceField] ?? 0);
      const next = bulkPriceMode === "adjust" ? current * (1 + parsed / 100) : parsed;
      return {
        variantId: row.variantId as string,
        sku: row.sku as string,
        current,
        next: Math.round(next * 10000) / 10000,
      };
    });
  }, [bulkPriceField, bulkPriceMode, bulkPriceValue, bulkVariantRows, showBulkPriceDialog]);

  const handleArchiveVariants = useCallback(
    async (keys: string[]) => {
      try {
        await Promise.all(
          keys.map((variantId) => patchEntity("articleVariant", variantId, { isActive: false })),
        );
        await refreshVariants();
        toast.success(`Archived ${keys.length} variant${keys.length === 1 ? "" : "s"}.`);
      } catch (err) {
        toast.error(
          err instanceof Error && err.message ? err.message : "Failed to archive variants",
        );
        throw err;
      }
    },
    [patchEntity, refreshVariants],
  );

  const handleSuggestSku = useCallback(
    async (keys: string[]) => {
      try {
        if (!articleNo) {
          throw new Error("Article number is required to suggest SKUs.");
        }

        await Promise.all(
          keys.map(async (variantId) => {
            const row = variantById.get(variantId);
            if (!row) throw new Error(`Variant ${variantId} not found.`);
            const shortHash = (row.optionValueHash as string).slice(0, 8);
            const suggestedSku = `${articleNo}-${shortHash}`;
            await patchEntity("articleVariant", variantId, { sku: suggestedSku });
            await patchVariantInventorySku(variantId, suggestedSku);
          }),
        );

        await refreshVariants();
        toast.success(`Suggested SKUs for ${keys.length} variant${keys.length === 1 ? "" : "s"}.`);
      } catch (err) {
        toast.error(err instanceof Error && err.message ? err.message : "Failed to suggest SKUs");
        throw err;
      }
    },
    [articleNo, patchEntity, patchVariantInventorySku, refreshVariants, variantById],
  );

  const handleOpenBulkPriceUpdate = useCallback((keys: string[]) => {
    setBulkPriceVariantIds(keys);
    setBulkPriceField("price");
    setBulkPriceMode("set");
    setBulkPriceValue("");
    setShowBulkPriceDialog(true);
  }, []);

  const handleOpenBulkWeightUpdate = useCallback((keys: string[]) => {
    setBulkPriceVariantIds(keys);
    setBulkPriceField("weight");
    setBulkPriceMode("set");
    setBulkPriceValue("");
    setShowBulkPriceDialog(true);
  }, []);

  const handleActivateVariants = useCallback(
    async (keys: string[]) => {
      try {
        await Promise.all(
          keys.map((variantId) => patchEntity("articleVariant", variantId, { isActive: true })),
        );
        await refreshVariants();
        toast.success(`Activated ${keys.length} variant${keys.length === 1 ? "" : "s"}.`);
      } catch (err) {
        toast.error(
          err instanceof Error && err.message ? err.message : "Failed to activate variants",
        );
        throw err;
      }
    },
    [patchEntity, refreshVariants],
  );

  const handleOpenSurchargeDialog = useCallback((keys: string[]) => {
    setSurchargeVariantIds(keys);
    setSurchargeValueId(null);
    setSurchargeAmount("");
    setShowSurchargeDialog(true);
  }, []);

  // All option values of this article, grouped for the surcharge dialog
  const { data: surchargeValueOptions = EMPTY_ARRAY } = useQuery({
    queryKey: ["data", "articleOptionValue", "by-article", articleId, optionRows],
    queryFn: async () => {
      const valueLists = await Promise.all(
        optionRows.map(async (option: any) => {
          const values = await entityList<any>("articleOptionValue", {
            optionId: option.optionId,
          }).catch(() => []);
          return values.map((value) => ({
            valueId: value.valueId as string,
            label: `${option.name}: ${value.value}`,
          }));
        }),
      );
      return valueLists.flat();
    },
    enabled: !!articleId && showSurchargeDialog && optionRows.length > 0,
  });

  const handleApplySurcharge = useCallback(async () => {
    const parsed = Number(surchargeAmount);
    if (!surchargeValueId || !Number.isFinite(parsed) || parsed === 0) {
      toast.error("Merkmalswert und Betrag wählen.");
      return;
    }

    setSurchargeSubmitting(true);
    try {
      const junctionRows = await entityList<any>("articleVariantOptionValue", {
        valueId: surchargeValueId,
      });
      const matchingVariantIds = new Set(junctionRows.map((row) => row.variantId as string));
      const targets = surchargeVariantIds.filter((variantId) => matchingVariantIds.has(variantId));

      if (targets.length === 0) {
        toast.info("Keine der ausgewählten Varianten trägt diesen Merkmalswert.");
        return;
      }

      await Promise.all(
        targets.map(async (variantId) => {
          const row = variantById.get(variantId);
          const current = Number(row?.price ?? 0);
          const next = Math.round((current + parsed) * 10000) / 10000;
          await patchEntity("articleVariant", variantId, { price: String(next) });
        }),
      );

      await refreshVariants();
      setShowSurchargeDialog(false);
      setSurchargeVariantIds([]);
      toast.success(
        `Aufschlag auf ${targets.length} Variante${targets.length === 1 ? "" : "n"} angewendet.`,
      );
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Aufschlag fehlgeschlagen");
    } finally {
      setSurchargeSubmitting(false);
    }
  }, [
    patchEntity,
    refreshVariants,
    surchargeAmount,
    surchargeValueId,
    surchargeVariantIds,
    variantById,
  ]);

  const handleApplyBulkPriceUpdate = useCallback(async () => {
    const parsed = Number(bulkPriceValue);
    if (!Number.isFinite(parsed)) {
      toast.error("Enter a valid price value.");
      return;
    }

    if (bulkVariantRows.length === 0) {
      toast.error("Select at least one variant.");
      return;
    }

    setBulkPriceSubmitting(true);
    try {
      await Promise.all(
        bulkVariantRows.map(async (row: any) => {
          const current = Number(row[bulkPriceField] ?? 0);
          const nextValue = bulkPriceMode === "adjust" ? current * (1 + parsed / 100) : parsed;
          const normalized = Math.round(nextValue * 10000) / 10000;
          await patchEntity("articleVariant", row.variantId, {
            [bulkPriceField]: String(normalized),
          });
        }),
      );

      await refreshVariants();
      setShowBulkPriceDialog(false);
      setBulkPriceVariantIds([]);
      toast.success(
        `Updated ${bulkPriceField === "price" ? "prices" : "weights"} for ${bulkVariantRows.length} variant${bulkVariantRows.length === 1 ? "" : "s"}.`,
      );
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Failed to update variants");
      throw err;
    } finally {
      setBulkPriceSubmitting(false);
    }
  }, [
    bulkPriceField,
    bulkPriceMode,
    bulkPriceValue,
    bulkVariantRows,
    patchEntity,
    refreshVariants,
  ]);

  const handleVariantSaved = useCallback(
    async (record: unknown) => {
      const savedVariantId = (record as any)?.variantId ?? (record as any)?.id ?? variantEditId;
      const nextSku = typeof (record as any)?.sku === "string" ? (record as any).sku : null;
      const previousSku = variantEditId ? (variantById.get(variantEditId)?.sku ?? null) : null;

      setShowVariantEdit(false);
      await queryClient.invalidateQueries({ queryKey: ["data", "articleVariant", articleId] });

      if (savedVariantId && nextSku && nextSku !== previousSku) {
        try {
          await patchVariantInventorySku(savedVariantId, nextSku);
        } catch (err) {
          toast.error(
            err instanceof Error && err.message ? err.message : "Failed to sync inventory SKU",
          );
        }
      }

      variantGridRef.current?.restoreFocus(savedVariantId ?? null);
    },
    [articleId, patchVariantInventorySku, queryClient, variantById, variantEditId],
  );

  const variantColumns = useMemo<ColumnDef<any>[]>(
    () => [
      {
        key: "sku",
        header: "SKU",
        sortable: true,
        render: (row: any) => (
          <span className="font-mono text-[12px] text-ink tabular-nums">{row.sku ?? "—"}</span>
        ),
      },
      {
        key: "isActive",
        header: t("form.active", { defaultValue: "Activity" }),
        sortable: true,
        align: "center",
        render: (row: any) => (
          <span
            className={
              row.isActive
                ? "inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800"
                : "inline-flex items-center rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-800"
            }
          >
            {row.isActive
              ? t("common.active", { defaultValue: "Active" })
              : t("common.inactive", { defaultValue: "Inactive" })}
          </span>
        ),
      },
      {
        key: "availableQty",
        header: t("articleView.inventory.title", { defaultValue: "Stock" }),
        sortable: true,
        isNumeric: true,
        align: "right",
        render: (row: any) => (
          <span className="font-mono text-[12px] text-ink tabular-nums">
            {Number(row.availableQty ?? 0).toFixed(3)}
          </span>
        ),
      },
      {
        key: "variantOptionSummary",
        header: t("article.options", { defaultValue: "Options" }),
        sortable: false,
        render: (row: any) => (
          <span className="block max-w-[32rem] truncate text-[12px] text-ink-secondary">
            {row.variantOptionSummary || "—"}
          </span>
        ),
      },
    ],
    [t],
  );

  if (!articleId) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-[13px] text-ink-mute">
        {t("article.variantsAndOptionsEmpty", {
          defaultValue: "Select an article to manage options and variants.",
        })}
      </div>
    );
  }

  const showVariantEditor = variantMode === "variants" || showVariantSetup;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-auto p-3">
      {showVariantEditor ? (
        <>
          <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
            <section className="flex min-h-0 flex-col overflow-hidden rounded-md border border-hairline bg-canvas shadow-sm">
              <div className="border-b border-hairline bg-canvas-soft px-3 py-2">
                <div className="text-[11px] font-medium tracking-wider text-ink-mute uppercase">
                  {t("article.options", { defaultValue: "Article Options" })}
                </div>
                <div className="mt-0.5 text-[12px] text-ink-secondary">{optionsSubtitle}</div>
              </div>
              <div className="min-h-0 flex-1">
                <InlineEditGrid
                  key={`${articleId}-options`}
                  entityName="articleOption"
                  parentKey={{ articleId }}
                  keyColumn="optionId"
                  className="h-full"
                  onRowSelect={(row) => setSelectedOptionId(row?.optionId ?? null)}
                  columns={[
                    { key: "name", header: "Name", type: "text", required: true },
                    { key: "sortOrder", header: "Sort", type: "number", width: "88px" },
                  ]}
                />
              </div>
            </section>

            <section className="flex min-h-0 flex-col overflow-hidden rounded-md border border-hairline bg-canvas shadow-sm">
              <div className="border-b border-hairline bg-canvas-soft px-3 py-2">
                <div className="text-[11px] font-medium tracking-wider text-ink-mute uppercase">
                  {t("article.optionValues", { defaultValue: "Option Values" })}
                </div>
                <div className="mt-0.5 text-[12px] text-ink-secondary">
                  {selectedOption
                    ? selectedOption.name
                    : t("article.optionValuesSelect", {
                        defaultValue: "Select an option to edit values.",
                      })}
                </div>
              </div>
              <div className="min-h-0 flex-1">
                {resolvedSelectedOptionId ? (
                  <InlineEditGrid
                    key={`${resolvedSelectedOptionId}-values`}
                    entityName="articleOptionValue"
                    parentKey={{ optionId: resolvedSelectedOptionId }}
                    keyColumn="valueId"
                    className="h-full"
                    columns={[
                      { key: "value", header: "Value", type: "text", required: true },
                      { key: "sortOrder", header: "Sort", type: "number", width: "88px" },
                    ]}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-6 py-8 text-[13px] text-ink-mute">
                    {t("article.optionValuesSelect", {
                      defaultValue: "Select an option to edit values.",
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>

          <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-hairline bg-canvas shadow-sm">
            <div className="flex items-center gap-2 border-b border-hairline bg-canvas-soft px-3 py-2">
              <div className="flex-1">
                <div className="text-[11px] font-medium tracking-wider text-ink-mute uppercase">
                  {t("article.variants", { defaultValue: "Variants" })}
                </div>
                <div className="mt-0.5 text-[12px] text-ink-secondary">
                  {articleLabel || t("nav.articles", { defaultValue: "Articles" })}
                </div>
              </div>
              <button
                type="button"
                className="h-6 rounded bg-primary px-3 text-[11px] text-white hover:opacity-90"
                onClick={() => setShowGeneratorDialog(true)}
              >
                {t("article.generateVariants", { defaultValue: "Varianten erzeugen" })}
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <DataGrid
                ref={variantGridRef}
                entityName="articleVariant"
                panelId="article-variant-grid"
                data={orderedVariantRows}
                isLoading={isVariantsLoading}
                keyExtractor={(row: any) => row.variantId}
                title={t("article.variants", { defaultValue: "Variants" })}
                columns={variantColumns}
                toolbar={false}
                onRowClick={openVariantEditor}
                onRowOpen={openVariantEditor}
                selectable
                bulkActions={[
                  {
                    label: "Archive",
                    variant: "destructive" as const,
                    onClick: handleArchiveVariants,
                  },
                  {
                    label: "Aktivieren",
                    onClick: handleActivateVariants,
                  },
                  {
                    label: "Suggest SKU",
                    onClick: handleSuggestSku,
                  },
                  {
                    label: "Update prices",
                    onClick: handleOpenBulkPriceUpdate,
                  },
                  {
                    label: "Update weights",
                    onClick: handleOpenBulkWeightUpdate,
                  },
                  {
                    label: "Aufschlag je Merkmal",
                    onClick: handleOpenSurchargeDialog,
                  },
                ]}
                emptyTitle={t("empty.title")}
                emptySubtitle={t("article.optionValuesSelect", {
                  defaultValue: "Generate variants after defining options and values.",
                })}
                className="h-full rounded-none border-none"
              />
            </div>
          </section>
        </>
      ) : (
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-hairline bg-canvas shadow-sm">
          <div className="border-b border-hairline bg-canvas-soft px-3 py-2">
            <div className="text-[11px] font-medium tracking-wider text-ink-mute uppercase">
              {t("article.variants", { defaultValue: "Variants" })}
            </div>
            <div className="mt-0.5 text-[12px] text-ink-secondary">
              {t("article.variantsSimple", {
                defaultValue:
                  "Simple articles use a single default variant until you activate variants.",
              })}
            </div>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center p-6">
            <div className="max-w-md rounded-lg border border-dashed border-hairline bg-canvas-soft p-6 text-center">
              <div className="text-[15px] font-medium text-ink">
                {t("article.activateVariants", { defaultValue: "Activate variants" })}
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-secondary">
                {t("article.activateVariantsBody", {
                  defaultValue:
                    "Add the first option to switch from the default sellable row to full variant management.",
                })}
              </p>
              <button
                type="button"
                className="mt-4 h-8 rounded bg-primary px-4 text-[13px] text-white hover:opacity-90"
                onClick={() => setShowVariantSetup(true)}
              >
                {t("article.activateVariants", { defaultValue: "Activate variants" })}
              </button>
            </div>
          </div>
        </section>
      )}

      <ArticleVariantEditDialog
        variant={variantEditId ? (variantById.get(variantEditId) ?? null) : null}
        open={showVariantEdit}
        onOpenChange={setShowVariantEdit}
        onSaved={handleVariantSaved}
      />

      <VariantGeneratorDialog
        open={showGeneratorDialog}
        onOpenChange={setShowGeneratorDialog}
        articleId={articleId}
        onGenerated={refreshVariants}
      />

      <Dialog
        open={showSurchargeDialog}
        onOpenChange={(open) => {
          setShowSurchargeDialog(open);
          if (!open) setSurchargeVariantIds([]);
        }}
      >
        <DialogContent className="max-w-md">
          <div className="flex flex-col gap-5 p-6">
            <div>
              <h3 className="text-[15px] font-medium text-ink">Preisaufschlag je Merkmalswert</h3>
              <p className="mt-1 text-[13px] text-ink-mute">
                {surchargeVariantIds.length} Variante
                {surchargeVariantIds.length === 1 ? "" : "n"} ausgewählt — der Aufschlag wird nur
                auf Varianten mit dem gewählten Merkmalswert angewendet.
              </p>
            </div>

            <label className="flex flex-col gap-1.5 text-[13px] text-ink">
              <span className="text-[12px] font-medium text-ink-secondary">Merkmalswert</span>
              <select
                className="h-9 rounded border border-hairline bg-canvas px-2 text-[13px]"
                value={surchargeValueId ?? ""}
                onChange={(e) => setSurchargeValueId(e.target.value || null)}
              >
                <option value="">Bitte wählen…</option>
                {surchargeValueOptions.map((option: any) => (
                  <option key={option.valueId} value={option.valueId}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-[13px] text-ink">
              <span className="text-[12px] font-medium text-ink-secondary">
                Aufschlag (z. B. 2 oder -1.5)
              </span>
              <input
                type="number"
                step="0.0001"
                className="h-9 rounded border border-hairline bg-canvas px-2 text-[13px]"
                value={surchargeAmount}
                onChange={(e) => setSurchargeAmount(e.target.value)}
                placeholder="0.00"
              />
            </label>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="h-8 rounded border border-hairline px-4 text-[13px] hover:bg-canvas-soft"
                onClick={() => setShowSurchargeDialog(false)}
                disabled={surchargeSubmitting}
              >
                Abbrechen
              </button>
              <button
                type="button"
                className="h-8 rounded bg-primary px-4 text-[13px] text-white hover:opacity-90 disabled:opacity-60"
                onClick={() => void handleApplySurcharge()}
                disabled={surchargeSubmitting || !surchargeValueId || !surchargeAmount}
              >
                {surchargeSubmitting ? "Wird angewendet…" : "Anwenden"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showBulkPriceDialog}
        onOpenChange={(open) => {
          setShowBulkPriceDialog(open);
          if (!open) setBulkPriceVariantIds([]);
        }}
      >
        <DialogContent className="max-w-2xl">
          <div className="flex flex-col gap-5 p-6">
            <div>
              <h3 className="text-[15px] font-medium text-ink">
                {bulkPriceField === "price"
                  ? t("article.bulkUpdatePrices", { defaultValue: "Update variant prices" })
                  : t("article.bulkUpdateWeights", { defaultValue: "Update variant weights" })}
              </h3>
              <p className="mt-1 text-[13px] text-ink-mute">
                {bulkVariantRows.length} variant{bulkVariantRows.length === 1 ? "" : "s"} selected
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <label className="flex flex-col gap-1.5 text-[13px] text-ink">
                <span className="text-[12px] font-medium text-ink-secondary">Mode</span>
                <select
                  className="h-9 rounded border border-hairline bg-canvas px-2 text-[13px]"
                  value={bulkPriceMode}
                  onChange={(e) => setBulkPriceMode(e.target.value as "set" | "adjust")}
                >
                  <option value="set">
                    {bulkPriceField === "price" ? "Set absolute price" : "Set absolute weight"}
                  </option>
                  <option value="adjust">Adjust by percent</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] text-ink">
                <span className="text-[12px] font-medium text-ink-secondary">
                  {bulkPriceMode === "adjust"
                    ? "Percent"
                    : bulkPriceField === "price"
                      ? "Price"
                      : "Weight"}
                </span>
                <input
                  type="number"
                  step={bulkPriceMode === "adjust" ? "0.01" : "0.0001"}
                  className="h-9 rounded border border-hairline bg-canvas px-2 text-[13px]"
                  value={bulkPriceValue}
                  onChange={(e) => setBulkPriceValue(e.target.value)}
                  placeholder={bulkPriceMode === "adjust" ? "10" : "0.00"}
                />
              </label>
            </div>

            {bulkPricePreview.length > 0 ? (
              <div className="max-h-64 overflow-auto rounded border border-hairline">
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 bg-canvas-soft">
                    <tr className="border-b border-hairline text-left text-[11px] font-medium tracking-wider text-ink-mute uppercase">
                      <th className="px-3 py-2">SKU</th>
                      <th className="px-3 py-2 text-right">Current</th>
                      <th className="px-3 py-2 text-right">New</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkPricePreview.map((row) => (
                      <tr key={row.variantId} className="border-b border-hairline last:border-0">
                        <td className="px-3 py-2 font-mono text-[12px] text-ink">{row.sku}</td>
                        <td className="px-3 py-2 text-right font-mono text-[12px] text-ink-secondary tabular-nums">
                          {row.current.toFixed(4)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[12px] text-ink tabular-nums">
                          {row.next.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded border border-dashed border-hairline px-3 py-4 text-[13px] text-ink-mute">
                Enter a value to preview the affected prices.
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="h-8 rounded border border-hairline px-4 text-[13px] hover:bg-canvas-soft"
                onClick={() => setShowBulkPriceDialog(false)}
                disabled={bulkPriceSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="h-8 rounded bg-primary px-4 text-[13px] text-white hover:opacity-90 disabled:opacity-60"
                onClick={handleApplyBulkPriceUpdate}
                disabled={bulkPriceSubmitting || bulkVariantRows.length === 0}
              >
                {bulkPriceSubmitting ? "Updating..." : "Apply"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ArticlesModule() {
  const { state: focusState } = useFocus();
  const { registerCommand } = useCommands();
  const { setSubCrumb } = useActionBar();
  const { t } = useTranslation("ui");
  const queryClient = useQueryClient();
  const articleGridRef = useRef<DataGridHandle>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [createSalesDraft, setCreateSalesDraft] = useState<SalesDraft>(EMPTY_SALES_DRAFT);

  const [activeArticleId, setActiveArticleId] = useState<string | null>(
    focusState.entity === "article" ? focusState.recordId : null,
  );
  const lastSyncIdRef = useRef<string | null>(activeArticleId);

  useEffect(() => {
    if (
      focusState.entity === "article" &&
      focusState.recordId &&
      focusState.recordId !== lastSyncIdRef.current
    ) {
      lastSyncIdRef.current = focusState.recordId;
      setActiveArticleId(focusState.recordId);
    }
  }, [focusState.entity, focusState.recordId]);

  const gridState = useGridUrlState({ defaultPageSize: 50 });

  useEffect(() => () => setSubCrumb(undefined), [setSubCrumb]);

  const restoreArticleGrid = useCallback(
    (recordId?: string | null) => {
      articleGridRef.current?.restoreFocus(recordId ?? activeArticleId ?? null);
    },
    [activeArticleId],
  );

  // Fetch articles — paginated
  const { data: articleData, isLoading: isDataLoading } = useCapabilityQuery(
    "masterdata.article.list",
    {
      articleGroupId: selectedGroupId || undefined,
      limit: gridState.queryParams.limit,
      offset: (gridState.queryParams.page - 1) * gridState.queryParams.limit,
      orderBy: gridState.queryParams.orderBy || undefined,
      search: gridState.queryParams.search || undefined,
      filterRules: gridState.queryParams.filters as
        | Array<{ col: string; op: string; val: string }>
        | undefined,
      withTotal: true,
    },
    {
      placeholderData: keepPreviousData,
    },
  );

  const articles = useMemo(() => articleData?.items ?? EMPTY_ARRAY, [articleData]);

  // Fetch variants for the active article (shared query key with context tabs)
  const { data: activeVariantData } = useCapabilityQuery(
    "masterdata.articleVariant.list",
    { articleId: activeArticleId! },
    { enabled: !!activeArticleId, placeholderData: keepPreviousData },
  );
  const activeVariantRows = activeVariantData?.items ?? EMPTY_ARRAY;

  const activeDefaultVariant = useMemo(
    () =>
      activeVariantRows.find((r: any) => r.optionValueHash === DEFAULT_VARIANT_OPTION_VALUE_HASH) ??
      activeVariantRows[0] ??
      null,
    [activeVariantRows],
  );

  // Fetch article groups
  const { data: groupsData, isLoading: isTreeLoading } = useCapabilityQuery(
    "masterdata.articleGroup.list",
    {},
    {
      select: useCallback(
        (data) =>
          data.items.map(
            (g: any): TreeNode => ({
              id: g.articleGroupId,
              label: g.name || "Unnamed Group",
            }),
          ),
        [],
      ),
      placeholderData: keepPreviousData,
    },
  );
  const groups = groupsData ?? EMPTY_ARRAY;

  const { data: unitData } = useCapabilityQuery(
    "masterdata.unit.list",
    {},
    {
      placeholderData: keepPreviousData,
    },
  );
  const units = unitData?.items ?? EMPTY_ARRAY;

  const groupMap = useMemo(
    () => new Map<string, string>((groups || EMPTY_ARRAY).map((g: TreeNode) => [g.id, g.label])),
    [groups],
  );

  const treeNodes = useMemo<TreeNode[]>(
    () => [{ id: "ALL", label: t("tree.all", { defaultValue: "All" }) }, ...groups],
    [groups, t],
  );

  const unitMap = useMemo(
    () => new Map<string, string>((units || EMPTY_ARRAY).map((u: any) => [u.unitId, u.code])),
    [units],
  );

  // Fetch inventory movements for selected article (server-side FK filter)
  const { data: movementData } = useCapabilityQuery(
    "logistics.inventoryMovement.list",
    { filters: { articleId: activeArticleId! } },
    {
      enabled: !!activeArticleId,
      placeholderData: keepPreviousData,
    },
  );
  const movements = movementData?.items ?? EMPTY_ARRAY;

  // Fetch article stats when statistics tab is active
  const { data: articleStats } = useQuery<{
    revenueByPeriod: Array<{
      fiscal_year: number;
      period_no: number;
      total_amount_net: string;
      total_qty: string;
    }>;
    stockLedger: unknown[];
  }>({
    queryKey: ["stats", "article", activeArticleId],
    queryFn: async () => {
      const res = await fetch(`/api/stats/article/${encodeURIComponent(activeArticleId!)}`);
      if (!res.ok) throw new Error("Failed to fetch article stats");
      return res.json();
    },
    enabled: !!activeArticleId,
    placeholderData: keepPreviousData,
  });
  const openCreateDialog = useCallback(() => {
    setCreateSalesDraft(EMPTY_SALES_DRAFT);
    setShowCreate(true);
  }, []);

  // Register context commands
  useEffect(() => {
    const unregF3 = registerCommand({
      id: "create-record",
      scope: "context",
      group: "recordOps",
      label: { en: t("commands.newRecord"), de: "Neuer Datensatz" },
      shortcut: "F3",
      isEnabled: () => true,
      handler: () => openCreateDialog(),
    });
    const unregEdit = registerCommand({
      id: "edit-record",
      scope: "context",
      group: "recordOps",
      label: { en: "Edit", de: "Bearbeiten" },
      shortcut: "F2",
      isEnabled: (s) => !!s.recordId && s.entity === "article",
      handler: () => setShowEdit(true),
    });
    const unregF4 = registerCommand({
      id: "delete-record",
      scope: "context",
      group: "recordOps",
      label: { en: t("actions.delete"), de: "Löschen" },
      shortcut: "F4",
      isEnabled: (s) => !!s.recordId && s.entity === "article",
      handler: (s) => {
        if (!s.recordId) return;
        setDeleteId(s.recordId);
        setDeleteConfirm(true);
      },
    });
    const unregDup = registerCommand({
      id: "duplicate-record",
      scope: "context",
      group: "recordOps",
      label: { en: "Duplicate", de: "Duplizieren" },
      shortcut: "F8",
      isEnabled: (s) => !!s.recordId && s.entity === "article",
      handler: async (s) => {
        if (!s.recordId) return;
        const source = await entityGet<Record<string, any>>("article", s.recordId).catch(
          () => null,
        );
        if (!source) return;
        const { articleId: _id, ...copy } = source;
        await entitySave("article", null, copy);
        queryClient.invalidateQueries({ queryKey: ["data", "article"] });
      },
    });
    return () => {
      unregF3();
      unregEdit();
      unregF4();
      unregDup();
    };
  }, [openCreateDialog, registerCommand, t, queryClient]);

  const selectedArticle = useMemo(
    () => articles.find((a: any) => a.articleId === activeArticleId),
    [articles, activeArticleId],
  );
  const selectedArticleLabel =
    selectedArticle?.name ?? t("nav.articles", { defaultValue: "Articles" });
  const modalOpen = showCreate || showEdit || deleteConfirm;

  const patchEntity = useCallback(
    (entityName: string, id: string, body: Record<string, unknown>) =>
      entitySave(entityName, id, body),
    [],
  );

  const applyCreateSalesDraft = useCallback(
    async (articleId: string) => {
      const variantRows = await entityList<any>("articleVariant", { articleId });
      const defaultVariant =
        variantRows.find((row: any) => row.optionValueHash === DEFAULT_VARIANT_OPTION_VALUE_HASH) ??
        variantRows[0] ??
        null;

      if (createSalesDraft.trackingMode) {
        await patchEntity("article", articleId, {
          trackingMode: createSalesDraft.trackingMode,
        });
      }

      if (defaultVariant?.variantId) {
        const variantPatch: Record<string, unknown> = {};
        if (createSalesDraft.price) variantPatch.price = createSalesDraft.price;
        if (createSalesDraft.ean) variantPatch.ean = createSalesDraft.ean;
        if (createSalesDraft.weight) variantPatch.weight = createSalesDraft.weight;
        if (!createSalesDraft.isActive) variantPatch.isActive = false;

        if (Object.keys(variantPatch).length > 0) {
          await patchEntity("articleVariant", defaultVariant.variantId, variantPatch);
        }
      }
    },
    [
      createSalesDraft.ean,
      createSalesDraft.isActive,
      createSalesDraft.price,
      createSalesDraft.trackingMode,
      createSalesDraft.weight,
      patchEntity,
    ],
  );

  const selectTreeNode = useCallback(
    (id: string) => {
      const node = treeNodes.find((item) => item.id === id);
      setSubCrumb(node?.label);
      setSelectedGroupId(node?.id === "ALL" ? null : (node?.id ?? null));
      gridState.setPage(1);
    },
    [gridState, setSubCrumb, treeNodes],
  );

  const articleGridColumns = useMemo<ColumnDef<any>[]>(
    () => [
      {
        key: "primaryImageId",
        header: t("article.image", { defaultValue: "Bild" }),
        sortable: false,
        render: (r: any) => {
          if (!r.primaryImageId) {
            return (
              <div className="flex size-7 items-center justify-center rounded border border-hairline bg-canvas-soft text-ink-mute">
                <ImageIcon className="size-3.5" />
              </div>
            );
          }
          return (
            <img
              src={`/api/storage/article-images/${r.primaryImageId}?v=${encodeURIComponent(r.primaryImageId)}`}
              alt={r.name}
              className="size-7 rounded border border-hairline object-cover shadow-sm"
              loading="lazy"
            />
          );
        },
      },
      {
        key: "articleNo",
        header: t("articleView.table.no"),
        sortable: true,
        render: (r: any) => (
          <span className="font-mono text-ink-mute tabular-nums">{r.articleNo}</span>
        ),
      },
      { key: "name", header: t("articleView.table.name"), sortable: true },
      {
        key: "baseUnitId",
        header: t("articleView.table.unit"),
        type: "relation",
        render: (r: any) => <span>{unitMap.get(r.baseUnitId) ?? "—"}</span>,
        renderValue: (r: any) => unitMap.get(r.baseUnitId) ?? "",
        getSearchValue: (r: any) => unitMap.get(r.baseUnitId) ?? "",
        relation: {
          entity: "unit",
          fkField: "baseUnitId",
          labelField: "code",
          mode: "lookup-eq",
          resolveLabelToId: (label: string) => {
            const match = units?.find((u: any) =>
              u.code?.toLowerCase().includes(label.toLowerCase()),
            );
            return match ? match.unitId : null;
          },
        },
      },
      {
        key: "articleGroupId",
        header: t("articleView.table.group"),
        type: "relation",
        render: (r: any) => <span>{groupMap.get(r.articleGroupId) ?? "—"}</span>,
        renderValue: (r: any) => groupMap.get(r.articleGroupId) ?? "",
        getSearchValue: (r: any) => groupMap.get(r.articleGroupId) ?? "",
        relation: {
          entity: "articleGroup",
          fkField: "articleGroupId",
          labelField: "name",
          mode: "lookup-eq",
          resolveLabelToId: (label: string) => {
            const match = groups?.find((g: any) =>
              g.label?.toLowerCase().includes(label.toLowerCase()),
            );
            return match ? match.id : null;
          },
        },
      },
      {
        key: "trackingMode",
        header: t("articleView.table.tracking"),
        render: (r: any) => (
          <span className="font-mono text-[11px] text-ink-mute">{r.trackingMode ?? "—"}</span>
        ),
      },
      {
        key: "bomType",
        header: "BOM",
        render: (r: any) => (
          <span className="font-mono text-[11px] text-ink-mute">{r.bomType ?? "—"}</span>
        ),
      },
    ],
    [groupMap, t, unitMap, groups, units],
  );

  const movementGridColumns = useMemo(
    () => [
      {
        key: "movementDate",
        header: "Date",
        render: (r: any) => <span className="tabular-nums">{formatDate(r.movementDate)}</span>,
      },
      {
        key: "movementType",
        header: "Type",
        render: (r: any) => <span className="font-mono">{r.movementType}</span>,
      },
      {
        key: "qtyDelta",
        header: "Qty",
        isNumeric: true,
        render: (r: any) => <span className="tabular-nums">{r.qtyDelta}</span>,
      },
      { key: "referenceText", header: "Reference" },
      {
        key: "batchNo",
        header: "Batch",
        render: (r: any) => <span className="font-mono text-[12px]">{r.batchNo ?? "—"}</span>,
      },
    ],
    [],
  );

  const dependentTabs = useMemo(
    () => [
      {
        id: "details",
        label: t("articleView.tabs.details"),
        content: (
          <div className="flex h-full flex-col gap-3 overflow-auto p-3">
            <InspectorPanel
              title={selectedArticle?.name ?? t("nav.articles")}
              recordId={activeArticleId ?? undefined}
              sections={[
                {
                  title: t("articleView.tabs.details"),
                  fields: [
                    {
                      label: t("articleView.table.no"),
                      value: (
                        <span className="font-mono tabular-nums">{selectedArticle?.articleNo}</span>
                      ),
                    },
                    { label: t("articleView.table.name"), value: selectedArticle?.name },
                    {
                      label: t("articleView.table.unit"),
                      value: selectedArticle?.baseUnitId
                        ? (unitMap.get(selectedArticle.baseUnitId) ?? selectedArticle.baseUnitId)
                        : "—",
                    },
                    {
                      label: t("articleView.table.group"),
                      value: selectedArticle?.articleGroupId
                        ? (groupMap.get(selectedArticle.articleGroupId) ??
                          selectedArticle.articleGroupId)
                        : "—",
                    },
                  ],
                },
              ]}
            />
            {activeArticleId && (
              <ArticleSalesBlock
                key={activeDefaultVariant?.variantId ?? activeArticleId}
                defaultVariant={activeDefaultVariant}
                articleRecord={selectedArticle}
                draft={EMPTY_SALES_DRAFT}
                onDraftChange={() => undefined}
              />
            )}
          </div>
        ),
      },
      {
        id: "inventory",
        label: t("articleView.tabs.inventory"),
        count: movements.length || undefined,
        content: (
          <DataGrid
            entityName="inventoryMovement"
            panelId="inventory-grid"
            data={movements}
            keyExtractor={(row: any) => row.inventoryMovementId || row.id}
            title={t("articleView.inventory.title")}
            toolbar={false}
            columns={movementGridColumns}
            emptyTitle={t("empty.title")}
            emptySubtitle={t("articleView.inventory.title")}
            className="h-full rounded-none border-none"
          />
        ),
      },
      {
        id: "statistics",
        label: t("stats.revenue"),
        content: (
          <div className="h-full overflow-auto">
            {!articleStats || articleStats.revenueByPeriod.length === 0 ? (
              <div className="flex h-24 items-center justify-center text-[13px] text-ink-mute">
                {t("empty.title")}
              </div>
            ) : (
              <table className="w-full table-fixed border-collapse">
                <thead>
                  <tr className="h-8 border-b border-hairline">
                    <th className="px-3 py-0 text-left text-[11px] font-medium tracking-wider text-ink-mute uppercase">
                      {t("stats.fiscalYear")}
                    </th>
                    <th className="px-3 py-0 text-left text-[11px] font-medium tracking-wider text-ink-mute uppercase">
                      {t("stats.period")}
                    </th>
                    <th className="px-3 py-0 text-right text-[11px] font-medium tracking-wider text-ink-mute uppercase">
                      {t("stats.revenue")}
                    </th>
                    <th className="px-3 py-0 text-right text-[11px] font-medium tracking-wider text-ink-mute uppercase">
                      Menge
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {articleStats.revenueByPeriod.map((row) => (
                    <tr
                      key={`${row.fiscal_year}-${row.period_no}`}
                      className="h-9 border-b border-hairline last:border-0"
                    >
                      <td className="px-3 text-[13px] tabular-nums">{row.fiscal_year}</td>
                      <td className="px-3 text-[13px] tabular-nums">{row.period_no}</td>
                      <td className="px-3 text-right font-mono text-[13px] tabular-nums">
                        {new Intl.NumberFormat("de-DE", {
                          style: "currency",
                          currency: "EUR",
                        }).format(Number(row.total_amount_net))}
                      </td>
                      <td className="px-3 text-right font-mono text-[13px] tabular-nums">
                        {Number(row.total_qty).toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ),
      },
      {
        id: "stock-ledger",
        label: t("stats.stockLedger"),
        content: activeArticleId ? (
          <StockLedgerTable articleId={activeArticleId} />
        ) : (
          <div className="flex h-24 items-center justify-center text-[13px] text-ink-mute">
            {t("empty.title")}
          </div>
        ),
      },
      {
        id: "langtexte",
        label: t("langtextEditor.title", { defaultValue: "Langtexte" }),
        content: (
          <div className="h-full p-2">
            <LangTextRecordPanel
              entityName="article"
              recordId={activeArticleId}
              title={t("langtextEditor.title", { defaultValue: "Langtexte" })}
              fields={ARTICLE_LANGTEXT_FIELDS}
              className="h-full"
            />
          </div>
        ),
      },
      {
        id: "variants",
        label: t("article.variants", { defaultValue: "Varianten" }),
        content: (
          <ArticleVariantsAndOptionsTab
            key={activeArticleId ?? "none"}
            articleId={activeArticleId}
            articleLabel={selectedArticleLabel}
            articleNo={selectedArticle?.articleNo ?? null}
          />
        ),
      },
    ],
    [
      selectedArticle,
      activeArticleId,
      activeDefaultVariant,
      selectedArticleLabel,
      unitMap,
      groupMap,
      movements,
      movementGridColumns,
      t,
      articleStats,
    ],
  );

  useEffect(() => {
    const navigateTree = (delta: number) => {
      if (treeNodes.length === 0) return;
      const currentId = selectedGroupId ?? "ALL";
      const currentIndex = treeNodes.findIndex((node) => node.id === currentId);
      const base = currentIndex < 0 ? (delta > 0 ? -1 : treeNodes.length) : currentIndex;
      const nextIndex = (base + delta + treeNodes.length) % treeNodes.length;
      const nextNode = treeNodes[nextIndex];
      if (!nextNode) return;
      selectTreeNode(nextNode.id);
      restoreArticleGrid();
    };

    const unregDown = registerCommand({
      id: "article-tree-nav-down",
      scope: "context",
      group: "navigation",
      label: { en: "Next Tree Item", de: "Nächster Eintrag" },
      shortcut: "Ctrl+ArrowDown",
      isEnabled: () => !modalOpen && treeNodes.length > 0,
      handler: () => navigateTree(1),
    });
    const unregUp = registerCommand({
      id: "article-tree-nav-up",
      scope: "context",
      group: "navigation",
      label: { en: "Previous Tree Item", de: "Vorheriger Eintrag" },
      shortcut: "Ctrl+ArrowUp",
      isEnabled: () => !modalOpen && treeNodes.length > 0,
      handler: () => navigateTree(-1),
    });

    return () => {
      unregDown();
      unregUp();
    };
  }, [
    modalOpen,
    registerCommand,
    restoreArticleGrid,
    selectTreeNode,
    selectedGroupId,
    treeNodes,
    treeNodes.length,
  ]);

  const handleCreateFieldChange = useCallback(
    async (key: string, value: any, _formData: any, setFormData: any) => {
      if (key !== "articleGroupId" || !value) return;
      const groupData = await entityGet<Record<string, any>>("articleGroup", value).catch(
        () => null,
      );
      if (!groupData) return;
      const group = Array.isArray(groupData) ? (groupData[0] ?? {}) : (groupData ?? {});
      const isBlank = (next: unknown) => next === undefined || next === null || next === "";
      setFormData((curr: any) => {
        const next = { ...curr };
        const fieldMap = {
          taxClassId: group.taxClassId,
          baseUnitId: group.baseUnitId,
          salesUnitId: group.salesUnitId,
          purchaseUnitId: group.purchaseUnitId,
          trackingMode: group.trackingMode === "none" ? null : group.trackingMode,
          bomType: group.bomType,
        } as const;
        for (const [field, defaultValue] of Object.entries(fieldMap)) {
          if (isBlank(curr[field]) && !isBlank(defaultValue)) {
            next[field] = defaultValue;
          }
        }
        return next;
      });
    },
    [],
  );

  const handleCreateSaved = useCallback(
    (record: any) => {
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ["data", "article"] });
      void (async () => {
        if (record?.articleId) {
          try {
            await applyCreateSalesDraft(record.articleId);
            await queryClient.invalidateQueries({
              queryKey: ["data", "articleVariant", record.articleId],
            });
          } catch (err) {
            toast.error(
              err instanceof Error && err.message
                ? err.message
                : "Failed to apply sales values to the default variant",
            );
          }
        }
      })();
      setCreateSalesDraft(EMPTY_SALES_DRAFT);
      restoreArticleGrid(record?.articleId ?? record?.id ?? null);
    },
    [applyCreateSalesDraft, queryClient, restoreArticleGrid],
  );

  const handleEditSaved = useCallback(
    (record: any) => {
      setShowEdit(false);
      queryClient.invalidateQueries({ queryKey: ["data", "article"] });
      restoreArticleGrid(record?.articleId ?? record?.id ?? activeArticleId);
    },
    [activeArticleId, queryClient, restoreArticleGrid],
  );

  return (
    <>
      <TriViewWorkspace
        navigationTree={
          <NavigationTree
            entityName="articleGroup"
            panelId="article-tree"
            data={treeNodes}
            header={t("tree.groups")}
            isLoading={isTreeLoading}
            defaultExpandDepth={2}
            onSelect={selectTreeNode}
            onSelectCommit={() => restoreArticleGrid()}
          />
        }
        primaryGrid={
          <DataGrid
            ref={articleGridRef}
            entityName="article"
            panelId="article-grid"
            data={articles}
            isLoading={isDataLoading}
            keyExtractor={(row: any) => row.articleId}
            title={t("nav.articles")}
            columns={articleGridColumns}
            totalCount={articleData?.total}
            page={gridState.page}
            pageSize={gridState.pageSize}
            sort={gridState.sort}
            onPageChange={gridState.setPage}
            onPageSizeChange={gridState.setPageSize}
            onSortChange={gridState.setSort}
            search={gridState.search}
            onSearchChange={gridState.setSearch}
            filters={gridState.filters}
            onFiltersChange={gridState.setFilters}
            selectable
            bulkActions={[
              {
                label: "Delete",
                variant: "destructive" as const,
                onClick: async (keys: string[]) => {
                  try {
                    await Promise.all(keys.map((id) => entityDelete("article", id)));
                    queryClient.invalidateQueries({ queryKey: ["data", "article"] });
                  } catch (err) {
                    toast.error(
                      err instanceof Error && err.message
                        ? err.message
                        : t("form.fkViolationError"),
                    );
                  }
                },
              },
            ]}
            onRowOpen={() => setShowEdit(true)}
            emptyTitle="No articles yet."
            emptySubtitle="Create the first article in this group."
            emptyAction={{
              label: `${t("actions.new")} Article`,
              kbd: "F3",
              onClick: openCreateDialog,
            }}
            className="h-full rounded-none border-none"
          />
        }
        dependentContext={<ContextTabs tabs={dependentTabs} />}
      />

      {/* Delete confirm dialog */}
      <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <div className="flex flex-col gap-5 p-6">
            <div>
              <h3 className="text-[15px] font-medium text-ink">{t("form.deleteConfirmTitle")}</h3>
              <p className="mt-1 text-[13px] text-ink-mute">{t("form.deleteConfirmBody")}</p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="h-8 rounded border border-hairline px-4 text-[13px] hover:bg-canvas-soft"
                onClick={() => setDeleteConfirm(false)}
              >
                {t("actions.cancel")}
              </button>
              <button
                type="button"
                className="h-8 rounded bg-destructive px-4 text-[13px] text-white hover:opacity-90"
                onClick={async () => {
                  if (!deleteId) return;
                  try {
                    await entityDelete("article", deleteId);
                  } catch (err) {
                    toast.error(
                      (err instanceof Error && err.message) || t("form.fkViolationError"),
                    );
                    return;
                  }
                  setDeleteConfirm(false);
                  setDeleteId(null);
                  queryClient.invalidateQueries({ queryKey: ["data", "article"] });
                  toast.success(t("form.deleteSuccess"));
                }}
              >
                {t("actions.delete")}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sw-root max-w-2xl overflow-hidden p-0" variant="form">
          <EntityMask
            entityName="article"
            mode="create"
            title="New Article"
            postFieldsSection={
              <ArticleSalesBlock
                key="draft"
                defaultVariant={null}
                draft={createSalesDraft}
                onDraftChange={setCreateSalesDraft}
              />
            }
            fieldOverrides={ARTICLE_EDIT_FIELD_OVERRIDES}
            onCancel={() => setShowCreate(false)}
            onFieldChange={handleCreateFieldChange}
            onSaved={handleCreateSaved}
            className="rounded-none border-none shadow-none"
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="h-[85vh] max-w-7xl overflow-hidden p-0">
          <EntityMask
            entityName="article"
            mode="edit"
            layout="single"
            recordId={activeArticleId ?? undefined}
            postFieldsSection={
              <ArticleSalesBlock
                key={activeDefaultVariant?.variantId ?? activeArticleId ?? "no-variant"}
                defaultVariant={activeDefaultVariant}
                articleRecord={selectedArticle}
                draft={EMPTY_SALES_DRAFT}
                onDraftChange={() => undefined}
              />
            }
            fieldOverrides={ARTICLE_EDIT_FIELD_OVERRIDES}
            onCancel={() => setShowEdit(false)}
            onSaved={handleEditSaved}
            embedded
            childLayout="side"
            childSection={(record, onChange) => (
              <ContextTabs
                defaultValue="langtexte"
                tabs={[
                  {
                    id: "langtexte",
                    label: t("langtextEditor.title", { defaultValue: "Langtexte" }),
                    content: (
                      <div className="h-full p-2">
                        <LangTextRecordPanel
                          entityName="article"
                          recordId={activeArticleId}
                          title={t("langtextEditor.title", { defaultValue: "Langtexte" })}
                          fields={ARTICLE_LANGTEXT_FIELDS}
                          className="h-full"
                          controlledValues={{
                            notiztext: record.notiztext as string,
                            langtext: record.langtext as string,
                            kurzbeschreibung: record.kurzbeschreibung as string,
                            warntext: record.warntext as string,
                          }}
                          onControlledChange={(field, value) => onChange(field, value)}
                        />
                      </div>
                    ),
                  },
                  {
                    id: "bestand",
                    label: t("articleView.tabs.inventory"),
                    content: (
                      <div className="h-full overflow-hidden rounded-md border border-hairline bg-canvas">
                        <Tabs defaultValue="bestand">
                          <TabsList
                            variant="line"
                            className="h-8 w-full justify-start rounded-none border-b border-hairline px-2"
                          >
                            <TabsTrigger value="bestand" className="h-7 text-[12px]">
                              Bestand
                            </TabsTrigger>
                            <TabsTrigger value="journal" className="h-7 text-[12px]">
                              Journal
                            </TabsTrigger>
                          </TabsList>
                          <TabsContent value="bestand" className="p-0">
                            <InventoryBalanceTable articleId={record.articleId as string} />
                          </TabsContent>
                          <TabsContent value="journal" className="p-0">
                            <StockLedgerTable articleId={record.articleId as string} />
                          </TabsContent>
                        </Tabs>
                      </div>
                    ),
                  },
                  {
                    id: "bilder",
                    label: t("article.images", { defaultValue: "Bilder" }),
                    content: activeArticleId ? (
                      <ArticleImageStrip
                        articleId={(record.articleId as string) ?? activeArticleId}
                        primaryImageId={
                          (record.primaryImageId as string | null) ??
                          selectedArticle?.primaryImageId ??
                          null
                        }
                        onRefreshArticle={() => {
                          queryClient.invalidateQueries({ queryKey: ["data", "article"] });
                        }}
                      />
                    ) : (
                      <div className="rounded-md border border-dashed border-hairline px-3 py-4 text-[12px] text-ink-mute">
                        {t("empty.title")}
                      </div>
                    ),
                  },
                  {
                    id: "varianten",
                    label: t("article.variants", { defaultValue: "Varianten" }),
                    content: (
                      <ArticleVariantsAndOptionsTab
                        key={activeArticleId ?? "none"}
                        articleId={activeArticleId}
                        articleLabel={selectedArticleLabel}
                        articleNo={selectedArticle?.articleNo ?? null}
                      />
                    ),
                  },
                ]}
              />
            )}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
