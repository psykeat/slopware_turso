import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { TriViewWorkspace } from "@repo/ui/components/triview-workspace";
import { NavigationTree, type TreeNode } from "@repo/ui/components/navigation-tree";
import { DataGrid } from "@repo/ui/components/data-grid";
import { ContextTabs } from "@repo/ui/components/context-tabs";
import { EntityMask } from "@repo/ui/components/entity-mask";
import { InspectorPanel } from "@repo/ui/components/inspector-panel";
import { InventoryBalanceTable } from "@repo/ui/components/inventory-balance-table";
import { StockLedgerTable } from "@repo/ui/components/stock-ledger-table";
import { formatMoney } from "@repo/ui/lib/formatters";
import { Dialog, DialogContent } from "@repo/ui/components/dialog";
import { useFocus } from "@repo/ui/platform/focus-manager";
import { useCommands } from "@repo/ui/platform/command-registry";
import { useActionBar } from "@repo/ui/platform/action-bar-context";

export const Route = createFileRoute("/_auth/app/articles")({
  component: ArticlesModule,
});

function ArticlesModule() {
  const { state: focusState } = useFocus();
  const { registerCommand } = useCommands();
  const { setSubCrumb } = useActionBar();
  const { t } = useTranslation("ui");
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  useEffect(() => () => setSubCrumb(undefined), [setSubCrumb]);

  // Fetch articles
  const { data: articles = [], isLoading: isDataLoading } = useQuery({
    queryKey: ["data", "article"],
    queryFn: async () => {
      const res = await fetch("/api/data/article");
      if (!res.ok) throw new Error("Failed to fetch articles");
      return res.json();
    },
  });

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

  // Fetch inventory movements for selected article (server-side FK filter)
  const { data: movements = [] } = useQuery({
    queryKey: ["data", "inventoryMovement", focusState.recordId],
    queryFn: async () => {
      const res = await fetch(`/api/data/inventoryMovement?articleId=${focusState.recordId}`);
      if (!res.ok) throw new Error("Failed to fetch inventory movements");
      return res.json();
    },
    enabled: !!focusState.recordId,
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
    queryKey: ["stats", "article", focusState.recordId],
    queryFn: async () => {
      const res = await fetch(`/api/stats/article/${encodeURIComponent(focusState.recordId!)}`);
      if (!res.ok) throw new Error("Failed to fetch article stats");
      return res.json();
    },
    enabled: !!focusState.recordId,
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
      id: "archive-record",
      scope: "context",
      group: "recordOps",
      label: { en: t("commands.archive"), de: "Archivieren" },
      shortcut: "F4",
      isEnabled: (s) => !!s.recordId && s.entity === "article",
      handler: async (s) => {
        if (!s.recordId) return;
        await fetch(`/api/data/article/${s.recordId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archived: true }),
        });
        queryClient.invalidateQueries({ queryKey: ["data", "article"] });
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
        const src = articles.find((a: any) => a.articleId === s.recordId);
        if (!src) return;
        const { articleId: _id, ...copy } = src as any;
        await fetch("/api/data/article", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(copy),
        });
        queryClient.invalidateQueries({ queryKey: ["data", "article"] });
      },
    });
    return () => { unregF3(); unregEdit(); unregF4(); unregDup(); };
  }, [registerCommand, t, queryClient, articles]);

  const selectedArticle = articles.find((a: any) => a.articleId === focusState.recordId);

  const dependentTabs = [
    {
      id: "details",
      label: "Details",
      content: (
        <InspectorPanel
          title={selectedArticle?.name ?? "Article"}
          recordId={focusState.recordId ?? undefined}
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
          keyExtractor={(row: any) => row.movementId || row.inventoryMovementId || row.id}
          title="Inventory Movements"
          toolbar={false}
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
      content: focusState.recordId ? (
        <StockLedgerTable articleId={focusState.recordId} />
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
            }}
          />
        }
        primaryGrid={
          <DataGrid
            entityName="article"
            panelId="article-grid"
            data={articles}
            isLoading={isDataLoading}
            keyExtractor={(row: any) => row.articleId}
            title={t("nav.articles")}
            columns={[
              { key: "articleNo", header: "No.", render: (r: any) => <span className="font-mono tabular-nums text-ink-mute">{r.articleNo}</span> },
              { key: "name", header: "Name" },
              { key: "baseUnit", header: "Unit" },
              { key: "salesPrice", header: "Price", isNumeric: true, render: (r: any) => <span className="tabular-nums">{formatMoney(r.salesPrice ?? 0)}</span> },
              { key: "stockQty", header: "Stock", isNumeric: true, render: (r: any) => <span className="tabular-nums">{r.stockQty ?? 0}</span> },
              { key: "defaultWarehouseId", header: "Location", render: (r: any) => <span className="font-mono text-[12px]">{r.defaultWarehouseId}</span> },
            ]}
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

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <EntityMask
            entityName="article"
            mode="create"
            title="New Article"
            onCancel={() => setShowCreate(false)}
            onSaved={() => setShowCreate(false)}
            className="border-none shadow-none rounded-none"
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <EntityMask
            entityName="article"
            mode="edit"
            recordId={focusState.recordId ?? undefined}
            onCancel={() => setShowEdit(false)}
            onSaved={() => {
              setShowEdit(false);
              queryClient.invalidateQueries({ queryKey: ["data", "article"] });
            }}
            childSection={(record) => (
              <InventoryBalanceTable articleId={record.articleId as string} />
            )}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
