import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { TriViewWorkspace } from "@repo/ui/components/triview-workspace";
import { NavigationTree, type TreeNode } from "@repo/ui/components/navigation-tree";
import { DataGrid } from "@repo/ui/components/data-grid";
import { ContextTabs } from "@repo/ui/components/context-tabs";
import { EntityMask } from "@repo/ui/components/entity-mask";
import { Dialog, DialogContent } from "@repo/ui/components/dialog";
import { useFocus } from "@repo/ui/platform/focus-manager";
import { useCommands } from "@repo/ui/platform/command-registry";

export const Route = createFileRoute("/_auth/app/articles")({
  component: ArticlesModule,
});

function ArticlesModule() {
  const { state: focusState } = useFocus();
  const { registerCommand } = useCommands();
  const { t } = useTranslation("ui");
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

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

  // Fetch inventory movements for selected article
  const { data: movements = [] } = useQuery({
    queryKey: ["data", "inventoryMovement", focusState.recordId],
    queryFn: async () => {
      const res = await fetch("/api/data/inventoryMovement");
      if (!res.ok) throw new Error("Failed to fetch inventory movements");
      const all = await res.json();
      return all.filter((m: any) => m.articleId === focusState.recordId);
    },
    enabled: !!focusState.recordId,
  });

  // Register context commands
  useEffect(() => {
    const unregF3 = registerCommand({
      id: "create-record",
      scope: "context",
      label: { en: t("commands.newRecord"), de: "Neuer Datensatz" },
      shortcut: "F3",
      isEnabled: () => true,
      handler: () => setShowCreate(true),
    });
    const unregF4 = registerCommand({
      id: "archive-record",
      scope: "context",
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
    return () => { unregF3(); unregF4(); };
  }, [registerCommand, t, queryClient]);

  const dependentTabs = [
    {
      id: "details",
      label: "Details",
      content: (
        <EntityMask
          entityName="article"
          recordId={focusState.recordId}
          mode="edit"
          embedded={true}
          className="border-none shadow-none rounded-none"
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
    </>
  );
}
