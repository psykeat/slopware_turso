import { ArticleImageStrip } from "@repo/ui/components/article-image-strip";
import { BatchInventoryTable } from "@repo/ui/components/batch-inventory-table";
import { BomEditor } from "@repo/ui/components/bom-editor";
import { ContextTabs } from "@repo/ui/components/context-tabs";
import { DataGrid, type DataGridHandle, type ColumnDef } from "@repo/ui/components/data-grid";
import { Dialog, DialogContent } from "@repo/ui/components/dialog";
import { EntityMask } from "@repo/ui/components/entity-mask";
import { InlineEditGrid } from "@repo/ui/components/inline-edit-grid";
import { InspectorPanel } from "@repo/ui/components/inspector-panel";
import { InventoryBalanceTable } from "@repo/ui/components/inventory-balance-table";
import { LangTextRecordPanel } from "@repo/ui/components/langtext-record-panel";
import { NavigationTree, type TreeNode } from "@repo/ui/components/navigation-tree";
import { SerialInventoryTable } from "@repo/ui/components/serial-inventory-table";
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

import { useGridUrlState } from "#/hooks/use-grid-url-state";

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

const ARTICLE_VARIANT_FIELD_OVERRIDES = [
  { key: "tenantId", visible: false },
  { key: "articleId", visible: false },
  { key: "optionValueHash", visible: false },
  { key: "createdAt", visible: false },
  { key: "updatedAt", visible: false },
];

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
  const [bulkPriceValue, setBulkPriceValue] = useState("");
  const [bulkPriceVariantIds, setBulkPriceVariantIds] = useState<string[]>([]);
  const [bulkPriceSubmitting, setBulkPriceSubmitting] = useState(false);

  const { data: optionRows = EMPTY_ARRAY, isLoading: isOptionsLoading } = useQuery({
    queryKey: ["data", "articleOption", articleId],
    queryFn: async () => {
      const res = await fetch(`/api/data/articleOption?articleId=${articleId}`);
      if (!res.ok) throw new Error("Failed to fetch article options");
      return res.json() as Promise<any[]>;
    },
    enabled: !!articleId,
    placeholderData: keepPreviousData,
  });

  const { data: variantRows = EMPTY_ARRAY, isLoading: isVariantsLoading } = useQuery({
    queryKey: ["data", "articleVariant", articleId],
    queryFn: async () => {
      const res = await fetch(`/api/data/articleVariant?articleId=${articleId}`);
      if (!res.ok) throw new Error("Failed to fetch article variants");
      return res.json() as Promise<any[]>;
    },
    enabled: !!articleId,
    placeholderData: keepPreviousData,
  });
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

  const openVariantEditor = useCallback((row: any) => {
    setVariantEditId(row.variantId);
    setShowVariantEdit(true);
  }, []);

  const variantById = useMemo(
    () => new Map(variantRows.map((row: any) => [row.variantId, row])),
    [variantRows],
  );

  const fetchJson = useCallback(async (url: string, init?: RequestInit) => {
    const res = await fetch(url, init);
    if (!res.ok) {
      throw new Error((await res.text()) || `Request failed with status ${res.status}`);
    }
    if (res.status === 204) return null;
    return await res.json();
  }, []);

  const patchEntity = useCallback(
    async (entityName: string, id: string, body: Record<string, unknown>) => {
      return await fetchJson(`/api/data/${entityName}/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    },
    [fetchJson],
  );

  const refreshVariants = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["data", "articleVariant", articleId] });
  }, [articleId, queryClient]);

  const patchVariantInventorySku = useCallback(
    async (variantId: string, sku: string) => {
      const items = await fetchJson(
        `/api/data/inventoryItem?variantId=${encodeURIComponent(variantId)}&limit=1`,
      );
      const item = Array.isArray(items) ? items[0] : ((items as any)?.data?.[0] ?? null);
      if (!item?.itemId) return;
      await patchEntity("inventoryItem", item.itemId, { sku });
    },
    [fetchJson, patchEntity],
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
      const current = Number(row.price ?? 0);
      const next = bulkPriceMode === "adjust" ? current * (1 + parsed / 100) : parsed;
      return {
        variantId: row.variantId as string,
        sku: row.sku as string,
        current,
        next: Math.round(next * 10000) / 10000,
      };
    });
  }, [bulkPriceMode, bulkPriceValue, bulkVariantRows, showBulkPriceDialog]);

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
            const suggestedSku = `${articleNo}-${row.optionValueHash}`;
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
    setBulkPriceMode("set");
    setBulkPriceValue("");
    setShowBulkPriceDialog(true);
  }, []);

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
          const current = Number(row.price ?? 0);
          const nextPrice = bulkPriceMode === "adjust" ? current * (1 + parsed / 100) : parsed;
          const normalized = Math.round(nextPrice * 10000) / 10000;
          await patchEntity("articleVariant", row.variantId, { price: String(normalized) });
        }),
      );

      await refreshVariants();
      setShowBulkPriceDialog(false);
      setBulkPriceVariantIds([]);
      toast.success(
        `Updated prices for ${bulkVariantRows.length} variant${bulkVariantRows.length === 1 ? "" : "s"}.`,
      );
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Failed to update prices");
      throw err;
    } finally {
      setBulkPriceSubmitting(false);
    }
  }, [bulkPriceMode, bulkPriceValue, bulkVariantRows, patchEntity, refreshVariants]);

  const handleVariantSaved = useCallback(
    (record: unknown) => {
      setShowVariantEdit(false);
      queryClient.invalidateQueries({ queryKey: ["data", "articleVariant", articleId] });
      variantGridRef.current?.restoreFocus(
        (record as any)?.variantId ?? (record as any)?.id ?? variantEditId ?? null,
      );
    },
    [articleId, queryClient, variantEditId],
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

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-auto p-3">
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
        <div className="border-b border-hairline bg-canvas-soft px-3 py-2">
          <div className="text-[11px] font-medium tracking-wider text-ink-mute uppercase">
            {t("article.variants", { defaultValue: "Variants" })}
          </div>
          <div className="mt-0.5 text-[12px] text-ink-secondary">
            {articleLabel || t("nav.articles", { defaultValue: "Articles" })}
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <DataGrid
            ref={variantGridRef}
            entityName="articleVariant"
            panelId="article-variant-grid"
            data={variantRows}
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
                label: "Suggest SKU",
                onClick: handleSuggestSku,
              },
              {
                label: "Update prices",
                onClick: handleOpenBulkPriceUpdate,
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

      <Dialog open={showVariantEdit} onOpenChange={setShowVariantEdit}>
        <DialogContent className="sw-root max-w-2xl overflow-hidden p-0" variant="form">
          <EntityMask
            entityName="articleVariant"
            mode="edit"
            recordId={variantEditId}
            title={t("article.variants.edit", { defaultValue: "Edit Variant" })}
            fieldOverrides={ARTICLE_VARIANT_FIELD_OVERRIDES}
            onCancel={() => setShowVariantEdit(false)}
            onSaved={handleVariantSaved}
            className="rounded-none border-none shadow-none"
          />
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
                {t("article.bulkUpdatePrices", { defaultValue: "Update variant prices" })}
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
                  <option value="set">Set absolute price</option>
                  <option value="adjust">Adjust by percent</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] text-ink">
                <span className="text-[12px] font-medium text-ink-secondary">
                  {bulkPriceMode === "adjust" ? "Percent" : "Price"}
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
  const { data: articleData, isLoading: isDataLoading } = useQuery({
    queryKey: [
      "data",
      "article",
      selectedGroupId,
      gridState.queryParams.page,
      gridState.queryParams.limit,
      gridState.queryParams.orderBy,
      gridState.queryParams.search,
      gridState.queryParams.filters,
    ],
    queryFn: async () => {
      const p = new URLSearchParams({
        paginated: "true",
        page: String(gridState.queryParams.page),
        limit: String(gridState.queryParams.limit),
      });
      if (selectedGroupId) p.set("articleGroupId", selectedGroupId);
      if (gridState.queryParams.orderBy) p.set("orderBy", gridState.queryParams.orderBy);
      if (gridState.queryParams.search) p.set("search", gridState.queryParams.search);
      if (gridState.queryParams.filters)
        p.set("filters", JSON.stringify(gridState.queryParams.filters));
      const res = await fetch(`/api/data/article?${p}`);
      if (!res.ok) throw new Error("Failed to fetch articles");
      return res.json() as Promise<{ data: any[]; total: number }>;
    },
  });

  const articles = useMemo(() => articleData?.data ?? EMPTY_ARRAY, [articleData]);

  // Fetch article groups
  const { data: groups = EMPTY_ARRAY, isLoading: isTreeLoading } = useQuery({
    queryKey: ["data", "articleGroup"],
    queryFn: async () => {
      const res = await fetch("/api/data/articleGroup");
      if (!res.ok) throw new Error("Failed to fetch article groups");
      return res.json();
    },
    select: useCallback(
      (data: any[]) =>
        data.map(
          (g: any): TreeNode => ({
            id: g.articleGroupId,
            label: g.name || "Unnamed Group",
          }),
        ),
      [],
    ),
    placeholderData: keepPreviousData,
  });

  const { data: units = EMPTY_ARRAY } = useQuery({
    queryKey: ["data", "unit"],
    queryFn: async () => {
      const res = await fetch("/api/data/unit");
      if (!res.ok) throw new Error("Failed to fetch units");
      return res.json();
    },
    placeholderData: keepPreviousData,
  });

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
  const { data: movements = EMPTY_ARRAY } = useQuery({
    queryKey: ["data", "inventoryMovement", activeArticleId],
    queryFn: async () => {
      const res = await fetch(`/api/data/inventoryMovement?articleId=${activeArticleId}`);
      if (!res.ok) throw new Error("Failed to fetch inventory movements");
      return res.json();
    },
    enabled: !!activeArticleId,
    placeholderData: keepPreviousData,
  });

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

  // Register context commands
  useEffect(() => {
    const unregF3 = registerCommand({
      id: "create-record",
      scope: "context",
      group: "recordOps",
      label: { en: t("commands.newRecord"), de: "Neuer Datensatz" },
      shortcut: "F3",
      isEnabled: () => true,
      handler: () => setShowCreate(true),
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
        const srcRes = await fetch(`/api/data/article/${s.recordId}`);
        if (!srcRes.ok) return;
        const { articleId: _id, ...copy } = await srcRes.json();
        await fetch("/api/data/article", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(copy),
        });
        queryClient.invalidateQueries({ queryKey: ["data", "article"] });
      },
    });
    return () => {
      unregF3();
      unregEdit();
      unregF4();
      unregDup();
    };
  }, [registerCommand, t, queryClient]);

  const selectedArticle = useMemo(
    () => articles.find((a: any) => a.articleId === activeArticleId),
    [articles, activeArticleId],
  );
  const selectedArticleLabel =
    selectedArticle?.name ?? t("nav.articles", { defaultValue: "Articles" });
  const modalOpen = showCreate || showEdit || deleteConfirm;

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
                ],
              },
              {
                title: t("articleView.inventory.title"),
                fields: [
                  {
                    label: t("articleView.table.group"),
                    value: selectedArticle?.articleGroupId
                      ? (groupMap.get(selectedArticle.articleGroupId) ??
                        selectedArticle.articleGroupId)
                      : "—",
                  },
                  {
                    label: t("document.fields.warehouse"),
                    value: selectedArticle?.defaultWarehouseId,
                  },
                  {
                    label: t("articleView.table.tracking"),
                    value: selectedArticle?.trackingMode ? (
                      <span
                        className={
                          selectedArticle.trackingMode === "serial"
                            ? "inline-flex rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 font-mono text-[11px] text-emerald-800"
                            : "inline-flex rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 font-mono text-[11px] text-sky-800"
                        }
                      >
                        {selectedArticle.trackingMode}
                      </span>
                    ) : (
                      "—"
                    ),
                  },
                  {
                    label: "BOM",
                    value: selectedArticle?.bomType ? (
                      <span
                        className={
                          selectedArticle.bomType === "sales"
                            ? "inline-flex rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 font-mono text-[11px] text-amber-800"
                            : "inline-flex rounded-full border border-violet-300 bg-violet-50 px-2 py-0.5 font-mono text-[11px] text-violet-800"
                        }
                      >
                        {selectedArticle.bomType}
                      </span>
                    ) : (
                      "—"
                    ),
                  },
                ],
              },
            ]}
          />
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
        label: t("article.variantsAndOptions", { defaultValue: "Varianten & Optionen" }),
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
    const unregGenerateVariants = registerCommand({
      id: "generate-variants",
      scope: "context",
      group: "recordOps",
      label: {
        en: "Generate Variants",
        de: "Varianten erzeugen",
      },
      isEnabled: () => !!activeArticleId && !modalOpen,
      handler: async () => {
        if (!activeArticleId) return;
        try {
          const res = await fetch(`/api/articles/${activeArticleId}/generate-variants`, {
            method: "POST",
          });
          if (!res.ok) {
            throw new Error(await res.text());
          }
          const result = (await res.json()) as {
            createdVariants?: number;
            skippedVariants?: number;
          };
          await queryClient.invalidateQueries({
            queryKey: ["data", "articleVariant", activeArticleId],
          });
          toast.success(
            `Generated ${result.createdVariants ?? 0} variant${(result.createdVariants ?? 0) === 1 ? "" : "s"}${typeof result.skippedVariants === "number" ? ` (${result.skippedVariants} skipped)` : ""}`,
          );
        } catch (err) {
          toast.error(
            err instanceof Error && err.message ? err.message : "Failed to generate variants",
          );
        }
      },
    });

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
      unregGenerateVariants();
      unregDown();
      unregUp();
    };
  }, [
    activeArticleId,
    modalOpen,
    registerCommand,
    queryClient,
    restoreArticleGrid,
    selectTreeNode,
    selectedGroupId,
    treeNodes,
    treeNodes.length,
  ]);

  const handleCreateFieldChange = useCallback(
    async (key: string, value: any, _formData: any, setFormData: any) => {
      if (key !== "articleGroupId" || !value) return;
      const res = await fetch(`/api/data/articleGroup/${value}`);
      if (!res.ok) return;
      const groupData = await res.json();
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
      restoreArticleGrid(record?.articleId ?? record?.id ?? null);
    },
    [queryClient, restoreArticleGrid],
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
                    await Promise.all(
                      keys.map(async (id) => {
                        const res = await fetch(`/api/data/article/${id}`, {
                          method: "DELETE",
                        });
                        if (!res.ok) throw new Error(await res.text());
                      }),
                    );
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
              onClick: () => setShowCreate(true),
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
                  const res = await fetch(`/api/data/article/${deleteId}`, {
                    method: "DELETE",
                  });
                  if (!res.ok) {
                    const message = await res.text();
                    toast.error(message || t("form.fkViolationError"));
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
            fieldOverrides={ARTICLE_EDIT_FIELD_OVERRIDES}
            onCancel={() => setShowEdit(false)}
            onSaved={handleEditSaved}
            embedded
            childLayout="side"
            childSection={(record, onChange) => (
              <div className="flex flex-col gap-6">
                <LangTextRecordPanel
                  entityName="article"
                  recordId={activeArticleId}
                  title={t("langtextEditor.title", { defaultValue: "Langtexte" })}
                  fields={ARTICLE_LANGTEXT_FIELDS}
                  className="min-h-[220px]"
                  controlledValues={{
                    notiztext: record.notiztext as string,
                    langtext: record.langtext as string,
                    kurzbeschreibung: record.kurzbeschreibung as string,
                    warntext: record.warntext as string,
                  }}
                  onControlledChange={(field, value) => onChange(field, value)}
                />
                <div>
                  <div className="mb-2 text-[11px] font-medium tracking-wider text-ink-mute uppercase">
                    {t("article.movements", { defaultValue: "Lagerbewegungen" })}
                  </div>
                  <div className="overflow-hidden rounded-md border border-hairline bg-canvas">
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
                </div>

                {activeArticleId ? (
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
                )}

                {record.trackingMode === "serial" && (
                  <div>
                    <div className="mb-2 text-[11px] font-medium tracking-wider text-ink-mute uppercase">
                      Seriennummern Inventory
                    </div>
                    <div className="overflow-hidden rounded-md border border-hairline bg-canvas">
                      <SerialInventoryTable articleId={record.articleId as string} />
                    </div>
                  </div>
                )}

                {record.trackingMode === "batch" && (
                  <div>
                    <div className="mb-2 text-[11px] font-medium tracking-wider text-ink-mute uppercase">
                      Batch Inventory
                    </div>
                    <div className="overflow-hidden rounded-md border border-hairline bg-canvas">
                      <BatchInventoryTable articleId={record.articleId as string} />
                    </div>
                  </div>
                )}

                {(record.bomType === "sales" || record.bomType === "production") && (
                  <div>
                    <div className="mb-2 text-[11px] font-medium tracking-wider text-ink-mute uppercase">
                      {record.bomType === "sales"
                        ? "Handelsstücklisteneditor"
                        : "Produktionsstücklisteneditor"}
                    </div>
                    <div className="min-h-[300px] overflow-visible rounded-md border border-hairline bg-canvas">
                      <BomEditor articleId={record.articleId as string} />
                    </div>
                  </div>
                )}
              </div>
            )}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
