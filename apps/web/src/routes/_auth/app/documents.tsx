import { ContextTabs } from "@repo/ui/components/context-tabs";
import { DataGrid, type DataGridHandle } from "@repo/ui/components/data-grid";
import { Dialog, DialogContent } from "@repo/ui/components/dialog";
import { DocumentEditor } from "@repo/ui/components/document-editor";
import {
  DocumentTargetGroupDialog,
  type DocumentTargetGroupCandidate,
} from "@repo/ui/components/document-target-group-dialog";
import { InspectorPanel } from "@repo/ui/components/inspector-panel";
import { Skeleton } from "@repo/ui/components/skeleton";
import { TriViewWorkspace } from "@repo/ui/components/triview-workspace";
import { formatMoney, formatDate, StatusDot } from "@repo/ui/lib/formatters";
import { useActionBar } from "@repo/ui/platform/action-bar-context";
import { useCommands } from "@repo/ui/platform/command-registry";
import { useFocus } from "@repo/ui/platform/focus-manager";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronRightIcon, ChevronDownIcon, FolderIcon, FolderOpenIcon } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useGridUrlState } from "#/hooks/use-grid-url-state";

export const Route = createFileRoute("/_auth/app/documents")({
  component: DocumentsModule,
});

const EMPTY_ARRAY: any[] = [];

const DOC_TYPE_LABELS: Record<string, string> = {
  N: "Angebot",
  A: "Auftrag",
  L: "Lieferschein",
  R: "Rechnung",
  G: "Gutschrift",
  b: "Bestellung",
  l: "Wareneingang",
  r: "Eingangsrechnung",
  g: "Eingangsgutschrift",
  V: "Inventur",
  U: "Umbuchung",
  Z: "Zugang",
  E: "Entnahme",
  q: "Prod.-Auftrag",
  p: "Fertigmeldung",
};

function addressDisplayName(addr: any): string {
  if (!addr) return "";
  return (
    addr.companyName ||
    [addr.firstName, addr.lastName].filter(Boolean).join(" ") ||
    addr.addressNo ||
    ""
  );
}

interface DocumentGroup {
  documentGroupId: string;
  name: string;
  documentType: string;
  groupNumber: number;
}

interface TypeNode {
  documentType: string;
  typeLabel: string;
  mainGroup: DocumentGroup | null;
  groups: DocumentGroup[];
}

interface TreeSection {
  direction: string;
  label: string;
  types: TypeNode[];
}

type TreeSelection =
  | { kind: "all" }
  | { kind: "type"; documentType: string; direction: string; groupId: string | null }
  | { kind: "group"; groupId: string; documentType: string; direction: string };

