import { ArticleImageStrip } from "@repo/ui/components/article-image-strip";
import { BatchInventoryTable } from "@repo/ui/components/batch-inventory-table";
import { BomEditor } from "@repo/ui/components/bom-editor";
import { ContextTabs } from "@repo/ui/components/context-tabs";
import { DataGrid, type DataGridHandle } from "@repo/ui/components/data-grid";
import { Dialog, DialogContent } from "@repo/ui/components/dialog";
import { EntityMask } from "@repo/ui/components/entity-mask";
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

  const articleGridColumns = useMemo(
    () => [
      {
        key: "primaryImageId",
        header: "Bild",
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
        header: "No.",
        sortable: true,
        render: (r: any) => (
          <span className="font-mono text-ink-mute tabular-nums">{r.articleNo}</span>
        ),
      },
      { key: "name", header: "Name", sortable: true },
      {
        key: "baseUnitId",
        header: "Unit",
        render: (r: any) => <span>{unitMap.get(r.baseUnitId) ?? "—"}</span>,
      },
      {
        key: "articleGroupId",
        header: "Group",
        render: (r: any) => <span>{groupMap.get(r.articleGroupId) ?? "—"}</span>,
      },
      {
        key: "trackingMode",
        header: "Tracking",
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
    [unitMap, groupMap],
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
        label: "Details",
        content: (
          <InspectorPanel
            title={selectedArticle?.name ?? "Article"}
            recordId={activeArticleId ?? undefined}
            sections={[
              {
                title: "Identification",
                fields: [
                  {
                    label: "No.",
                    value: (
                      <span className="font-mono tabular-nums">{selectedArticle?.articleNo}</span>
                    ),
                  },
                  { label: "Name", value: selectedArticle?.name },
                  {
                    label: "Unit",
                    value: selectedArticle?.baseUnitId
                      ? (unitMap.get(selectedArticle.baseUnitId) ?? selectedArticle.baseUnitId)
                      : "—",
                  },
                ],
              },
              {
                title: "Inventory",
                fields: [
                  {
                    label: "Article Group",
                    value: selectedArticle?.articleGroupId
                      ? (groupMap.get(selectedArticle.articleGroupId) ??
                        selectedArticle.articleGroupId)
                      : "—",
                  },
                  { label: "Warehouse", value: selectedArticle?.defaultWarehouseId },
                  {
                    label: "Tracking",
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
        label: "Inventory",
        count: movements.length || undefined,
        content: (
          <DataGrid
            entityName="inventoryMovement"
            panelId="inventory-grid"
            data={movements}
            keyExtractor={(row: any) => row.inventoryMovementId || row.id}
            title="Inventory Movements"
            toolbar={false}
            columns={movementGridColumns}
            emptyTitle="No movements recorded."
            emptySubtitle="Inventory movements appear here when stock changes."
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
        label: "Langtexte",
        content: (
          <div className="h-full p-2">
            <LangTextRecordPanel
              entityName="article"
              recordId={activeArticleId}
              title="Langtexte"
              fields={ARTICLE_LANGTEXT_FIELDS}
              className="h-full"
            />
          </div>
        ),
      },
    ],
    [
      selectedArticle,
      activeArticleId,
      unitMap,
      groupMap,
      movements,
      movementGridColumns,
      t,
      articleStats,
      queryClient,
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
                  title="Langtexte"
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
                    Lagerbewegungen
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
