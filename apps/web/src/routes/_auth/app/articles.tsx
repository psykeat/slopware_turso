import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useGridUrlState } from "#/hooks/use-grid-url-state";
import { useTranslation } from "react-i18next";
import { TriViewWorkspace } from "@repo/ui/components/triview-workspace";
import { NavigationTree, type TreeNode } from "@repo/ui/components/navigation-tree";
import { DataGrid, type DataGridHandle } from "@repo/ui/components/data-grid";
import { ContextTabs } from "@repo/ui/components/context-tabs";
import { EntityMask } from "@repo/ui/components/entity-mask";
import { InspectorPanel } from "@repo/ui/components/inspector-panel";
import { InventoryBalanceTable } from "@repo/ui/components/inventory-balance-table";
import { StockLedgerTable } from "@repo/ui/components/stock-ledger-table";
import { SerialInventoryTable } from "@repo/ui/components/serial-inventory-table";
import { BatchInventoryTable } from "@repo/ui/components/batch-inventory-table";
import { BomEditor } from "@repo/ui/components/bom-editor";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@repo/ui/components/tabs";
import { formatDate } from "@repo/ui/lib/formatters";
import { Dialog, DialogContent } from "@repo/ui/components/dialog";
import { useFocus } from "@repo/ui/platform/focus-manager";
import { useCommands } from "@repo/ui/platform/command-registry";
import { useActionBar } from "@repo/ui/platform/action-bar-context";
import { toast } from "sonner";