function DocumentNavigationTree({
  sections,
  isLoading,
  selection,
  onSelectType,
  onSelectGroup,
  expandedDirections,
  onToggleDirection,
  getTypeLabel,
  getDirectionLabel,
  onSelectCommit,
  header,
}: {
  sections: TreeSection[];
  isLoading: boolean;
  selection: TreeSelection;
  onSelectType: (
    documentType: string,
    direction: string,
    label: string,
    groupId: string | null,
  ) => void;
  onSelectGroup: (groupId: string, documentType: string, direction: string, label: string) => void;
  expandedDirections: Set<string>;
  onToggleDirection: (direction: string) => void;
  getTypeLabel: (documentType: string, fallback: string) => string;
  getDirectionLabel: (direction: string, fallback: string) => string;
  onSelectCommit?: () => void;
  header?: string;
}) {
  const isTypeSelected = (docType: string) =>
    selection.kind === "type" && selection.documentType === docType;
  const isGroupSelected = (groupId: string) =>
    selection.kind === "group" && selection.groupId === groupId;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden border-r border-hairline bg-canvas-soft">
      <div className="flex h-8 shrink-0 items-center border-b border-hairline px-3 text-[11px] font-medium tracking-wider text-ink-mute uppercase">
        {header ?? "Belegtypen"}
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div
                key={i}
                className="flex h-7 items-center gap-1.5"
                style={{ paddingLeft: i % 3 === 0 ? 8 : i % 3 === 1 ? 22 : 36 }}
              >
                <Skeleton className="size-3 shrink-0" />
                <Skeleton className="h-2.5" style={{ width: 80 + ((i * 13) % 60) }} />
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
                  className="flex h-7 cursor-pointer items-center gap-1.5 text-[13px] font-medium text-ink transition-colors select-none hover:bg-canvas"
                  style={{ paddingLeft: 8 }}
                  onClick={() => onToggleDirection(section.direction)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onToggleDirection(section.direction);
                  }}
                >
                  <button
                    type="button"
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                    className="flex size-3 shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleDirection(section.direction);
                    }}
                  >
                    {isExpanded ? (
                      <ChevronDownIcon size={12} strokeWidth={1.5} />
                    ) : (
                      <ChevronRightIcon size={12} strokeWidth={1.5} />
                    )}
                  </button>
                  <span className="flex size-3.5 shrink-0 items-center justify-center">
                    {isExpanded ? (
                      <FolderOpenIcon size={13} strokeWidth={1.4} />
                    ) : (
                      <FolderIcon size={13} strokeWidth={1.4} />
                    )}
                  </span>
                  <span className="flex-1 truncate">
                    {getDirectionLabel(section.direction, section.label)}
                  </span>
                </div>

                {/* Layer 2: Type nodes */}
                {isExpanded &&
                  (section.types ?? []).map((type) => {
                    const sel = isTypeSelected(type.documentType);
                    return (
                      <React.Fragment key={type.documentType}>
                        <div
                          role="treeitem"
                          aria-selected={sel}
                          tabIndex={0}
                          className={`flex h-7 cursor-pointer items-center gap-1.5 text-[13px] select-none transition-colors${!sel ? " hover:bg-canvas" : ""}`}
                          style={{
                            paddingLeft: 22,
                            ...(sel
                              ? { background: "var(--primary)", color: "var(--primary-fg)" }
                              : {}),
                          }}
                          onClick={() => {
                            onSelectType(
                              type.documentType,
                              section.direction,
                              getTypeLabel(type.documentType, type.typeLabel),
                              type.mainGroup?.documentGroupId ?? null,
                            );
                            requestAnimationFrame(() => onSelectCommit?.());
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              onSelectType(
                                type.documentType,
                                section.direction,
                                getTypeLabel(type.documentType, type.typeLabel),
                                type.mainGroup?.documentGroupId ?? null,
                              );
                              requestAnimationFrame(() => onSelectCommit?.());
                            }
                          }}
                        >
                          <span className="size-3 shrink-0" />
                          <span className="flex-1 truncate">
                            <span className="mr-1.5 font-mono text-[11px] opacity-60">
                              {type.documentType}
                            </span>
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
                              className={`flex h-7 cursor-pointer items-center gap-1.5 text-[13px] select-none transition-colors${!gsel ? " hover:bg-canvas" : ""}`}
                              style={{
                                paddingLeft: 36,
                                ...(gsel
                                  ? { background: "var(--primary)", color: "var(--primary-fg)" }
                                  : {}),
                              }}
                              onClick={() => {
                                onSelectGroup(
                                  group.documentGroupId,
                                  group.documentType,
                                  section.direction,
                                  groupLabel,
                                );
                                requestAnimationFrame(() => onSelectCommit?.());
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  onSelectGroup(
                                    group.documentGroupId,
                                    group.documentType,
                                    section.direction,
                                    groupLabel,
                                  );
                                  requestAnimationFrame(() => onSelectCommit?.());
                                }
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
  getTypeLabel: (documentType: string, fallback: string) => string,
): Array<
  | { kind: "type"; documentType: string; direction: string; label: string; groupId: string | null }
  | { kind: "group"; groupId: string; documentType: string; direction: string; label: string }
> {
  const nodes: Array<
    | {
        kind: "type";
        documentType: string;
        direction: string;
        label: string;
        groupId: string | null;
      }
    | { kind: "group"; groupId: string; documentType: string; direction: string; label: string }
  > = [];
  for (const section of sections) {
    if (!expandedDirs.has(section.direction)) continue;
    for (const type of section.types) {
      nodes.push({
        kind: "type",
        documentType: type.documentType,
        direction: section.direction,
        label: getTypeLabel(type.documentType, type.typeLabel),
        groupId: type.mainGroup?.documentGroupId ?? null,
      });
      for (const group of type.groups) {
        const label = `${group.documentType}${String(group.groupNumber).padStart(2, "0")} – ${group.name}`;
        nodes.push({
          kind: "group",
          groupId: group.documentGroupId,
          documentType: group.documentType,
          direction: section.direction,
          label,
        });
      }
    }
  }
  return nodes;
}

function DocumentsModule() {
  const { state: focusState, setFocus } = useFocus();
  const { registerCommand } = useCommands();
  const { setSubCrumb } = useActionBar();
  const { t } = useTranslation("ui");
  const getTypeLabel = useCallback(
    (documentType: string, fallback: string) =>
      t(`documentTypes.${documentType}`, { defaultValue: fallback }),
    [t],
  );
  const getDirectionLabel = useCallback(
    (direction: string, fallback: string) =>
      t(`documentDirections.${direction}`, { defaultValue: fallback }),
    [t],
  );
  const queryClient = useQueryClient();
  const documentGridRef = React.useRef<DataGridHandle>(null);
  const [editorDocId, setEditorDocId] = useState<string | null>(null);
  const [editorGroupId, setEditorGroupId] = useState<string | undefined>(undefined);
  const [selection, setSelection] = useState<TreeSelection>({ kind: "all" });
  // Ref so command handlers always see the latest selection without re-registering
  const selectionRef = React.useRef(selection);
  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);
  const [expandedDirections, setExpandedDirections] = useState<Set<string>>(
    () => new Set(["OUTBOUND", "INBOUND"]),
  );
  const [conversionDialog, setConversionDialog] = useState<{
    open: boolean;
    recordId: string | null;
    candidates: Array<{
      documentGroupId: string;
      name: string;
      documentType: string;
      groupNumber: number;
    }>;
  }>({ open: false, recordId: null, candidates: [] });
  const [duplicateDialog, setDuplicateDialog] = useState<{
    open: boolean;
    recordId: string | null;
    candidates: DocumentTargetGroupCandidate[];
    selectedGroupId: string | null;
    isPending: boolean;
  }>({ open: false, recordId: null, candidates: [], selectedGroupId: null, isPending: false });
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(
    focusState.entity === "document" ? focusState.recordId : null,
  );
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const lastSyncIdRef = React.useRef<string | null>(activeDocumentId);
  const gridState = useGridUrlState({ defaultPageSize: 50 });
  const documentRestoreIdRef = React.useRef<string | null | undefined>(undefined);
  const prevEditorDocIdRef = React.useRef<string | null>(editorDocId);

  useEffect(() => () => setSubCrumb(undefined), [setSubCrumb]);

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await fetch("/api/me");
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: companies = EMPTY_ARRAY } = useQuery({
    queryKey: ["data", "company", "tenant-options"],
    queryFn: async () => {
      const res = await fetch("/api/data/company?orderBy=companyNo:asc&limit=200");
      if (!res.ok) return [];
      return res.json();
    },
  });

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (companies.length === 0) {
        setSelectedCompanyId(null);
        return;
      }
      setSelectedCompanyId((current) => {
        if (current && companies.some((row: any) => row.companyId === current)) return current;
        const preferred = me?.lastCompanyId;
        if (preferred && companies.some((row: any) => row.companyId === preferred))
          return preferred;
        return companies[0]?.companyId ?? null;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [companies, me?.lastCompanyId]);

  const persistSelectedCompany = useCallback(
    async (companyId: string) => {
      setSelectedCompanyId(companyId);
      await fetch("/api/me/company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    [queryClient],
  );

  useEffect(() => {
    if (
      focusState.entity === "document" &&
      focusState.recordId &&
      focusState.recordId !== lastSyncIdRef.current
    ) {
      lastSyncIdRef.current = focusState.recordId;
      setActiveDocumentId(focusState.recordId);
    }
  }, [focusState.entity, focusState.recordId]);

  useEffect(() => {
    const prevEditorDocId = prevEditorDocIdRef.current;
    prevEditorDocIdRef.current = editorDocId;
    if (prevEditorDocId === null || editorDocId !== null) return;
    const restoreId =
      documentRestoreIdRef.current === undefined ? activeDocumentId : documentRestoreIdRef.current;
    documentRestoreIdRef.current = undefined;
    requestAnimationFrame(() => documentGridRef.current?.restoreFocus(restoreId ?? null));
  }, [editorDocId, activeDocumentId]);

  // Fetch documents — paginated, filtered by tree selection
  const { data: documentData, isLoading: isDataLoading } = useQuery({
    queryKey: [
      "data",
      "document",
      selection,
      gridState.queryParams.page,
      gridState.queryParams.limit,
      gridState.queryParams.orderBy,
      gridState.queryParams.search,
      gridState.queryParams.filters,
      selectedCompanyId,
    ],
    queryFn: async () => {
      const p = new URLSearchParams({
        paginated: "true",
        page: String(gridState.queryParams.page),
        limit: String(gridState.queryParams.limit),
      });
      if (gridState.queryParams.orderBy) p.set("orderBy", gridState.queryParams.orderBy);
      if (gridState.queryParams.search) p.set("search", gridState.queryParams.search);
      if (gridState.queryParams.filters)
        p.set("filters", JSON.stringify(gridState.queryParams.filters));
      if (selection.kind === "group") p.set("documentGroupId", selection.groupId);
      else if (selection.kind === "type") p.set("documentType", selection.documentType);
      if (selectedCompanyId) p.set("companyId", selectedCompanyId);
      const res = await fetch(`/api/data/document?${p}`);
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json() as Promise<{ data: any[]; total: number }>;
    },
    enabled: !!selectedCompanyId,
  });

  const documents = useMemo(() => documentData?.data ?? EMPTY_ARRAY, [documentData]);

  // Fetch document tree sections — always fresh, no stale cache
  const {
    data: treeSections = [],
    isLoading: isTreeLoading,
    error: treeError,
  } = useQuery({
    queryKey: ["documents", "tree", selectedCompanyId],
    staleTime: 0,
    queryFn: async () => {
      const p = new URLSearchParams();
      if (selectedCompanyId) p.set("companyId", selectedCompanyId);
      const res = await fetch(`/api/documents/tree?${p}`);
      if (!res.ok) {
        const text = await res.text();
        console.error("[Tree] fetch failed", res.status, text);
        throw new Error(`Tree fetch ${res.status}: ${text}`);
      }
      const raw = await res.json();
      // Normalise: older cached format may have `groups` instead of `types`
      return (raw as any[]).map((s: any) => ({
        ...s,
        types: (s.types ?? s.groups ?? []).map((t: any) => ({
          ...t,
          mainGroup: t.mainGroup ?? (t.groups ?? []).find((g: any) => g.groupNumber === 0) ?? null,
          groups: (t.groups ?? []).filter((g: any) => g.groupNumber > 0),
        })),
      })) as TreeSection[];
    },
    enabled: !!selectedCompanyId,
  });

  if (treeError) console.error("[Tree] query error", treeError);

  const { data: addresses = EMPTY_ARRAY } = useQuery({
    queryKey: ["data", "address", "all"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const res = await fetch("/api/data/address");
      if (!res.ok) throw new Error("Failed to fetch addresses");
      return res.json();
    },
  });

  const { data: documentGroups = EMPTY_ARRAY } = useQuery({
    queryKey: ["data", "documentGroup", "all", selectedCompanyId],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const p = new URLSearchParams();
      if (selectedCompanyId) p.set("companyId", selectedCompanyId);
      const res = await fetch(`/api/data/documentGroup?${p}`);
      if (!res.ok) throw new Error("Failed to fetch document groups");
      return res.json();
    },
    enabled: !!selectedCompanyId,
  });

  const { data: warehouses = EMPTY_ARRAY } = useQuery({
    queryKey: ["data", "warehouse", "all", selectedCompanyId],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const p = new URLSearchParams();
      if (selectedCompanyId) p.set("companyId", selectedCompanyId);
      const res = await fetch(`/api/data/warehouse?${p}`);
      if (!res.ok) throw new Error("Failed to fetch warehouses");
      return res.json();
    },
    enabled: !!selectedCompanyId,
  });

  const addressMap = useMemo(
    () => new Map<string, any>((addresses || EMPTY_ARRAY).map((a: any) => [a.addressId, a])),
    [addresses],
  );
  const groupMap = useMemo(
    () =>
      new Map<string, any>((documentGroups || EMPTY_ARRAY).map((g: any) => [g.documentGroupId, g])),
    [documentGroups],
  );
  const warehouseMap = useMemo(
    () => new Map<string, any>((warehouses || EMPTY_ARRAY).map((w: any) => [w.warehouseId, w])),
    [warehouses],
  );
  const onTreeSelectionCommitted = useCallback(() => {
    documentGridRef.current?.restoreFocus(activeDocumentId ?? null);
  }, [activeDocumentId]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setSelection({ kind: "all" });
      setActiveDocumentId(null);
      setEditorDocId(null);
      setEditorGroupId(undefined);
      setSubCrumb(undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedCompanyId, setSubCrumb]);

  // Fetch document lines for selected document (server-side FK filter)
  const { data: lines = EMPTY_ARRAY } = useQuery({
    queryKey: ["data", "documentLine", activeDocumentId],
    queryFn: async () => {
      const res = await fetch(
        `/api/data/documentLine?documentId=${activeDocumentId}&orderBy=lineNo:asc`,
      );
      if (!res.ok) throw new Error("Failed to fetch document lines");
      return res.json();
    },
    enabled: !!activeDocumentId,
    placeholderData: keepPreviousData,
  });

  const handleSelectType = (
    documentType: string,
    direction: string,
    label: string,
    groupId: string | null,
  ) => {
    setSelection({ kind: "type", documentType, direction, groupId });
    setSubCrumb(label);
    gridState.setPage(1);
    setFocus({
      area: "tree",
      treeEntity: "documentType",
      treePanel: "document-tree",
      treeRecordId: documentType,
    });
  };

  const handleSelectGroup = (
    groupId: string,
    documentType: string,
    direction: string,
    label: string,
  ) => {
    setSelection({ kind: "group", groupId, documentType, direction });
    setSubCrumb(label);
    gridState.setPage(1);
    setFocus({
      area: "tree",
      treeEntity: "documentGroup",
      treePanel: "document-tree",
      treeRecordId: groupId,
    });
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
    if (editorDocId) return;

    const unregF3 = registerCommand({
      id: "create-record",
      scope: "context",
      group: "recordOps",
      label: { en: t("commands.newRecord"), de: "Neuer Beleg" },
      shortcut: "F3",
      isEnabled: () => true,
      handler: () => {
        const sel = selectionRef.current;
        documentRestoreIdRef.current = undefined;
        setEditorGroupId(
          sel.kind === "group"
            ? sel.groupId
            : sel.kind === "type"
              ? (sel.groupId ?? undefined)
              : undefined,
        );
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
        if (s.recordId) {
          documentRestoreIdRef.current = undefined;
          setEditorGroupId(undefined);
          setEditorDocId(s.recordId);
        }
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
        if (s.recordId) {
          documentRestoreIdRef.current = undefined;
          setEditorGroupId(undefined);
          setEditorDocId(s.recordId);
        }
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
      id: "delete-record",
      scope: "context",
      group: "recordOps",
      label: { en: t("actions.delete"), de: "Löschen" },
      shortcut: "F4",
      isEnabled: (s) => !!s.recordId && s.entity === "document",
      handler: async (s) => {
        if (!s.recordId) return;
        const res = await fetch(`/api/documents/${s.recordId}/delete`, {
          method: "POST",
        });
        if (!res.ok) {
          const message = await res.text();
          toast.error(message || t("form.fkViolationError"));
          return;
        }
        const result = await res.json();
        if (result.archived) {
          toast.success(t("form.archiveSuccess"));
        } else if (result.deleted) {
          toast.success(t("form.deleteSuccess"));
        }
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
        const res = await fetch(`/api/documents/${s.recordId}/duplicate`, { method: "POST" });
        if (!res.ok) {
          const message = await res.text();
          toast.error(message || t("document.duplicate.noTargets"));
          return;
        }
        const data = (await res.json()) as { candidates?: DocumentTargetGroupCandidate[] };
        const candidates = data.candidates ?? [];
        if (candidates.length === 0) {
          toast.error(t("document.duplicate.noTargets"));
          return;
        }
        setDuplicateDialog({
          open: true,
          recordId: s.recordId,
          candidates,
          selectedGroupId: candidates[0]?.documentGroupId ?? null,
          isPending: false,
        });
      },
    });
    const unregPrint = registerCommand({
      id: "print-document",
      scope: "context",
      group: "workflow",
      label: { en: "Print Document", de: "Beleg drucken" },
      shortcut: "F6",
      isEnabled: (s) => !!s.recordId && s.entity === "document",
      handler: (s) => {
        if (!s.recordId) return;
        window.open(`/api/documents/${s.recordId}/print`, "_blank", "noopener,noreferrer");
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
        const res = await fetch(`/api/documents/${s.recordId}/post`, {
          method: "POST",
        });
        if (!res.ok) {
          const message = await res.text();
          toast.error(message || "Unable to post document");
          return;
        }
        queryClient.invalidateQueries({ queryKey: ["data", "document"] });
        queryClient.invalidateQueries({ queryKey: ["data", "documentLine"] });
      },
    });
    return () => {
      unregF3();
      unregEdit();
      unregF9();
      unregF7();
      unregF4();
      unregDup();
      unregPrint();
      unregPost();
    };
  }, [registerCommand, t, queryClient, editorDocId]);

  // Tree keyboard navigation
  useEffect(() => {
    const flatNodes = buildFlatNodes(treeSections, expandedDirections, getTypeLabel);

    const currentIdx = flatNodes.findIndex((n) => {
      if (selection.kind === "type")
        return n.kind === "type" && n.documentType === selection.documentType;
      if (selection.kind === "group")
        return n.kind === "group" && (n as any).groupId === selection.groupId;
      return false;
    });

    const navigate = (delta: number) => {
      if (flatNodes.length === 0) return;
      const base = currentIdx < 0 ? (delta > 0 ? -1 : flatNodes.length) : currentIdx;
      const idx = (base + delta + flatNodes.length) % flatNodes.length;
      const node = flatNodes[idx];
      if (!node) return;
      if (node.kind === "type") {
        setSelection({
          kind: "type",
          documentType: node.documentType,
          direction: node.direction,
          groupId: node.groupId,
        });
        setSubCrumb(node.label);
      } else {
        setSelection({
          kind: "group",
          groupId: (node as any).groupId,
          documentType: node.documentType,
          direction: node.direction,
        });
        setSubCrumb(node.label);
      }
    };

    const getCurrentDirection = () => (selection.kind === "all" ? null : selection.direction);

    const unregDown = registerCommand({
      id: "tree-nav-down",
      scope: "context",
      group: "navigation",
      label: { en: "Next Tree Item", de: "Nächster Eintrag" },
      shortcut: "Ctrl+ArrowDown",
      isEnabled: () => true,
      isVisible: () => !editorDocId,
      handler: () => navigate(1),
    });
    const unregUp = registerCommand({
      id: "tree-nav-up",
      scope: "context",
      group: "navigation",
      label: { en: "Previous Tree Item", de: "Vorheriger Eintrag" },
      shortcut: "Ctrl+ArrowUp",
      isEnabled: () => true,
      isVisible: () => !editorDocId,
      handler: () => navigate(-1),
    });
    const unregRight = registerCommand({
      id: "tree-nav-right",
      scope: "context",
      group: "navigation",
      label: { en: "Expand Direction", de: "Segment aufklappen" },
      shortcut: "Ctrl+ArrowRight",
      isEnabled: () => true,
      isVisible: () => !editorDocId,
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
      isVisible: () => !editorDocId,
      handler: () => {
        const dir = getCurrentDirection();
        if (dir && expandedDirections.has(dir)) handleToggleDirection(dir);
      },
    });

    return () => {
      unregDown();
      unregUp();
      unregRight();
      unregLeft();
    };
  }, [
    registerCommand,
    treeSections,
    expandedDirections,
    selection,
    setSubCrumb,
    editorDocId,
    getTypeLabel,
  ]);

  const selectedDocument = documents.find((d: any) => d.documentId === activeDocumentId);

  const dependentTabs = useMemo(
    () => [
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
            className="h-full rounded-none border-none"
            columns={[
              {
                key: "lineNo",
                header: "Pos.",
                isNumeric: true,
                render: (r: any) => (
                  <span className="font-mono tabular-nums">
                    {String(r.lineNo ?? 0).padStart(3, "0")}
                  </span>
                ),
              },
              {
                key: "articleId",
                header: "Article",
                render: (r: any) => <span className="font-mono text-[12px]">{r.articleId}</span>,
              },
              { key: "articleTextSnapshot", header: "Description" },
              {
                key: "quantity",
                header: "Qty",
                isNumeric: true,
                render: (r: any) => (
                  <span className="tabular-nums">
                    {r.quantity} {r.unit}
                  </span>
                ),
              },
              {
                key: "netPrice",
                header: "Unit Price",
                isNumeric: true,
                render: (r: any) => (
                  <span className="tabular-nums">{formatMoney(r.netPrice ?? 0)}</span>
                ),
              },
              {
                key: "discountPercentage",
                header: "Disc.",
                isNumeric: true,
                render: (r: any) => (
                  <span className="tabular-nums">{r.discountPercentage ?? 0}%</span>
                ),
              },
              {
                key: "lineTotalNet",
                header: "Total",
                isNumeric: true,
                render: (r: any) => (
                  <span className="tabular-nums">{formatMoney(r.lineTotalNet ?? 0)}</span>
                ),
              },
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
            recordId={activeDocumentId ?? undefined}
            sections={[
              {
                title: "Document",
                fields: [
                  {
                    label: "No.",
                    value: (
                      <span className="font-mono tabular-nums">{selectedDocument?.documentNo}</span>
                    ),
                  },
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
    ],
    [lines, selectedDocument, activeDocumentId],
  );

  return (
    <>
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-hairline bg-canvas px-4">
          <span className="text-[11px] font-medium tracking-wider text-ink-mute uppercase">
            Company
          </span>
          <select
            value={selectedCompanyId ?? ""}
            disabled={companies.length === 0}
            onChange={(event) => {
              if (event.target.value) void persistSelectedCompany(event.target.value);
            }}
            className="h-7 min-w-56 rounded border border-hairline-input bg-canvas px-2 text-[12px] text-ink outline-none focus-visible:border-primary"
          >
            {companies.map((row: any) => (
              <option key={row.companyId} value={row.companyId}>
                {[row.companyNo, row.name].filter(Boolean).join(" - ")}
              </option>
            ))}
          </select>
        </div>
        <div className="min-h-0 flex-1">
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
                getTypeLabel={getTypeLabel}
                getDirectionLabel={getDirectionLabel}
                onSelectCommit={onTreeSelectionCommitted}
                header={t("tree.types")}
              />
            }
            primaryGrid={
              editorDocId ? (
                <DocumentEditor
                  documentId={editorDocId}
                  documentGroupId={editorGroupId}
                  companyId={selectedCompanyId ?? undefined}
                  onCreateNewDocument={(groupId) => {
                    documentRestoreIdRef.current = undefined;
                    setEditorGroupId(groupId);
                    setEditorDocId("__new__");
                  }}
                  onSaved={(savedId) => {
                    documentRestoreIdRef.current = savedId;
                  }}
                  onClose={() => {
                    setEditorDocId(null);
                    setEditorGroupId(undefined);
                  }}
                />
              ) : (
                <DataGrid
                  ref={documentGridRef}
                  entityName="document"
                  panelId="document-grid"
                  data={documents}
                  isLoading={isDataLoading}
                  keyExtractor={(row: any) => row.documentId}
                  title={t("nav.documents")}
                  columns={[
                    {
                      key: "documentNo",
                      header: "Beleg-Nr.",
                      sortable: true,
                      render: (r: any) => (
                        <span className="font-mono tabular-nums">{r.documentNo}</span>
                      ),
                    },
                    {
                      key: "documentType",
                      header: "Typ",
                      render: (r: any) => (
                        <span
                          className="font-mono text-[11px]"
                          title={DOC_TYPE_LABELS[r.documentType]}
                        >
                          {r.documentType}
                        </span>
                      ),
                    },
                    {
                      key: "documentGroupId",
                      header: "Gruppe",
                      render: (r: any) => (
                        <span>{groupMap.get(r.documentGroupId)?.name ?? ""}</span>
                      ),
                    },
                    {
                      key: "documentDate",
                      header: "Datum",
                      isNumeric: true,
                      sortable: true,
                      render: (r: any) => (
                        <span className="tabular-nums">{formatDate(r.documentDate)}</span>
                      ),
                    },
                    {
                      key: "customerId",
                      header: "Adresse",
                      render: (r: any) => (
                        <span>{addressDisplayName(addressMap.get(r.customerId))}</span>
                      ),
                    },
                    {
                      key: "warehouseId",
                      header: "Lager",
                      render: (r: any) => (
                        <span>{warehouseMap.get(r.warehouseId)?.name ?? ""}</span>
                      ),
                    },
                    { key: "currencyId", header: "Währung" },
                    {
                      key: "totalNet",
                      header: "Netto",
                      isNumeric: true,
                      sortable: true,
                      render: (r: any) => (
                        <span className="tabular-nums">
                          {r.totalNet != null ? formatMoney(r.totalNet) : ""}
                        </span>
                      ),
                    },
                    {
                      key: "totalGross",
                      header: "Gesamt",
                      isNumeric: true,
                      sortable: true,
                      render: (r: any) => (
                        <span className="tabular-nums">
                          {r.totalGross != null ? formatMoney(r.totalGross) : ""}
                        </span>
                      ),
                    },
                    {
                      key: "status",
                      header: "Status",
                      sortable: true,
                      render: (r: any) => <StatusDot status={r.status ?? "draft"} />,
                    },
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
                  bulkActions={[
                    {
                      label: "Delete",
                      variant: "destructive" as const,
                      onClick: async (keys: string[]) => {
                        try {
                          await Promise.all(
                            keys.map(async (id) => {
                              const res = await fetch(`/api/documents/${id}/delete`, {
                                method: "POST",
                              });
                              if (!res.ok) throw new Error(await res.text());
                            }),
                          );
                          queryClient.invalidateQueries({ queryKey: ["data", "document"] });
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
                  onRowOpen={(row: any) => {
                    documentRestoreIdRef.current = undefined;
                    setEditorGroupId(undefined);
                    setEditorDocId(row.documentId);
                  }}
                  emptyTitle="No documents yet."
                  emptySubtitle="Create the first document."
                  emptyAction={{
                    label: `${t("actions.new")} Document`,
                    kbd: "F3",
                    onClick: () => {
                      const sel = selectionRef.current;
                      documentRestoreIdRef.current = undefined;
                      setEditorGroupId(
                        sel.kind === "group"
                          ? sel.groupId
                          : sel.kind === "type"
                            ? (sel.groupId ?? undefined)
                            : undefined,
                      );
                      setEditorDocId("__new__");
                    },
                  }}
                  className="h-full rounded-none border-none"
                />
              )
            }
            dependentContext={editorDocId ? null : <ContextTabs tabs={dependentTabs} />}
          />
        </div>
      </div>

      <DocumentTargetGroupDialog
        open={duplicateDialog.open}
        onOpenChange={(open) => setDuplicateDialog((p) => ({ ...p, open }))}
        title="Zielgruppe wählen"
        description="Mehrere Zielgruppen verfügbar. Bitte eine Zielgruppe auswählen."
        candidates={duplicateDialog.candidates}
        selectedGroupId={duplicateDialog.selectedGroupId}
        confirmLabel="Duplizieren"
        confirmPendingLabel="Dupliziere..."
        isPending={duplicateDialog.isPending}
        onSelectGroupId={(groupId) =>
          setDuplicateDialog((p) => ({ ...p, selectedGroupId: groupId }))
        }
        onConfirm={async () => {
          const targetGroupId =
            duplicateDialog.selectedGroupId ?? duplicateDialog.candidates[0]?.documentGroupId;
          if (!duplicateDialog.recordId || !targetGroupId) return;
          setDuplicateDialog((p) => ({ ...p, isPending: true }));
          try {
            const res = await fetch(`/api/documents/${duplicateDialog.recordId}/duplicate`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ targetGroupId }),
            });
            if (res.ok) {
              setDuplicateDialog({
                open: false,
                recordId: null,
                candidates: [],
                selectedGroupId: null,
                isPending: false,
              });
              queryClient.invalidateQueries({ queryKey: ["data", "document"] });
              toast.success("Document duplicated");
            } else {
              toast.error("Unable to duplicate document");
            }
          } finally {
            setDuplicateDialog((p) => ({ ...p, isPending: false }));
          }
        }}
      />

      <Dialog
        open={conversionDialog.open}
        onOpenChange={(open) => setConversionDialog((p) => ({ ...p, open }))}
      >
        <DialogContent className="max-w-sm overflow-hidden p-0">
          <div className="border-b border-hairline px-5 py-4">
            <h3 className="text-[15px] font-medium text-ink">Zielgruppe wählen</h3>
            <p className="mt-0.5 text-[13px] text-ink-mute">
              Mehrere Gruppen verfügbar. Bitte eine Zielgruppe auswählen.
            </p>
          </div>
          <div className="flex flex-col py-1">
            {conversionDialog.candidates.map((c) => (
              <button
                key={c.documentGroupId}
                type="button"
                className="h-9 px-5 text-left text-[13px] transition-colors hover:bg-canvas-soft"
                onClick={async () => {
                  setConversionDialog((p) => ({ ...p, open: false }));
                  const res = await fetch(`/api/documents/${conversionDialog.recordId}/convert`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ targetGroupId: c.documentGroupId }),
                  });
                  if (res.ok) {
                    queryClient.invalidateQueries({ queryKey: ["data", "document"] });
                  }
                }}
              >
                <span className="mr-2 font-mono text-[12px] text-ink-secondary">
                  {c.documentType}
                  {String(c.groupNumber).padStart(2, "0")}
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
