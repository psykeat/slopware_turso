import { createFileRoute } from "@tanstack/react-router";
import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useGridUrlState } from "#/hooks/use-grid-url-state";
import { useTranslation } from "react-i18next";
import { ChevronRightIcon, ChevronDownIcon, FolderIcon, FolderOpenIcon } from "lucide-react";
import { TriViewWorkspace } from "@repo/ui/components/triview-workspace";
import { DataGrid } from "@repo/ui/components/data-grid";
import { ContextTabs } from "@repo/ui/components/context-tabs";
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

interface TypeNode {
  documentType: string;
  typeLabel: string;
  groups: DocumentGroup[];
}

interface TreeSection {
  direction: string;
  label: string;
  types: TypeNode[];
}

type TreeSelection =
  | { kind: "all" }
  | { kind: "type"; documentType: string; direction: string }
  | { kind: "group"; groupId: string; documentType: string; direction: string };

function DocumentNavigationTree({
  sections,
  isLoading,
  selection,
  onSelectType,
  onSelectGroup,
  expandedDirections,
  onToggleDirection,
  header,
}: {
  sections: TreeSection[];
  isLoading: boolean;
  selection: TreeSelection;
  onSelectType: (documentType: string, direction: string, label: string) => void;
  onSelectGroup: (groupId: string, documentType: string, direction: string, label: string) => void;
  expandedDirections: Set<string>;
  onToggleDirection: (direction: string) => void;
  header?: string;
}) {
  const isTypeSelected = (docType: string) =>
    selection.kind === "type" && selection.documentType === docType;
  const isGroupSelected = (groupId: string) =>
    selection.kind === "group" && selection.groupId === groupId;

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-canvas-soft border-r border-hairline">
      <div className="h-8 flex items-center px-3 shrink-0 border-b border-hairline text-[11px] uppercase tracking-wider font-medium text-ink-mute">
        {header ?? "Belegtypen"}
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="h-7 flex items-center gap-1.5" style={{ paddingLeft: i % 3 === 0 ? 8 : i % 3 === 1 ? 22 : 36 }}>
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
                {/* Layer 1: Direction header */}
                <div
                  role="treeitem"
                  aria-expanded={isExpanded}
                  tabIndex={0}
                  className="h-7 flex items-center gap-1.5 cursor-pointer select-none text-[13px] transition-colors hover:bg-canvas font-medium text-ink"
                  style={{ paddingLeft: 8 }}
                  onClick={() => onToggleDirection(section.direction)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onToggleDirection(section.direction);
                  }}
                >
                  <button
                    type="button"
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                    className="size-3 flex items-center justify-center shrink-0 bg-transparent border-0 p-0 cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); onToggleDirection(section.direction); }}
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

                {/* Layer 2: Type nodes */}
                {isExpanded && (section.types ?? []).map((type) => {
                  const sel = isTypeSelected(type.documentType);
                  return (
                    <React.Fragment key={type.documentType}>
                      <div
                        role="treeitem"
                        aria-selected={sel}
                        tabIndex={0}
                        className={`h-7 flex items-center gap-1.5 cursor-pointer select-none text-[13px] transition-colors${!sel ? " hover:bg-canvas" : ""}`}
                        style={{
                          paddingLeft: 22,
                          ...(sel ? { background: "var(--primary)", color: "var(--primary-fg)" } : {}),
                        }}
                        onClick={() => onSelectType(type.documentType, section.direction, type.typeLabel)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") onSelectType(type.documentType, section.direction, type.typeLabel);
                        }}
                      >
                        <span className="size-3 shrink-0" />
                        <span className="flex-1 truncate">
                          <span className="font-mono text-[11px] opacity-60 mr-1.5">{type.documentType}00</span>
                          {type.typeLabel}
                        </span>
                      </div>

                      {/* Layer 3: Additional groups (groupNumber > 0) */}
                      {type.groups.map((group) => {
                        const groupLabel = `${group.documentType}${String(group.groupNumber).padStart(2, "0")} – ${group.name}`;
                        const gsel = isGroupSelected(group.documentGroupId);
                        return (
                          <div
                            key={group.documentGroupId}
                            role="treeitem"
                            aria-selected={gsel}
                            tabIndex={0}
                            className={`h-7 flex items-center gap-1.5 cursor-pointer select-none text-[13px] transition-colors${!gsel ? " hover:bg-canvas" : ""}`}
                            style={{
                              paddingLeft: 36,
                              ...(gsel ? { background: "var(--primary)", color: "var(--primary-fg)" } : {}),
                            }}
                            onClick={() => onSelectGroup(group.documentGroupId, group.documentType, section.direction, groupLabel)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") onSelectGroup(group.documentGroupId, group.documentType, section.direction, groupLabel);
                            }}
                          >
                            <span className="size-3 shrink-0" />
                            <span className="flex-1 truncate">{groupLabel}</span>
                          </div>
                        );
                      })}
                    </React.Fragment>
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

function buildFlatNodes(
  sections: TreeSection[],
  expandedDirs: Set<string>,
): Array<
  | { kind: "type"; documentType: string; direction: string; label: string }
  | { kind: "group"; groupId: string; documentType: string; direction: string; label: string }
> {
  const nodes: Array<
    | { kind: "type"; documentType: string; direction: string; label: string }
    | { kind: "group"; groupId: string; documentType: string; direction: string; label: string }
  > = [];
  for (const section of sections) {
    if (!expandedDirs.has(section.direction)) continue;
    for (const type of section.types) {
      nodes.push({ kind: "type", documentType: type.documentType, direction: section.direction, label: type.typeLabel });
      for (const group of type.groups) {
        const label = `${group.documentType}${String(group.groupNumber).padStart(2, "0")} – ${group.name}`;
        nodes.push({ kind: "group", groupId: group.documentGroupId, documentType: group.documentType, direction: section.direction, label });
      }
    }
  }
  return nodes;
}

function DocumentsModule() {
  const { state: focusState } = useFocus();
  const { registerCommand } = useCommands();
  const { setSubCrumb } = useActionBar();
  const { t } = useTranslation("ui");
  const queryClient = useQueryClient();
  const [editorDocId, setEditorDocId] = useState<string | null>(null);
  const [editorGroupId, setEditorGroupId] = useState<string | undefined>(undefined);
  const [selection, setSelection] = useState<TreeSelection>({ kind: "all" });
  // Ref so command handlers always see the latest selection without re-registering
  const selectionRef = React.useRef(selection);
  useEffect(() => { selectionRef.current = selection; }, [selection]);
  const [expandedDirections, setExpandedDirections] = useState<Set<string>>(
    () => new Set(["OUTBOUND", "INBOUND"]),
  );
  const [conversionDialog, setConversionDialog] = useState<{
    open: boolean;
    recordId: string | null;
    candidates: Array<{ documentGroupId: string; name: string; documentType: string; groupNumber: number }>;
  }>({ open: false, recordId: null, candidates: [] });
  const gridState = useGridUrlState({ defaultPageSize: 50 });

  useEffect(() => () => setSubCrumb(undefined), [setSubCrumb]);

  // Fetch documents — paginated, filtered by tree selection
  const { data: documentData, isLoading: isDataLoading } = useQuery({
    queryKey: ["data", "document", selection, gridState.queryParams.page, gridState.queryParams.limit, gridState.queryParams.orderBy, gridState.queryParams.search, gridState.queryParams.filters],
    queryFn: async () => {
      const p = new URLSearchParams({
        paginated: "true",
        page: String(gridState.queryParams.page),
        limit: String(gridState.queryParams.limit),
      });
      if (gridState.queryParams.orderBy) p.set("orderBy", gridState.queryParams.orderBy);
      if (gridState.queryParams.search) p.set("search", gridState.queryParams.search);
      if (gridState.queryParams.filters) p.set("filters", JSON.stringify(gridState.queryParams.filters));
      if (selection.kind === "group") p.set("documentGroupId", selection.groupId);
      else if (selection.kind === "type") p.set("documentType", selection.documentType);
      const res = await fetch(`/api/data/document?${p}`);
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json() as Promise<{ data: any[]; total: number }>;
    },
  });

  const documents = useMemo(() => documentData?.data ?? [], [documentData]);

  // Fetch document tree sections — always fresh, no stale cache
  const { data: treeSections = [], isLoading: isTreeLoading, error: treeError } = useQuery({
    queryKey: ["documents", "tree"],
    staleTime: 0,
    queryFn: async () => {
      const res = await fetch("/api/documents/tree");
      if (!res.ok) {
        const text = await res.text();
        console.error("[Tree] fetch failed", res.status, text);
        throw new Error(`Tree fetch ${res.status}: ${text}`);
      }
      const raw = await res.json();
      console.log("[Tree] response", JSON.stringify(raw));
      // Normalise: older cached format may have `groups` instead of `types`
      return (raw as any[]).map((s: any) => ({
        ...s,
        types: s.types ?? [],
      })) as TreeSection[];
    },
  });

  if (treeError) console.error("[Tree] query error", treeError);

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

  const handleSelectType = (documentType: string, direction: string, label: string) => {
    setSelection({ kind: "type", documentType, direction });
    setSubCrumb(label);
    gridState.setPage(1);
  };

  const handleSelectGroup = (groupId: string, documentType: string, direction: string, label: string) => {
    setSelection({ kind: "group", groupId, documentType, direction });
    setSubCrumb(label);
    gridState.setPage(1);
  };

  const handleToggleDirection = (direction: string) => {
    setExpandedDirections((prev) => {
      const next = new Set(prev);
      if (next.has(direction)) next.delete(direction);
      else next.add(direction);
      return next;
    });
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
      handler: () => {
        const sel = selectionRef.current;
        setEditorGroupId(sel.kind === "group" ? sel.groupId : undefined);
        setEditorDocId("__new__");
      },
    });
    const unregEdit = registerCommand({
      id: "edit-record",
      scope: "context",
      group: "recordOps",
      label: { en: "Edit", de: "Bearbeiten" },
      shortcut: "F2",
      isEnabled: (s) => !!s.recordId && s.entity === "document",
      handler: (s) => {
        if (s.recordId) { setEditorGroupId(undefined); setEditorDocId(s.recordId); }
      },
    });
    const unregF9 = registerCommand({
      id: "open-document",
      scope: "context",
      group: "workflow",
      label: { en: t("commands.openDocument"), de: "Beleg öffnen" },
      shortcut: "F9",
      isEnabled: (s) => !!s.recordId && s.entity === "document",
      handler: (s) => {
        if (s.recordId) { setEditorGroupId(undefined); setEditorDocId(s.recordId); }
      },
    });
    const unregF7 = registerCommand({
      id: "transform-record",
      scope: "context",
      group: "workflow",
      label: { en: t("commands.transform"), de: "Umwandeln" },
      shortcut: "F7",
      isEnabled: (s) => !!s.recordId && s.entity === "document",
      handler: async (s) => {
        if (!s.recordId) return;
        const res = await fetch(`/api/documents/${s.recordId}/convert`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.requiresSelection) {
          setConversionDialog({ open: true, recordId: s.recordId, candidates: data.candidates });
        } else if (data.newDocumentId) {
          queryClient.invalidateQueries({ queryKey: ["data", "document"] });
        }
      },
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
        if (!s.recordId) return;
        const srcRes = await fetch(`/api/data/document/${s.recordId}`);
        if (!srcRes.ok) return;
        const { documentId: _id, ...copy } = await srcRes.json();
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
  }, [registerCommand, t, queryClient]);

  // Tree keyboard navigation
  useEffect(() => {
    const flatNodes = buildFlatNodes(treeSections, expandedDirections);

    const currentIdx = flatNodes.findIndex((n) => {
      if (selection.kind === "type") return n.kind === "type" && n.documentType === selection.documentType;
      if (selection.kind === "group") return n.kind === "group" && (n as any).groupId === selection.groupId;
      return false;
    });

    const navigate = (delta: number) => {
      if (flatNodes.length === 0) return;
      const base = currentIdx < 0 ? (delta > 0 ? -1 : flatNodes.length) : currentIdx;
      const idx = (base + delta + flatNodes.length) % flatNodes.length;
      const node = flatNodes[idx];
      if (!node) return;
      if (node.kind === "type") {
        setSelection({ kind: "type", documentType: node.documentType, direction: node.direction });
        setSubCrumb(node.label);
      } else {
        setSelection({ kind: "group", groupId: (node as any).groupId, documentType: node.documentType, direction: node.direction });
        setSubCrumb(node.label);
      }
    };

    const getCurrentDirection = () =>
      selection.kind === "all" ? null : selection.direction;

    const unregDown = registerCommand({
      id: "tree-nav-down",
      scope: "context",
      group: "navigation",
      label: { en: "Next Tree Item", de: "Nächster Eintrag" },
      shortcut: "Ctrl+ArrowDown",
      isEnabled: () => true,
      handler: () => navigate(1),
    });
    const unregUp = registerCommand({
      id: "tree-nav-up",
      scope: "context",
      group: "navigation",
      label: { en: "Previous Tree Item", de: "Vorheriger Eintrag" },
      shortcut: "Ctrl+ArrowUp",
      isEnabled: () => true,
      handler: () => navigate(-1),
    });
    const unregRight = registerCommand({
      id: "tree-nav-right",
      scope: "context",
      group: "navigation",
      label: { en: "Expand Direction", de: "Segment aufklappen" },
      shortcut: "Ctrl+ArrowRight",
      isEnabled: () => true,
      handler: () => {
        const dir = getCurrentDirection();
        if (dir && !expandedDirections.has(dir)) handleToggleDirection(dir);
      },
    });
    const unregLeft = registerCommand({
      id: "tree-nav-left",
      scope: "context",
      group: "navigation",
      label: { en: "Collapse Direction", de: "Segment zuklappen" },
      shortcut: "Ctrl+ArrowLeft",
      isEnabled: () => true,
      handler: () => {
        const dir = getCurrentDirection();
        if (dir && expandedDirections.has(dir)) handleToggleDirection(dir);
      },
    });

    return () => { unregDown(); unregUp(); unregRight(); unregLeft(); };
  }, [registerCommand, treeSections, expandedDirections, selection, setSubCrumb]);

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
            selection={selection}
            onSelectType={handleSelectType}
            onSelectGroup={handleSelectGroup}
            expandedDirections={expandedDirections}
            onToggleDirection={handleToggleDirection}
            header={t("tree.types")}
          />
        }
        primaryGrid={
          editorDocId ? (
            <DocumentEditor
              documentId={editorDocId}
              documentGroupId={editorGroupId}
              onClose={() => { setEditorDocId(null); setEditorGroupId(undefined); }}
            />
          ) : (
            <DataGrid
              entityName="document"
              panelId="document-grid"
              data={documents}
              isLoading={isDataLoading}
              keyExtractor={(row: any) => row.documentId}
              title={t("nav.documents")}
              columns={[
                { key: "documentNo", header: "No.", sortable: true, render: (r: any) => <span className="font-mono tabular-nums">{r.documentNo}</span> },
                { key: "documentDate", header: "Date", isNumeric: true, sortable: true, render: (r: any) => <span className="tabular-nums">{formatDate(r.documentDate)}</span> },
                { key: "customerId", header: "Customer" },
                { key: "totalGross", header: "Total", isNumeric: true, sortable: true, render: (r: any) => <span className="tabular-nums">{formatMoney(r.totalGross ?? 0)}</span> },
                { key: "status", header: "Status", sortable: true, render: (r: any) => <StatusDot status={r.status ?? "draft"} /> },
              ]}
              totalCount={documentData?.total}
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
                    fetch(`/api/data/document/${id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ archived: true }),
                    })
                  ));
                  queryClient.invalidateQueries({ queryKey: ["data", "document"] });
                },
              }]}
              onRowOpen={(row: any) => { setEditorGroupId(undefined); setEditorDocId(row.documentId); }}
              emptyTitle="No documents yet."
              emptySubtitle="Create the first document."
              emptyAction={{
                label: `${t("actions.new")} Document`,
                kbd: "F3",
                onClick: () => { setEditorGroupId(selectionRef.current.kind === "group" ? selectionRef.current.groupId : undefined); setEditorDocId("__new__"); },
              }}
              className="h-full border-none rounded-none"
            />
          )
        }
        dependentContext={editorDocId ? <></> : <ContextTabs tabs={dependentTabs} />}
      />

      {/* Wandlungs-Dialog: Case 3 — multiple conversion targets */}
      <Dialog
        open={conversionDialog.open}
        onOpenChange={(open) => setConversionDialog((p) => ({ ...p, open }))}
      >
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-hairline">
            <h3 className="text-[15px] font-medium text-ink">Zielgruppe wählen</h3>
            <p className="text-[13px] text-ink-mute mt-0.5">
              Mehrere Gruppen verfügbar. Bitte eine Zielgruppe auswählen.
            </p>
          </div>
          <div className="flex flex-col py-1">
            {conversionDialog.candidates.map((c) => (
              <button
                key={c.documentGroupId}
                type="button"
                className="h-9 px-5 text-left text-[13px] hover:bg-canvas-soft transition-colors"
                onClick={async () => {
                  setConversionDialog((p) => ({ ...p, open: false }));
                  const res = await fetch(
                    `/api/documents/${conversionDialog.recordId}/convert`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ targetGroupId: c.documentGroupId }),
                    },
                  );
                  if (res.ok) {
                    queryClient.invalidateQueries({ queryKey: ["data", "document"] });
                  }
                }}
              >
                <span className="font-mono text-[12px] text-ink-secondary mr-2">
                  {c.documentType}{String(c.groupNumber).padStart(2, "0")}
                </span>
                {c.name}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