export const Route = createFileRoute("/_auth/app/articles")({
  component: ArticlesModule,
});

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
  const gridState = useGridUrlState({ defaultPageSize: 50 });

  useEffect(() => () => setSubCrumb(undefined), [setSubCrumb]);

  useEffect(() => {
    if (focusState.entity === "article" && focusState.recordId) {
      setActiveArticleId(focusState.recordId);
    }
  }, [focusState.entity, focusState.recordId]);

  const restoreArticleGrid = useCallback((recordId?: string | null) => {
    articleGridRef.current?.restoreFocus(recordId ?? activeArticleId ?? null);
  }, [activeArticleId]);

  // Fetch articles — paginated
  const { data: articleData, isLoading: isDataLoading } = useQuery({
    queryKey: ["data", "article", selectedGroupId, gridState.queryParams.page, gridState.queryParams.limit, gridState.queryParams.orderBy, gridState.queryParams.search, gridState.queryParams.filters],
    queryFn: async () => {
      const p = new URLSearchParams({
        paginated: "true",
        page: String(gridState.queryParams.page),
        limit: String(gridState.queryParams.limit),
      });
      if (selectedGroupId) p.set("articleGroupId", selectedGroupId);
      if (gridState.queryParams.orderBy) p.set("orderBy", gridState.queryParams.orderBy);
      if (gridState.queryParams.search) p.set("search", gridState.queryParams.search);
      if (gridState.queryParams.filters) p.set("filters", JSON.stringify(gridState.queryParams.filters));
      const res = await fetch(`/api/data/article?${p}`);
      if (!res.ok) throw new Error("Failed to fetch articles");
      return res.json() as Promise<{ data: any[]; total: number }>;
    },
  });

  const articles = useMemo(() => articleData?.data ?? [], [articleData]);

  // Fetch article groups
  const { data: groups = [], isLoading: isTreeLoading } = useQuery({
    queryKey: ["data", "articleGroup"],
    queryFn: async () => {
      const res = await fetch("/api/data/articleGroup");
      if (!res.ok) throw new Error("Failed to fetch article groups");
      const data = await res.json();
      return data.map((g: any): TreeNode => ({
        id: g.articleGroupId,
        label: g.name || "Unnamed Group",
      }));
    },
  });

  const groupMap = useMemo(() => new Map<string, string>(groups.map((g: TreeNode) => [g.id, g.label])), [groups]);

  // Fetch inventory movements for selected article (server-side FK filter)
  const { data: movements = [] } = useQuery({
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
    return () => { unregF3(); unregEdit(); unregF4(); unregDup(); };
  }, [registerCommand, t, queryClient]);

  const selectedArticle = articles.find((a: any) => a.articleId === activeArticleId);

  const dependentTabs = [
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
                { label: "No.", value: <span className="font-mono tabular-nums">{selectedArticle?.articleNo}</span> },
                { label: "Name", value: selectedArticle?.name },
                { label: "Unit", value: selectedArticle?.baseUnit },
              ],
            },
            {
              title: "Inventory",
              fields: [
                { label: "Article Group", value: selectedArticle?.articleGroupId },
                { label: "Warehouse", value: selectedArticle?.defaultWarehouseId },
                { label: "Tracking", value: selectedArticle?.trackingMode },
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
          columns={[
            { key: "movementDate", header: "Date", render: (r: any) => <span className="tabular-nums">{formatDate(r.movementDate)}</span> },
            { key: "movementType", header: "Type", render: (r: any) => <span className="font-mono">{r.movementType}</span> },
            { key: "qtyDelta", header: "Qty", isNumeric: true, render: (r: any) => <span className="tabular-nums">{r.qtyDelta}</span> },
            { key: "referenceText", header: "Reference" },
            { key: "batchNo", header: "Batch", render: (r: any) => <span className="font-mono text-[12px]">{r.batchNo ?? "—"}</span> },
          ]}
          emptyTitle="No movements recorded."
          emptySubtitle="Inventory movements appear here when stock changes."
          className="h-full border-none rounded-none"
        />
      ),
    },
    {
      id: "statistics",
      label: t("stats.revenue"),
      content: (
        <div className="overflow-auto h-full">
          {!articleStats || articleStats.revenueByPeriod.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-[13px] text-ink-mute">
              {t("empty.title")}
            </div>
          ) : (
            <table className="w-full table-fixed border-collapse">
              <thead>
                <tr className="h-8 border-b border-hairline">
                  <th className="text-[11px] uppercase tracking-wider font-medium text-ink-mute text-left px-3 py-0">
                    {t("stats.fiscalYear")}
                  </th>
                  <th className="text-[11px] uppercase tracking-wider font-medium text-ink-mute text-left px-3 py-0">
                    {t("stats.period")}
                  </th>
                  <th className="text-[11px] uppercase tracking-wider font-medium text-ink-mute text-right px-3 py-0">
                    {t("stats.revenue")}
                  </th>
                  <th className="text-[11px] uppercase tracking-wider font-medium text-ink-mute text-right px-3 py-0">
                    Menge
                  </th>
                </tr>
              </thead>
              <tbody>
                {articleStats.revenueByPeriod.map((row) => (
                  <tr key={`${row.fiscal_year}-${row.period_no}`} className="h-9 border-b border-hairline last:border-0">
                    <td className="px-3 tabular-nums text-[13px]">{row.fiscal_year}</td>
                    <td className="px-3 tabular-nums text-[13px]">{row.period_no}</td>
                    <td className="px-3 tabular-nums font-mono text-[13px] text-right">
                      {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(row.total_amount_net))}
                    </td>
                    <td className="px-3 tabular-nums font-mono text-[13px] text-right">
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
        <div className="flex items-center justify-center h-24 text-[13px] text-ink-mute">
          {t("empty.title")}
        </div>
      ),
    },
  ];

  return (
    <>
      <TriViewWorkspace
        navigationTree={
          <NavigationTree
            entityName="articleGroup"
            panelId="article-tree"
            data={groups}
            header={t("tree.groups")}
            isLoading={isTreeLoading}
            onSelect={(id) => {
              const group = groups.find((g: TreeNode) => g.id === id);
              setSubCrumb(group?.label);
              setSelectedGroupId(id);
              gridState.setPage(1);
            }}
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
            columns={[
              { key: "articleNo", header: "No.", sortable: true, render: (r: any) => <span className="font-mono tabular-nums text-ink-mute">{r.articleNo}</span> },
              { key: "name", header: "Name", sortable: true },
              { key: "baseUnit", header: "Unit" },
              { key: "articleGroupId", header: "Group", render: (r: any) => <span>{groupMap.get(r.articleGroupId) ?? "—"}</span> },
              { key: "trackingMode", header: "Tracking", render: (r: any) => <span className="font-mono text-[11px] text-ink-mute">{r.trackingMode ?? "—"}</span> },
              { key: "bomType", header: "BOM", render: (r: any) => <span className="font-mono text-[11px] text-ink-mute">{r.bomType ?? "—"}</span> },
            ]}
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
            bulkActions={[{
              label: "Archive",
              variant: "destructive" as const,
              onClick: async (keys: string[]) => {
                await Promise.all(keys.map(id =>
                  fetch(`/api/data/article/${id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ archived: true }),
                  })
                ));
                queryClient.invalidateQueries({ queryKey: ["data", "article"] });
              },
            }]}
            onRowOpen={() => setShowEdit(true)}
            emptyTitle="No articles yet."
            emptySubtitle="Create the first article in this group."
            emptyAction={{
              label: `${t("actions.new")} Article`,
              kbd: "F3",
              onClick: () => setShowCreate(true),
            }}
            className="h-full border-none rounded-none"
          />
        }
        dependentContext={<ContextTabs tabs={dependentTabs} />}
      />

      {/* Delete confirm dialog */}
      <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <div className="p-6 flex flex-col gap-5">
            <div>
              <h3 className="text-[15px] font-medium text-ink">{t("form.deleteConfirmTitle")}</h3>
              <p className="text-[13px] text-ink-mute mt-1">{t("form.deleteConfirmBody")}</p>
            </div>
            <div className="flex justify-end gap-2 flex-wrap">
              <button
                type="button"
                className="h-8 px-4 rounded text-[13px] border border-hairline hover:bg-canvas-soft"
                onClick={() => setDeleteConfirm(false)}
              >
                {t("actions.cancel")}
              </button>
              <button
                type="button"
                className="h-8 px-4 rounded text-[13px] bg-destructive text-white hover:opacity-90"
                onClick={async () => {
                  if (!deleteId) return;
                  await fetch(`/api/data/article/${deleteId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ archived: true }),
                  });
                  setDeleteConfirm(false);
                  setDeleteId(null);
                  queryClient.invalidateQueries({ queryKey: ["data", "article"] });
                  toast.success(t("form.archiveSuccess"));
                }}
              >
                {t("actions.archive")}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <EntityMask
            entityName="article"
            mode="create"
            title="New Article"
            fieldOverrides={ARTICLE_FIELD_OVERRIDES}
            onCancel={() => setShowCreate(false)}
            onSaved={(record) => {
              setShowCreate(false);
              queryClient.invalidateQueries({ queryKey: ["data", "article"] });
              restoreArticleGrid((record as any)?.articleId ?? (record as any)?.id ?? null);
            }}
            className="border-none shadow-none rounded-none"
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-7xl h-[85vh] p-0 overflow-hidden">
          <EntityMask
            entityName="article"
            mode="edit"
            layout="single"
            recordId={activeArticleId ?? undefined}
            fieldOverrides={ARTICLE_FIELD_OVERRIDES}
            onCancel={() => setShowEdit(false)}
            onSaved={(record) => {
              setShowEdit(false);
              queryClient.invalidateQueries({ queryKey: ["data", "article"] });
              restoreArticleGrid((record as any)?.articleId ?? (record as any)?.id ?? activeArticleId);
            }}
            embedded
            childLayout="side"
            childSection={(record) => (
              <div className="flex flex-col gap-6">
                <div>
                  <div className="text-[11px] font-medium text-ink-mute uppercase tracking-wider mb-2">Lagerbewegungen</div>
                  <div className="border border-hairline rounded-md overflow-hidden bg-canvas">
                    <Tabs defaultValue="bestand">
                      <TabsList variant="line" className="px-2 border-b border-hairline rounded-none w-full justify-start h-8">
                        <TabsTrigger value="bestand" className="text-[12px] h-7">Bestand</TabsTrigger>
                        <TabsTrigger value="journal" className="text-[12px] h-7">Journal</TabsTrigger>
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

                {record.trackingMode === "serial" && (
                  <div>
                    <div className="text-[11px] font-medium text-ink-mute uppercase tracking-wider mb-2">Seriennummern Inventory</div>
                    <div className="border border-hairline rounded-md overflow-hidden bg-canvas">
                      <SerialInventoryTable articleId={record.articleId as string} />
                    </div>
                  </div>
                )}

                {record.trackingMode === "batch" && (
                  <div>
                    <div className="text-[11px] font-medium text-ink-mute uppercase tracking-wider mb-2">Batch Inventory</div>
                    <div className="border border-hairline rounded-md overflow-hidden bg-canvas">
                      <BatchInventoryTable articleId={record.articleId as string} />
                    </div>
                  </div>
                )}

                {(record.bomType === "sales" || record.bomType === "production") && (
                  <div>
                    <div className="text-[11px] font-medium text-ink-mute uppercase tracking-wider mb-2">
                      {record.bomType === "sales" ? "Handelsstücklisteneditor" : "Produktionsstücklisteneditor"}
                    </div>
                    <div className="border border-hairline rounded-md overflow-visible bg-canvas min-h-[300px]">
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
