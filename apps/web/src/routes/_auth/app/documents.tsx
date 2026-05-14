import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { TriViewWorkspace } from "@repo/ui/components/triview-workspace";
import { NavigationTree, type TreeNode } from "@repo/ui/components/navigation-tree";
import { DataGrid } from "@repo/ui/components/data-grid";
import { ContextTabs } from "@repo/ui/components/context-tabs";
import { EntityMask } from "@repo/ui/components/entity-mask";
import { DocumentEditor } from "@repo/ui/components/document-editor";
import { Dialog, DialogContent } from "@repo/ui/components/dialog";
import { useFocus } from "@repo/ui/platform/focus-manager";
import { useCommands } from "@repo/ui/platform/command-registry";

export const Route = createFileRoute("/_auth/app/documents")({
  component: DocumentsModule,
});

function DocumentsModule() {
  const { state: focusState } = useFocus();
  const { registerCommand } = useCommands();
  const { t } = useTranslation("ui");
  const [showCreate, setShowCreate] = useState(false);
  const [editorDocId, setEditorDocId] = useState<string | null>(null);

  // Fetch documents
  const { data: documents = [], isLoading: isDataLoading } = useQuery({
    queryKey: ["data", "document"],
    queryFn: async () => {
      const res = await fetch("/api/data/document");
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json();
    },
  });

  // Fetch document types for tree
  const { data: docTypes = [], isLoading: isTreeLoading } = useQuery({
    queryKey: ["data", "documentType"],
    queryFn: async () => {
      const res = await fetch("/api/data/documentType");
      if (!res.ok) throw new Error("Failed to fetch document types");
      const data = await res.json();
      return data.map((t: any): TreeNode => ({
        id: t.documentTypeId,
        label: t.name || "Unnamed Type",
      }));
    },
  });

  // Fetch document lines for selected document
  const { data: lines = [] } = useQuery({
    queryKey: ["data", "documentLine", focusState.recordId],
    queryFn: async () => {
      const res = await fetch("/api/data/documentLine");
      if (!res.ok) throw new Error("Failed to fetch document lines");
      const all = await res.json();
      return all.filter((l: any) => l.documentId === focusState.recordId);
    },
    enabled: !!focusState.recordId,
  });

  // Register context commands
  useEffect(() => {
    const unregF3 = registerCommand({
      id: "create-record",
      scope: "context",
      label: { en: t("commands.newRecord"), de: "Neuer Beleg" },
      shortcut: "F3",
      isEnabled: () => true,
      handler: () => setShowCreate(true),
    });
    const unregF9 = registerCommand({
      id: "open-document",
      scope: "context",
      label: { en: t("commands.openDocument"), de: "Beleg öffnen" },
      shortcut: "F9",
      isEnabled: (s) => !!s.recordId && s.entity === "document",
      handler: (s) => {
        if (s.recordId) setEditorDocId(s.recordId);
      },
    });
    const unregF7 = registerCommand({
      id: "transform-record",
      scope: "context",
      label: { en: t("commands.transform"), de: "Umwandeln" },
      shortcut: "F7",
      isEnabled: (s) => !!s.recordId && s.entity === "document",
      handler: () => { /* stub — future document conversion */ },
    });
    return () => { unregF3(); unregF9(); unregF7(); };
  }, [registerCommand, t]);

  const dependentTabs = [
    {
      id: "lines",
      label: "Document Lines",
      count: lines.length || undefined,
      content: (
        <DataGrid
          entityName="documentLine"
          panelId="lines-grid"
          data={lines}
          keyExtractor={(row: any) => row.documentLineId || row.lineId || row.id}
          title="Lines"
          toolbar={false}
          emptyTitle="No lines yet."
          emptySubtitle="Open the document editor to add lines."
          className="h-full border-none rounded-none"
        />
      ),
    },
    {
      id: "header",
      label: "Header Details",
      content: (
        <EntityMask
          entityName="document"
          recordId={focusState.recordId}
          mode="edit"
          embedded={true}
          className="border-none shadow-none rounded-none"
        />
      ),
    },
  ];

  return (
    <>
      <TriViewWorkspace
        navigationTree={
          <NavigationTree
            entityName="documentType"
            panelId="document-tree"
            data={docTypes}
            header={t("tree.types")}
            isLoading={isTreeLoading}
          />
        }
        primaryGrid={
          <DataGrid
            entityName="document"
            panelId="document-grid"
            data={documents}
            isLoading={isDataLoading}
            keyExtractor={(row: any) => row.documentId}
            title={t("nav.documents")}
            emptyTitle="No documents yet."
            emptySubtitle="Create the first document."
            emptyAction={{
              label: `${t("actions.new")} Document`,
              kbd: "F3",
              onClick: () => setShowCreate(true),
            }}
            className="h-full border-none rounded-none"
          />
        }
        dependentContext={<ContextTabs tabs={dependentTabs} />}
      />

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <EntityMask
            entityName="document"
            mode="create"
            title="New Document"
            onCancel={() => setShowCreate(false)}
            onSaved={() => setShowCreate(false)}
            className="border-none shadow-none rounded-none"
          />
        </DialogContent>
      </Dialog>

      {/* Document Editor overlay */}
      {editorDocId && (
        <DocumentEditor
          documentId={editorDocId}
          onClose={() => setEditorDocId(null)}
        />
      )}
    </>
  );
}
