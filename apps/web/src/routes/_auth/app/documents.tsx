import { createFileRoute } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronRightIcon, ChevronDownIcon, FolderIcon, FolderOpenIcon } from "lucide-react";
import { TriViewWorkspace } from "@repo/ui/components/triview-workspace";
import { DataGrid } from "@repo/ui/components/data-grid";
import { ContextTabs } from "@repo/ui/components/context-tabs";
import { EntityMask } from "@repo/ui/components/entity-mask";
import { InspectorPanel } from "@repo/ui/components/inspector-panel";
import { DocumentEditor } from "@repo/ui/components/document-editor";
import { Skeleton } from "@repo/ui/components/skeleton";
import { formatMoney, formatDate, StatusDot } from "@repo/ui/lib/formatters";
import { Dialog, DialogContent } from "@repo/ui/components/dialog";
import { useFocus } from "@repo/ui/platform/focus-manager";
import { useCommands } from "@repo/ui/platform/command-registry";
import { useActionBar } from "@repo/ui/platform/action-bar-context";

export const Route = createFileRoute("/_auth/app/documents")({
  component: DocumentsModule,
});

interface DocumentGroup {
  documentGroupId: string;
  name: string;
  documentType: string;
  groupNumber: number;
}

interface TreeSection {
  direction: string;
  label: string;
  groups: DocumentGroup[];
}

// Inline three-level navigation tree (NavigationTree doesn't support section-level non-selectable headers)
function DocumentNavigationTree({
  sections,
  isLoading,
  selectedGroupId,
  onSelectGroup,
  header,
}: {
  sections: TreeSection[];
  isLoading: boolean;
  selectedGroupId: string | null;
  onSelectGroup: (groupId: string, label: string) => void;
  header?: string;
}) {
  // ADJUSTMENT starts collapsed, others expanded
  const [expandedDirections, setExpandedDirections] = useState<Set<string>>(
    () => new Set(["OUTBOUND", "INBOUND"])
  );

  const toggleDirection = (direction: string) => {
    setExpandedDirections((prev) => {
      const next = new Set(prev);
      if (next.has(direction)) {
        next.delete(direction);
      } else {
        next.add(direction);
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-canvas-soft border-r border-hairline">
      <div className="h-8 flex items-center px-3 shrink-0 border-b border-hairline text-[11px] uppercase tracking-wider font-medium text-ink-mute">
        {header ?? "Belegtypen"}
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-7 flex items-center gap-1.5" style={{ paddingLeft: i % 3 === 0 ? 8 : 22 }}>
                <Skeleton className="size-3 shrink-0" />
                <Skeleton className="h-2.5" style={{ width: 80 + (i * 13) % 60 }} />
              </div>
            ))}
          </>
        ) : (
          sections.map((section) => {
            const isExpanded = expandedDirections.has(section.direction);
            return (
              <React.Fragment key={section.direction}>
                {/* Section header row — clickable to expand/collapse, not selectable */}
                <div
                  role="treeitem"
                  aria-expanded={isExpanded}
                  tabIndex={0}
                  className="h-7 flex items-center gap-1.5 cursor-pointer select-none text-[13px] transition-colors hover:bg-canvas font-medium text-ink"
                  style={{ paddingLeft: 8 }}
                  onClick={() => toggleDirection(section.direction)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") toggleDirection(section.direction);
                  }}
                >
                  <button
                    type="button"
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                    className="size-3 flex items-center justify-center shrink-0 bg-transparent border-0 p-0 cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); toggleDirection(section.direction); }}
                  >
                    {isExpanded ? (
                      <ChevronDownIcon size={12} strokeWidth={1.5} />
                    ) : (
                      <ChevronRightIcon size={12} strokeWidth={1.5} />
                    )}
                  </button>

                  <span className="size-3.5 flex items-center justify-center shrink-0">
                    {isExpanded ? (
                      <FolderOpenIcon size={13} strokeWidth={1.4} />
                    ) : (
                      <FolderIcon size={13} strokeWidth={1.4} />
                    )}
                  </span>

                  <span className="flex-1 truncate">{section.label}</span>
                </div>

                {/* Group children */}
                {isExpanded && section.groups.map((group) => {
                  const label = `${group.documentType}${String(group.groupNumber).padStart(2, "0")} – ${group.name}`;
                  const isSelected = selectedGroupId === group.documentGroupId;
                  return (
                    <div
                      key={group.documentGroupId}
                      role="treeitem"
                      aria-selected={isSelected}
                      tabIndex={0}
                      className={`h-7 flex items-center gap-1.5 cursor-pointer select-none text-[13px] transition-colors${!isSelected ? " hover:bg-canvas" : ""}`}
                      style={{
                        paddingLeft: 22,
                        ...(isSelected
                          ? { background: "var(--primary)", color: "var(--primary-fg)" }
                          : {}),
                      }}
                      onClick={() => onSelectGroup(group.documentGroupId, label)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") onSelectGroup(group.documentGroupId, label);
                      }}
                    >
                      {/* indent placeholder */}
                      <span className="size-3 shrink-0" style={{ display: "inline-block", width: 12 }} />
                      <span className="flex-1 truncate">{label}</span>
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })
        )}
      </div>
    </div>
  );
}

function DocumentsModule() {
  const { state: focusState } = useFocus();
  const { registerCommand } = useCommands();
  const { setSubCrumb } = useActionBar();
  const { t } = useTranslation("ui");
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editorDocId, setEditorDocId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  useEffect(() => () => setSubCrumb(undefined), [setSubCrumb]);

  // Fetch documents filtered by selected group
  const { data: documents = [], isLoading: isDataLoading } = useQuery({
    queryKey: ["data", "document", selectedGroupId],
    queryFn: async () => {
      const url = selectedGroupId
        ? `/api/data/document?documentGroupId=${selectedGroupId}`
        : "/api/data/document";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json();
    },
  });

  // Fetch document tree sections
  const { data: treeSections = [], isLoading: isTreeLoading } = useQuery({
    queryKey: ["documents", "tree"],
    queryFn: async () => {
      const res = await fetch("/api/documents/tree");
      if (!res.ok) throw new Error("Failed to fetch document tree");
      return res.json() as Promise<TreeSection[]>;
    },
  });

  // Fetch document lines for selected document (server-side FK filter)
  const { data: lines = [] } = useQuery({
    queryKey: ["data", "documentLine", focusState.recordId],
    queryFn: async () => {
      const res = await fetch(`/api/data/documentLine?documentId=${focusState.recordId}`);
      if (!res.ok) throw new Error("Failed to fetch document lines");
      return res.json();
    },
    enabled: !!focusState.recordId,
  });

  const handleSelectGroup = (groupId: string, label: string) => {
    setSelectedGroupId(groupId);
    setSubCrumb(label);
  };

  // Register context commands
  useEffect(() => {
    const unregF3 = registerCommand({
      id: "create-record",
      scope: "context",
      group: "recordOps",
      label: { en: t("commands.newRecord"), de: "Neuer Beleg" },
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
      isEnabled: (s) => !!s.recordId && s.entity === "document",
      handler: () => setShowEdit(true),
    });
    const unregF9 = registerCommand({
      id: "open-document",
      scope: "context",
      group: "workflow",
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
      group: "workflow",
      label: { en: t("commands.transform"), de: "Umwandeln" },
      shortcut: "F7",
      isEnabled: (s) => !!s.recordId && s.entity === "document",
      handler: () => { /* stub — future document conversion */ },
    });
    const unregF4 = registerCommand({
      id: "archive-record",
      scope: "context",
      group: "recordOps",
      label: { en: t("commands.archive"), de: "Archivieren" },
      shortcut: "F4",
      isEnabled: (s) => !!s.recordId && s.entity === "document",
      handler: async (s) => {
        if (!s.recordId) return;
        await fetch(`/api/data/document/${s.recordId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archived: true }),
        });
        queryClient.invalidateQueries({ queryKey: ["data", "document"] });
      },
    });
    const unregDup = registerCommand({
      id: "duplicate-record",
      scope: "context",
      group: "recordOps",
      label: { en: "Duplicate", de: "Duplizieren" },
      shortcut: "F8",
      isEnabled: (s) => !!s.recordId && s.entity === "document",
      handler: async (s) => {
        const src = documents.find((d: any) => d.documentId === s.recordId);
        if (!src) return;
        const { documentId: _id, ...copy } = src as any;
        await fetch("/api/data/document", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(copy),
        });
        queryClient.invalidateQueries({ queryKey: ["data", "document"] });
      },
    });
    const unregPost = registerCommand({
      id: "post-document",
      scope: "context",
      group: "workflow",
      label: { en: "Post Document", de: "Beleg buchen" },
      isEnabled: (s) => !!s.recordId && s.entity === "document",
      handler: async (s) => {
        if (!s.recordId) return;
        await fetch(`/api/data/document/${s.recordId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "posted" }),
        });
        queryClient.invalidateQueries({ queryKey: ["data", "document"] });
      },
    });
    return () => { unregF3(); unregEdit(); unregF9(); unregF7(); unregF4(); unregDup(); unregPost(); };
  }, [registerCommand, t, queryClient, documents]);

  const selectedDocument = documents.find((d: any) => d.documentId === focusState.recordId);

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
          columns={[
            { key: "lineNo", header: "Pos.", isNumeric: true, render: (r: any) => <span className="font-mono tabular-nums">{String(r.lineNo ?? 0).padStart(3, "0")}</span> },
            { key: "articleId", header: "Article", render: (r: any) => <span className="font-mono text-[12px]">{r.articleId}</span> },
            { key: "articleTextSnapshot", header: "Description" },
            { key: "quantity", header: "Qty", isNumeric: true, render: (r: any) => <span className="tabular-nums">{r.quantity} {r.unit}</span> },
            { key: "netPrice", header: "Unit Price", isNumeric: true, render: (r: any) => <span className="tabular-nums">{formatMoney(r.netPrice ?? 0)}</span> },
            { key: "discountPercentage", header: "Disc.", isNumeric: true, render: (r: any) => <span className="tabular-nums">{r.discountPercentage ?? 0}%</span> },
            { key: "lineTotalNet", header: "Total", isNumeric: true, render: (r: any) => <span className="tabular-nums">{formatMoney(r.lineTotalNet ?? 0)}</span> },
          ]}
        />
      ),
    },
    {
      id: "header",
      label: "Header Details",
      content: (
        <InspectorPanel
          title={selectedDocument?.documentNo ?? "Document"}
          recordId={focusState.recordId ?? undefined}
          sections={[
            {
              title: "Document",
              fields: [
                { label: "No.", value: <span className="font-mono tabular-nums">{selectedDocument?.documentNo}</span> },
                { label: "Type", value: selectedDocument?.documentTypeId },
                { label: "Date", value: selectedDocument?.documentDate },
                { label: "Status", value: selectedDocument?.status },
              ],
            },
            {
              title: "Parties",
              fields: [
                { label: "Customer", value: selectedDocument?.customerId },
                { label: "Currency", value: selectedDocument?.currencyId },
              ],
            },
            {
              title: "Totals",
              fields: [
                { label: "Net", value: selectedDocument?.totalNet },
                { label: "Tax", value: selectedDocument?.totalTax },
                { label: "Gross", value: selectedDocument?.totalGross },
              ],
            },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <TriViewWorkspace
        navigationTree={
          <DocumentNavigationTree
            sections={treeSections}
            isLoading={isTreeLoading}
            selectedGroupId={selectedGroupId}
            onSelectGroup={handleSelectGroup}
            header={t("tree.types")}
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
            columns={[
              { key: "documentNo", header: "No.", render: (r: any) => <span className="font-mono tabular-nums">{r.documentNo}</span> },
              { key: "documentDate", header: "Date", isNumeric: true, render: (r: any) => <span className="tabular-nums">{formatDate(r.documentDate)}</span> },
              { key: "customerId", header: "Customer" },
              { key: "totalGross", header: "Total", isNumeric: true, render: (r: any) => <span className="tabular-nums">{formatMoney(r.totalGross ?? 0)}</span> },
              { key: "status", header: "Status", render: (r: any) => <StatusDot status={r.status ?? "draft"} /> },
            ]}
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
            onSaved={() => {
              queryClient.invalidateQueries({ queryKey: ["data", "document"] });
              setShowCreate(false);
            }}
            className="border-none shadow-none rounded-none"
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <EntityMask
            entityName="document"
            mode="edit"
            recordId={focusState.recordId ?? undefined}
            onCancel={() => setShowEdit(false)}
            onSaved={() => {
              setShowEdit(false);
              queryClient.invalidateQueries({ queryKey: ["data", "document"] });
            }}
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
