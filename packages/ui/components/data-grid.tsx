import { useQuery } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef as TsColumnDef,
  type ColumnOrderState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  InboxIcon,
  PlusIcon,
  FilterIcon,
  RefreshCwIcon,
  DownloadIcon,
  MoreHorizontalIcon,
  ColumnsIcon,
  ChevronUpIcon,
  XIcon,
  SearchIcon,
  GripVerticalIcon,
  PinIcon,
} from "lucide-react";
import React, {
  forwardRef,
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useImperativeHandle,
} from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { cn } from "../lib/utils";
import { useDesigner } from "../platform/designer-context";
import { useFocus } from "../platform/focus-manager";
import type { FilterOp, FilterRule } from "../types/grid";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "./dropdown-menu";
import { Skeleton } from "./skeleton";

export type { FilterOp, FilterRule };

export type RelationFilterMode = "lookup-eq" | "join-text";

export interface ColumnDef<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  align?: "left" | "center" | "right";
  isNumeric?: boolean;
  width?: string;
  sortable?: boolean;
  type?: "text" | "number" | "date" | "boolean" | "relation";
  pin?: "left" | "right";
  renderValue?: (row: T) => string;
  getSearchValue?: (row: T) => string;
  relation?: {
    entity: string;
    fkField: string;
    labelField: string;
    mode: RelationFilterMode;
    resolveLabelToId?: (label: string) => string | null;
  };
}

export interface BulkAction {
  label: string;
  variant?: "default" | "destructive";
  icon?: React.ReactNode;
  onClick: (keys: string[]) => void | Promise<void>;
}

export interface DataGridProps<T> {
  entityName: string;
  data: T[];
  columns?: ColumnDef<T>[];
  keyExtractor: (row: T) => string;
  className?: string;
  panelId?: string;
  isLoading?: boolean;
  title?: string;
  emptyTitle?: string;
  emptySubtitle?: string;
  emptyAction?: { label: string; kbd?: string; onClick: () => void };
  toolbar?: boolean;
  onRowClick?: (row: T) => void;
  flush?: boolean;
  // Pagination — only active when totalCount is provided
  totalCount?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  // Sorting — server-side when onSortChange provided, client-side fallback otherwise
  sort?: { key: string; dir: "asc" | "desc" } | null;
  onSortChange?: (sort: { key: string; dir: "asc" | "desc" } | null) => void;
  // Row opening — double-click + Enter
  onRowOpen?: (row: T) => void;
  // Search
  search?: string;
  onSearchChange?: (search: string) => void;
  // Filters
  filters?: FilterRule[];
  onFiltersChange?: (filters: FilterRule[]) => void;
  // Selection
  selectable?: boolean;
  onSelectionChange?: (keys: string[]) => void;
  bulkActions?: BulkAction[];
  // Enable virtual scrolling — only beneficial for very large flat lists (>500 rows)
  virtualized?: boolean;
}

export interface DataGridHandle {
  restoreFocus: (recordId?: string | null) => void;
  focusContainer: () => void;
}

function colFlexStyle(width?: string): React.CSSProperties {
  if (width) return { flex: `0 0 ${width}`, width, overflow: "hidden" };
  return { flex: 1, minWidth: 0, overflow: "hidden" };
}

const OPS_BY_TYPE: Record<string, Array<{ value: FilterOp; label: string }>> = {
  text: [
    { value: "contains", label: "Contains" },
    { value: "not_contains", label: "Does not contain" },
    { value: "eq", label: "Is" },
    { value: "neq", label: "Is not" },
    { value: "starts_with", label: "Starts with" },
    { value: "ends_with", label: "Ends with" },
    { value: "is_empty", label: "Is empty" },
    { value: "is_not_empty", label: "Is not empty" },
  ],
  number: [
    { value: "eq", label: "=" },
    { value: "neq", label: "≠" },
    { value: "gt", label: ">" },
    { value: "gte", label: "≥" },
    { value: "lt", label: "<" },
    { value: "lte", label: "≤" },
    { value: "is_empty", label: "Is empty" },
    { value: "is_not_empty", label: "Is not empty" },
  ],
  date: [
    { value: "eq", label: "On" },
    { value: "gt", label: "After" },
    { value: "gte", label: "On or after" },
    { value: "lt", label: "Before" },
    { value: "lte", label: "On or before" },
    { value: "is_empty", label: "Is empty" },
    { value: "is_not_empty", label: "Is not empty" },
  ],
  boolean: [{ value: "eq", label: "Is" }],
};

function getColType(col: ColumnDef<any> | undefined): string {
  return col?.type ?? (col?.isNumeric ? "number" : "text");
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parseColumnOrder(value: unknown): string[] | null {
  if (isStringArray(value)) return value;
  if (isRecord(value)) {
    const candidate =
      value.columnOrder ?? value.columns ?? value.order ?? value.layoutDefinition?.columnOrder;
    if (isStringArray(candidate)) return candidate;
  }
  return null;
}

function normalizeColumnOrder(order: string[] | null, columns: ColumnDef<any>[]) {
  const normalized = order?.filter((key) => columns.some((column) => column.key === key)) ?? [];
  const seen = new Set(normalized);
  for (const column of columns) {
    if (!seen.has(column.key)) {
      normalized.push(column.key);
      seen.add(column.key);
    }
  }
  return normalized;
}

function orderColumns<T>(columns: ColumnDef<T>[], order: string[]) {
  const byKey = new Map(columns.map((column) => [column.key, column]));
  const ordered = order
    .map((key) => byKey.get(key))
    .filter((column): column is ColumnDef<T> => Boolean(column));
  const remaining = columns.filter((column) => !order.includes(column.key));
  return [...ordered, ...remaining];
}

function reorderColumnKeys(
  order: string[],
  draggedKey: string,
  targetKey: string,
  position: "before" | "after",
) {
  if (draggedKey === targetKey) return order;

  const next = order.filter((key) => key !== draggedKey);
  const targetIndex = next.indexOf(targetKey);
  if (targetIndex < 0) return order;

  const insertAt = position === "before" ? targetIndex : targetIndex + 1;
  next.splice(insertAt, 0, draggedKey);
  return next;
}

function isSameColumnOrder(left: string[] | null, right: string[] | null) {
  if (left === right) return true;
  if (!left || !right) return false;
  if (left.length !== right.length) return false;
  return left.every((key, index) => key === right[index]);
}

type DesignerColumnDraft = {
  key: string;
  visible: boolean;
  width?: string;
  pin?: "left" | "right" | null;
  order: number;
  identity: string;
  conflictState: string | null;
};

type DesignerRuntimeContext = {
  isDesignMode: boolean;
  delta: {
    columns: DesignerColumnDraft[];
    fieldConfigs: unknown[];
    activeDragId: string | null;
    hoverTargetId: string | null;
  };
  initColumns: (
    cols: {
      key: string;
      header: string;
      visible?: boolean;
      width?: string;
      pin?: "left" | "right" | null;
    }[],
  ) => void;
  addColumnDraft?: (label?: string) => void;
  normalized?: unknown;
  normalizedState?: unknown;
  state?: { normalized?: unknown };
  selectedNodeKey?: string | null;
  selection?: { nodeKey?: string | null; selectedNodeKey?: string | null } | null;
  surface?: string | null;
  activeSurface?: string | null;
  currentSurface?: string | null;
  entityName?: string | null;
  entity?: string | null;
};

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPath(value: unknown, path: string[]): unknown {
  let current: unknown = value;
  for (const segment of path) {
    if (!isRecord(current)) return undefined;
    current = current[segment];
  }
  return current;
}

function firstArrayAtPaths(value: unknown, paths: string[][]): unknown[] | null {
  for (const path of paths) {
    const candidate = readPath(value, path);
    if (Array.isArray(candidate)) return candidate;
  }
  return null;
}

function collectDesignerObjects(
  value: unknown,
  out: Record<string, any>[] = [],
  seen = new Set<object>(),
): Record<string, any>[] {
  if (!value || typeof value !== "object") return out;
  if (seen.has(value as object)) return out;
  seen.add(value as object);

  if (Array.isArray(value)) {
    for (const item of value) {
      collectDesignerObjects(item, out, seen);
    }
    return out;
  }

  const record = value as Record<string, any>;
  const kind = typeof record.kind === "string" ? record.kind : null;
  const nodeKind = typeof record.nodeKind === "string" ? record.nodeKind : null;
  const type = typeof record.type === "string" ? record.type : null;
  if (kind || nodeKind || type) {
    out.push(record);
  }

  for (const key of [
    "nodes",
    "children",
    "columns",
    "gridColumns",
    "items",
    "layout",
    "contract",
  ]) {
    collectDesignerObjects(record[key], out, seen);
  }

  return out;
}

function readDesignerRoot(designer: DesignerRuntimeContext): unknown {
  return designer.normalized ?? designer.normalizedState ?? designer.state?.normalized ?? null;
}

function readDesignerSelectionKey(designer: DesignerRuntimeContext): string | null {
  const root = readDesignerRoot(designer);
  const candidates = [
    designer.selectedNodeKey,
    designer.selection?.selectedNodeKey ?? null,
    designer.selection?.nodeKey ?? null,
    (isRecord(root) ? (root.selectedNodeKey as string | null | undefined) : null) ?? null,
    (isRecord(root) ? (root.selectedNode?.id as string | null | undefined) : null) ?? null,
    (isRecord(root) ? (root.selection?.selectedNodeKey as string | null | undefined) : null) ??
      null,
    (isRecord(root) ? (root.selection?.nodeKey as string | null | undefined) : null) ?? null,
  ];
  return (
    candidates.find((value): value is string => typeof value === "string" && value.length > 0) ??
    null
  );
}

function readDesignerIdentityContext(designer: DesignerRuntimeContext) {
  const entityName =
    designer.entityName ??
    designer.entity ??
    (isRecord(designer.normalized)
      ? (designer.normalized.entityName as string | null | undefined)
      : null) ??
    (isRecord(designer.normalizedState)
      ? (designer.normalizedState.entityName as string | null | undefined)
      : null) ??
    null;
  const surface =
    designer.surface ??
    designer.activeSurface ??
    designer.currentSurface ??
    (isRecord(designer.normalized)
      ? (designer.normalized.surface as string | null | undefined)
      : null) ??
    (isRecord(designer.normalizedState)
      ? (designer.normalizedState.surface as string | null | undefined)
      : null) ??
    null;
  return { entityName, surface };
}

function normalizeDesignerColumnDraft(
  value: unknown,
  index: number,
  entityName: string | null,
  surface: string | null,
): DesignerColumnDraft | null {
  if (!isRecord(value)) return null;

  const key =
    (typeof value.key === "string" && value.key) ||
    (typeof value.nodeKey === "string" && value.nodeKey) ||
    (typeof value.fieldKey === "string" && value.fieldKey) ||
    (typeof value.metadataKey === "string" && value.metadataKey) ||
    (typeof value.id === "string" && value.id) ||
    null;
  if (!key) return null;

  const nodeEntityName =
    (typeof value.entityName === "string" && value.entityName) ||
    (typeof value.entity === "string" && value.entity) ||
    null;
  if (entityName && nodeEntityName && nodeEntityName !== entityName) return null;

  const nodeSurface =
    (typeof value.surface === "string" && value.surface) ||
    (typeof value.surfaceName === "string" && value.surfaceName) ||
    null;
  if (surface && nodeSurface && nodeSurface !== surface) return null;

  const rawKind = typeof value.kind === "string" ? value.kind : null;
  const identity =
    (typeof value.id === "string" && value.id) ||
    (typeof value.metadataKey === "string" && value.metadataKey) ||
    (typeof value.nodeId === "string" && value.nodeId) ||
    (rawKind ? `${rawKind}:${key}` : `grid-column:${key}`);
  const conflictState =
    (typeof value.conflictState === "string" && value.conflictState) ||
    (typeof value.state === "string" && value.state) ||
    null;

  const order =
    (typeof value.displayOrder === "number" && value.displayOrder) ||
    (typeof value.order === "number" && value.order) ||
    index;
  const width =
    (typeof value.width === "string" && value.width) ||
    (typeof value.size === "string" && value.size) ||
    undefined;
  const pin =
    value.pin === "left" || value.pin === "right"
      ? value.pin
      : value.pinned === "left" || value.pinned === "right"
        ? value.pinned
        : null;

  return {
    key,
    visible: value.visible !== false,
    width,
    pin,
    order,
    identity,
    conflictState,
  };
}

function readDesignerColumns(designer: DesignerRuntimeContext): DesignerColumnDraft[] {
  const root = readDesignerRoot(designer);
  if (!root) return [];

  const { entityName, surface } = readDesignerIdentityContext(designer);
  const arrayCandidate =
    firstArrayAtPaths(root, [
      ["columns"],
      ["gridColumns"],
      ["nodes"],
      ["layout", "columns"],
      ["layout", "nodes"],
      ["contract", "columns"],
      ["contract", "nodes"],
    ]) ?? [];

  if (arrayCandidate.length > 0) {
    return arrayCandidate
      .map((value, index) => normalizeDesignerColumnDraft(value, index, entityName, surface))
      .filter((value): value is DesignerColumnDraft => value !== null);
  }

  return collectDesignerObjects(root)
    .filter((value) => {
      const kind = typeof value.kind === "string" ? value.kind : null;
      const nodeKind = typeof value.nodeKind === "string" ? value.nodeKind : null;
      return (
        kind === "grid-column" ||
        kind === "column" ||
        nodeKind === "grid-column" ||
        nodeKind === "column"
      );
    })
    .map((value, index) => normalizeDesignerColumnDraft(value, index, entityName, surface))
    .filter((value): value is DesignerColumnDraft => value !== null);
}

let _ruleIdCounter = 0;
function newRuleId() {
  return `r${++_ruleIdCounter}`;
}

function DataGridInner<T>(
  {
    entityName,
    data,
    columns: initialColumns,
    keyExtractor,
    className,
    panelId = "main-grid",
    isLoading: externalLoading,
    title,
    emptyTitle,
    emptySubtitle,
    emptyAction,
    toolbar = true,
    onRowClick,
    flush,
    totalCount,
    page = 1,
    pageSize = 50,
    onPageChange,
    onPageSizeChange,
    sort,
    onSortChange,
    onRowOpen,
    search: searchProp,
    onSearchChange,
    filters: filtersProp,
    onFiltersChange,
    selectable,
    onSelectionChange,
    bulkActions,
    virtualized = false,
  }: DataGridProps<T>,
  ref: React.ForwardedRef<DataGridHandle>,
) {
  "use no memo";
  const { t, i18n } = useTranslation("ui");
  const { state: focusState, setFocus } = useFocus();
  const designer = useDesigner() as unknown as DesignerRuntimeContext;
  const { isDesignMode, delta, initColumns, addColumnDraft } = designer;
  const { data: tenantInfo } = useQuery({
    queryKey: ["me", "grid-tenant"],
    queryFn: async () => {
      const res = await fetch("/api/me");
      if (!res.ok) return null;
      return res.json() as Promise<{
        userId: string;
        isBase?: boolean;
        isSystemAdmin?: boolean;
        tenantRole?: string | null;
      }>;
    },
    staleTime: 5 * 60 * 1000,
  });
  const userId = typeof tenantInfo?.userId === "string" ? tenantInfo.userId : null;
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [selectedColIndex, setSelectedColIndex] = useState<number>(0);
  const [transientQuery, setTransientQuery] = useState<string>("");
  const [transientSearchActive, setTransientSearchActive] = useState<boolean>(false);
  const [exporting, setExporting] = useState(false);
  const [activeSearchColKey, setActiveSearchColKey] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const colPickerRef = useRef<HTMLDivElement>(null);
  const headerCheckRef = useRef<HTMLInputElement>(null);
  // Tracks what we last set as focus so the effect doesn't loop on stale focusState
  const lastFocusRef = useRef<{ id: string; entity: string; panel: string; row: number } | null>(
    null,
  );
  const [resolvedColumns, setResolvedColumns] = useState<ColumnDef<T>[]>(initialColumns ?? []);
  const [internalLoading, setInternalLoading] = useState(!initialColumns && !!entityName);
  const [showColPicker, setShowColPicker] = useState(false);
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(
    (initialColumns ?? []).map((column) => column.key),
  );
  const [draggedColumnKey, setDraggedColumnKey] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    key: string;
    position: "before" | "after";
  } | null>(null);
  const [restoreRequest, setRestoreRequest] = useState<{
    token: number;
    recordId: string | null;
    fromIndex: number;
    dataSignature: string;
  } | null>(null);

  // Local debounced search state
  const [localSearch, setLocalSearch] = useState(searchProp ?? "");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Row selection
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const loading = internalLoading || externalLoading;
  const hasPagination = totalCount !== undefined;
  const totalPages = hasPagination ? Math.ceil(totalCount / pageSize) : 0;
  const designerColumns = useMemo(() => readDesignerColumns(designer), [designer]);
  const designerColumnByKey = useMemo(() => {
    return new Map(designerColumns.map((column) => [column.key, column]));
  }, [designerColumns]);
  const designerSelectionKey = readDesignerSelectionKey(designer);
  const activeDesignerHeaderKey =
    focusState.area === "designer" &&
    focusState.entity === entityName &&
    focusState.panel === panelId
      ? focusState.field
      : designerSelectionKey;

  // Column visibility persisted per entityName
  const visibilityStorageKey = `datagrid-cols-${entityName}`;
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    try {
      if (typeof window === "undefined") return {};
      const stored = localStorage.getItem(visibilityStorageKey);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(visibilityStorageKey, JSON.stringify(columnVisibility));
    } catch {}
  }, [columnVisibility, visibilityStorageKey]);

  const columnOrderStorageKey = userId ? `col-order:${entityName}:${panelId}:${userId}` : null;
  const [storedColumnOrder, setStoredColumnOrder] = useState<string[] | null>(() => {
    if (typeof window === "undefined" || !columnOrderStorageKey) return null;
    try {
      const stored = localStorage.getItem(columnOrderStorageKey);
      return parseColumnOrder(stored ? JSON.parse(stored) : null);
    } catch {
      return null;
    }
  });
  const { data: publishedLayout } = useQuery({
    queryKey: ["metadata", "layout", entityName, "grid"],
    queryFn: async () => {
      if (!entityName) return null;
      const res = await fetch(`/api/metadata/layout/${entityName}/grid`);
      if (!res.ok) return null;
      return res.json() as Promise<Record<string, unknown>>;
    },
    enabled: Boolean(entityName),
    staleTime: 5 * 60 * 1000,
  });
  const publishedColumnOrder = useMemo(() => parseColumnOrder(publishedLayout), [publishedLayout]);
  const publishedDefaultColumnOrder = useMemo(() => {
    const candidate = publishedColumnOrder ?? resolvedColumns.map((column) => column.key);
    return normalizeColumnOrder(candidate, resolvedColumns);
  }, [publishedColumnOrder, resolvedColumns]);
  const canPersistPublishedColumnOrder = Boolean(
    tenantInfo &&
    (tenantInfo.tenantRole === "owner" || (tenantInfo.isSystemAdmin && tenantInfo.isBase)),
  );
  const defaultColumnOrder = useMemo(
    () => normalizeColumnOrder(storedColumnOrder ?? publishedDefaultColumnOrder, resolvedColumns),
    [publishedDefaultColumnOrder, resolvedColumns, storedColumnOrder],
  );

  // Sync localSearch when prop changes externally
  useEffect(() => {
    if (searchProp !== undefined) setLocalSearch(searchProp);
  }, [searchProp]);

  // Notify parent on selection change
  useEffect(() => {
    onSelectionChange?.(Array.from(selectedKeys));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKeys]);

  // Reset selection when data changes — functional update avoids loop when selection was already empty
  useEffect(() => {
    setSelectedKeys((prev) => (prev.size === 0 ? prev : new Set()));
  }, [data]);

  // Update header checkbox indeterminate state
  useEffect(() => {
    if (!headerCheckRef.current) return;
    const allKeys = data.map((r) => keyExtractor(r));
    const selectedCount = allKeys.filter((k) => selectedKeys.has(k)).length;
    headerCheckRef.current.indeterminate = selectedCount > 0 && selectedCount < allKeys.length;
  }, [selectedKeys, data, keyExtractor]);

  // Load metadata columns when no columns prop provided
  useEffect(() => {
    let mounted = true;
    if (!initialColumns && entityName) {
      setInternalLoading(true);
      fetch(`/api/metadata/fields/${entityName}`)
        .then((res) => {
          if (!res.ok) throw new Error(`Metadata fetch failed: ${res.status}`);
          return res.json();
        })
        .then((meta) => {
          if (!mounted) return;
          const isDe = i18n.language === "de";
          const mapped: ColumnDef<T>[] = (meta as Array<Record<string, any>>)
            .filter((f) => f.isVisible !== false && f.isUuid !== true)
            .map((f) => ({
              key: f.fieldName,
              header: (isDe ? f.labelDe : f.labelEn) || f.fieldName,
              align: f.fieldType === "numeric" || f.fieldType === "integer" ? "right" : "left",
              isNumeric: f.fieldType === "numeric" || f.fieldType === "integer",
              type:
                f.fieldType === "numeric" || f.fieldType === "integer"
                  ? "number"
                  : f.fieldType === "boolean"
                    ? "boolean"
                    : f.fieldType === "date" || f.fieldType === "timestamp"
                      ? "date"
                      : "text",
            }));
          setResolvedColumns(mapped);
          // Seed designer delta with resolved columns (no-op if already initialized)
          initColumns(mapped.map((c) => ({ key: c.key, header: c.header, visible: true })));
          setInternalLoading(false);
        })
        .catch((err) => {
          console.error(
            "Failed to load metadata columns",
            err instanceof Error ? err.message : err,
          );
          if (mounted) setInternalLoading(false);
        });
    }
    return () => {
      mounted = false;
    };
  }, [entityName, i18n.language, initColumns, initialColumns]);

  useEffect(() => {
    if (!columnOrderStorageKey) {
      setStoredColumnOrder(null);
      return;
    }

    try {
      const stored = localStorage.getItem(columnOrderStorageKey);
      setStoredColumnOrder(parseColumnOrder(stored ? JSON.parse(stored) : null));
    } catch {
      setStoredColumnOrder(null);
    }
  }, [columnOrderStorageKey]);

  useEffect(() => {
    if (initialColumns) {
      const changed =
        initialColumns.length !== resolvedColumns.length ||
        initialColumns.some((col, idx) => {
          const prev = resolvedColumns[idx];
          return (
            !prev ||
            col.key !== prev.key ||
            col.header !== prev.header ||
            col.render !== prev.render ||
            col.renderValue !== prev.renderValue ||
            col.getSearchValue !== prev.getSearchValue ||
            col.type !== prev.type
          );
        });

      if (changed) {
        setResolvedColumns(initialColumns);
      }
    }
  }, [initialColumns, resolvedColumns]);

  useEffect(() => {
    if (resolvedColumns.length === 0) return;

    const selectedKey = columnOrder[selectedColIndex];
    const nextOrder = defaultColumnOrder;
    setColumnOrder((current) => {
      const same =
        current.length === nextOrder.length &&
        current.every((key, index) => key === nextOrder[index]);
      return same ? current : nextOrder;
    });
    if (selectedKey) {
      const nextIndex = nextOrder.indexOf(selectedKey);
      if (nextIndex >= 0 && nextIndex !== selectedColIndex) {
        setSelectedColIndex(nextIndex);
      }
    }
    // columnOrder is intentionally omitted to avoid clobbering user-driven reorders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultColumnOrder, resolvedColumns]);

  useEffect(() => {
    const normalized = normalizeColumnOrder(columnOrder, resolvedColumns);
    const selectedKey = columnOrder[selectedColIndex];
    if (selectedKey) {
      const nextIndex = normalized.indexOf(selectedKey);
      if (nextIndex >= 0 && nextIndex !== selectedColIndex) {
        setSelectedColIndex(nextIndex);
      }
    }
    // columnOrder is intentionally omitted to avoid a normalization loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedColumns]);

  // In design mode, honour the delta column order and visibility
  const effectiveColumns = useMemo(() => {
    const activeDraftColumns = designerColumns.length > 0 ? designerColumns : delta.columns;
    const orderedResolvedColumns = orderColumns(
      resolvedColumns,
      normalizeColumnOrder(columnOrder, resolvedColumns),
    );
    if (!isDesignMode || activeDraftColumns.length === 0) return orderedResolvedColumns;

    const draftByKey = new Map(activeDraftColumns.map((column) => [column.key, column]));
    const orderedKeys = activeDraftColumns
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((column) => column.key);

    const orderedResolved = orderedKeys
      .map((key) => {
        const baseColumn = orderedResolvedColumns.find((column) => column.key === key);
        if (!baseColumn) return null;
        const draftColumn = draftByKey.get(key);
        if (draftColumn?.visible === false) return null;
        return {
          ...baseColumn,
          width: draftColumn?.width ?? baseColumn.width,
          pin: draftColumn?.pin ?? baseColumn.pin,
        };
      })
      .filter(Boolean) as typeof resolvedColumns;

    const remainingResolved = orderedResolvedColumns.filter(
      (column) => !draftByKey.has(column.key),
    );

    const draftOnlyColumns = activeDraftColumns
      .filter((column) => !orderedResolvedColumns.some((resolved) => resolved.key === column.key))
      .filter((column) => column.visible)
      .map((column) => ({
        key: column.key,
        header: column.identity,
        width: column.width,
        pin: column.pin ?? null,
        align: "left" as const,
        isNumeric: false,
        sortable: false,
        type: "text" as const,
      }));

    return [...orderedResolved, ...remainingResolved, ...draftOnlyColumns];
  }, [columnOrder, delta.columns, designerColumns, isDesignMode, resolvedColumns]);

  // TanStack Table column definitions
  const tanstackColumns = useMemo<TsColumnDef<T>[]>(
    () =>
      effectiveColumns.map((col) => ({
        id: col.key,
        accessorFn: (row: T) => (row as Record<string, any>)[col.key],
        header: col.header,
        enableSorting: col.sortable ?? false,
      })),
    [effectiveColumns],
  );

  // Controlled (server-side) vs internal (client-side) sort
  const effectiveSorting: SortingState = onSortChange
    ? sort
      ? [{ id: sort.key, desc: sort.dir === "desc" }]
      : []
    : internalSorting;

  const handleSortingChange = (updater: SortingState | ((prev: SortingState) => SortingState)) => {
    const newSorting: SortingState =
      typeof updater === "function" ? updater(effectiveSorting) : updater;
    if (onSortChange) {
      if (newSorting.length === 0) onSortChange(null);
      else onSortChange({ key: newSorting[0].id, dir: newSorting[0].desc ? "desc" : "asc" });
    } else {
      setInternalSorting(newSorting);
    }
  };

  // eslint-disable-next-line react-hooks-js/incompatible-library
  const table = useReactTable({
    data,
    columns: tanstackColumns,
    state: { sorting: effectiveSorting, columnVisibility, columnOrder },
    onSortingChange: handleSortingChange,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: handleColumnOrderChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualSorting: !!onSortChange,
    manualPagination: true,
    rowCount: totalCount,
  });

  const rows = table.getRowModel().rows;

  const virtualizer = useVirtualizer({
    count: virtualized ? rows.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 40,
    overscan: 10,
  });

  const dataSignature = useMemo(
    () => rows.map((row) => keyExtractor(row.original)).join("\u0001"),
    [keyExtractor, rows],
  );

  const scrollRowIntoView = useCallback(
    (index: number) => {
      if (virtualized) {
        virtualizer.scrollToIndex(index, { behavior: "auto" });
      } else {
        scrollRef.current
          ?.querySelector(`[data-row-idx="${index}"]`)
          ?.scrollIntoView({ block: "nearest" });
      }
    },
    [virtualized, virtualizer],
  );

  const performSearchJump = useCallback(
    (colKey: string, query: string, currentIndex: number, direction: number) => {
      if (rows.length === 0 || !query) return;

      const lowerQuery = query.toLowerCase();
      const dir = direction === 0 ? 1 : direction;
      const start = direction === 0 ? currentIndex : currentIndex + direction;

      const col = effectiveColumns.find((c) => c.key === colKey) as ColumnDef<T> | undefined;

      for (let i = 0; i < rows.length; i++) {
        const idx = (start + i * dir + rows.length * 2) % rows.length;
        const row = rows[idx]?.original;
        if (!row) continue;

        let valStr = "";
        if (col?.getSearchValue) {
          valStr = col.getSearchValue(row);
        } else if (col?.renderValue) {
          valStr = col.renderValue(row);
        } else {
          const val = (row as Record<string, any>)[colKey];
          valStr = val !== undefined && val !== null ? String(val) : "";
        }

        if (valStr.toLowerCase().includes(lowerQuery)) {
          setSelectedIndex(idx);
          scrollRowIntoView(idx);
          break;
        }
      }
    },
    [rows, scrollRowIntoView, effectiveColumns],
  );

  const focusRow = useCallback(
    (index: number) => {
      if (rows.length === 0) {
        scrollRef.current?.focus();
        return;
      }
      const nextIndex = Math.max(0, Math.min(index, rows.length - 1));
      setSelectedIndex(nextIndex);
      scrollRowIntoView(nextIndex);
      requestAnimationFrame(() => {
        scrollRef.current?.focus();
      });
    },
    [rows.length, scrollRowIntoView],
  );

  const selectDesignerHeader = useCallback(
    (headerId: string) => {
      setFocus({
        area: "designer",
        entity: entityName,
        panel: panelId,
        field: headerId,
        recordId: null,
        row: null,
      });
    },
    [entityName, panelId, setFocus],
  );

  const restoreFocus = useCallback(
    (recordId?: string | null) => {
      setRestoreRequest({
        token: Date.now() + Math.random(),
        recordId: recordId ?? null,
        fromIndex: selectedIndex,
        dataSignature,
      });
    },
    [dataSignature, selectedIndex],
  );

  useImperativeHandle(
    ref,
    () => ({
      restoreFocus,
      focusContainer: () => {
        scrollRef.current?.focus();
      },
    }),
    [restoreFocus],
  );

  useEffect(() => {
    if (!restoreRequest) return;
    if (rows.length === 0) {
      if (!loading) {
        scrollRef.current?.focus();
        setRestoreRequest(null);
      }
      return;
    }

    if (restoreRequest.recordId === null) {
      focusRow(restoreRequest.fromIndex);
      setRestoreRequest(null);
      return;
    }

    const targetIndex = restoreRequest.recordId
      ? rows.findIndex((row) => keyExtractor(row.original) === restoreRequest.recordId)
      : -1;

    if (targetIndex >= 0) {
      focusRow(targetIndex);
    } else if (restoreRequest.dataSignature !== dataSignature) {
      focusRow(restoreRequest.fromIndex);
    }
    setRestoreRequest(null);
  }, [dataSignature, focusRow, keyExtractor, loading, restoreRequest, rows]);

  useEffect(() => {
    if (isDesignMode) return;
    if (data.length > 0) {
      const clampedIndex = Math.max(0, Math.min(selectedIndex, rows.length - 1));
      if (clampedIndex !== selectedIndex) {
        setSelectedIndex(clampedIndex);
      }
      const row = data[clampedIndex] ?? data[0];
      const id = keyExtractor(row);
      const last = lastFocusRef.current;
      const nextFocus = {
        entity: entityName,
        recordId: id,
        panel: panelId,
        area: "grid" as const,
        row: clampedIndex,
      };

      const shouldSetFocus = !focusState.panel || focusState.panel === panelId;
      if (
        shouldSetFocus &&
        (!last ||
          last.id !== id ||
          last.entity !== entityName ||
          last.panel !== panelId ||
          last.row !== clampedIndex)
      ) {
        lastFocusRef.current = { id, entity: entityName, panel: panelId, row: clampedIndex };
        setFocus(nextFocus);
      }
    }
    // keyExtractor is intentionally omitted — inline prop, always functionally stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    data,
    isDesignMode,
    selectedIndex,
    entityName,
    panelId,
    rows.length,
    focusState.workspace,
    focusState.panel,
  ]);

  // Scoped keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Handle keys in transient search mode first
    if (transientSearchActive) {
      if (e.key === "Escape") {
        e.preventDefault();
        setTransientSearchActive(false);
        setTransientQuery("");
        setActiveSearchColKey(null);
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        const nextQuery = transientQuery.slice(0, -1);
        setTransientQuery(nextQuery);
        if (nextQuery === "") {
          setTransientSearchActive(false);
          setActiveSearchColKey(null);
        } else {
          performSearchJump(activeSearchColKey!, nextQuery, selectedIndex, 0);
        }
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.ctrlKey) {
          // Commit search as a persistent filter
          if (onFiltersChange && activeSearchColKey) {
            let resolvedValue = transientQuery;
            let filterCol = activeSearchColKey;
            let filterOp: FilterOp = "contains";

            const col = effectiveColumns.find((c) => c.key === activeSearchColKey) as
              | ColumnDef<T>
              | undefined;

            if (col?.type === "relation" && col.relation) {
              if (col.relation.mode === "lookup-eq") {
                let fkVal = col.relation.resolveLabelToId?.(transientQuery) || null;
                if (!fkVal) {
                  // Fallback to local row search
                  const match = rows.find((r) => {
                    const label =
                      col.getSearchValue?.(r.original) || col.renderValue?.(r.original) || "";
                    return label.toLowerCase().includes(transientQuery.toLowerCase());
                  });
                  fkVal = match
                    ? (match.original as Record<string, any>)[col.relation.fkField]
                    : null;
                }

                if (fkVal) {
                  resolvedValue = String(fkVal);
                  filterCol = col.relation.fkField;
                  filterOp = "eq";
                } else {
                  // Discard query and return to prevent invalid UUID strings from crashing the DB
                  return;
                }
              } else if (col.relation.mode === "join-text") {
                filterCol = `${col.relation.entity}.${col.relation.labelField}`;
                filterOp = "contains";
              }
            } else if (activeSearchColKey.endsWith("Id")) {
              filterOp = "eq";
            }

            const active = filtersProp ?? [];
            const filtered = active.filter((f) => f.col !== filterCol);
            onFiltersChange([
              ...filtered,
              {
                id:
                  active.find((f) => f.col === filterCol)?.id ||
                  Math.random().toString(36).substring(2, 9),
                col: filterCol,
                op: filterOp,
                val: resolvedValue,
              },
            ]);
            setTransientSearchActive(false);
            setTransientQuery("");
            setActiveSearchColKey(null);
          }
        } else {
          // Find next matching row
          const direction = e.shiftKey ? -1 : 1;
          performSearchJump(activeSearchColKey!, transientQuery, selectedIndex, direction);
        }
        return;
      }

      // Capture and append alphanumeric characters during an active transient search
      const isAlphanumeric = e.key.length === 1 && /[a-zA-Z0-9\s.,\-_]/.test(e.key);
      if (isAlphanumeric && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        const nextQuery = transientQuery + e.key;
        setTransientQuery(nextQuery);
        performSearchJump(activeSearchColKey!, nextQuery, selectedIndex, 0);
        return;
      }

      // If Arrow/Tab is pressed, close transient search and let standard navigation handle it
      if (e.key.startsWith("Arrow") || e.key === "Tab") {
        setTransientSearchActive(false);
        setTransientQuery("");
        setActiveSearchColKey(null);
      } else {
        // Prevent all other default keyboard actions during active search
        e.preventDefault();
        return;
      }
    }

    if (e.ctrlKey || e.metaKey || e.altKey) {
      // Alt+S: Toggle sorting on the active column
      if (e.altKey && e.key === "s") {
        e.preventDefault();
        const col = effectiveColumns[selectedColIndex];
        if (col && col.sortable && !isDesignMode) {
          const tableCol = table.getColumn(col.key);
          tableCol?.toggleSorting();
        }
      }
      // Ctrl+L or Ctrl+F: Focus global search input in toolbar
      if (e.ctrlKey && (e.key === "l" || e.key === "f")) {
        e.preventDefault();
        const searchInput = scrollRef.current
          ?.closest(".flex-col")
          ?.querySelector("input[placeholder*='Search']");
        if (searchInput instanceof HTMLInputElement) {
          searchInput.focus();
        }
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.min(selectedIndex + 1, rows.length - 1);
      setSelectedIndex(next);
      scrollRowIntoView(next);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.max(selectedIndex - 1, 0);
      setSelectedIndex(next);
      scrollRowIntoView(next);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setSelectedColIndex((p) => Math.max(0, p - 1));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setSelectedColIndex((p) => Math.min(effectiveColumns.length - 1, p + 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setSelectedIndex(0);
      scrollRowIntoView(0);
    } else if (e.key === "End") {
      e.preventDefault();
      const last = rows.length - 1;
      setSelectedIndex(last);
      scrollRowIntoView(last);
    } else if (e.key === "Enter" && rows[selectedIndex]) {
      onRowOpen?.(rows[selectedIndex].original);
    } else if (e.key === " " && selectable && rows[selectedIndex]) {
      e.preventDefault();
      const key = keyExtractor(rows[selectedIndex].original);
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    } else if (e.key === "/") {
      e.preventDefault();
      const searchInput = scrollRef.current
        ?.closest(".flex-col")
        ?.querySelector("input[placeholder*='Search']");
      if (searchInput instanceof HTMLInputElement) {
        searchInput.focus();
      }
    } else {
      // Check for alphanumeric keys to start search mode
      const isAlphanumeric = e.key.length === 1 && /[a-zA-Z0-9\s.,\-_]/.test(e.key);
      if (isAlphanumeric && !isDesignMode) {
        const col = effectiveColumns[selectedColIndex];
        if (col) {
          e.preventDefault();
          setTransientSearchActive(true);
          setActiveSearchColKey(col.key);
          setTransientQuery(e.key);
          performSearchJump(col.key, e.key, selectedIndex, 0);
        }
      }
    }
  };

  // Close column picker on outside click
  useEffect(() => {
    if (!showColPicker) return;
    const handler = (e: MouseEvent) => {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) {
        setShowColPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showColPicker]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setLocalSearch(value);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = setTimeout(() => {
        onSearchChange?.(value);
      }, 300);
    },
    [onSearchChange],
  );

  // Filter helpers
  const activeFilters: FilterRule[] = filtersProp ?? [];

  const addFilter = () => {
    const firstCol = resolvedColumns[0];
    if (!firstCol) return;
    const colType = getColType(firstCol);
    const ops = OPS_BY_TYPE[colType] ?? OPS_BY_TYPE.text;
    const newRule: FilterRule = {
      id: newRuleId(),
      col: firstCol.key,
      op: ops[0].value,
      val: "",
    };
    onFiltersChange?.([...activeFilters, newRule]);
  };

  const updateFilter = (id: string, patch: Partial<FilterRule>) => {
    onFiltersChange?.(activeFilters.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeFilter = (id: string) => {
    onFiltersChange?.(activeFilters.filter((r) => r.id !== id));
  };

  const persistColumnOrder = useCallback(
    (nextOrder: ColumnOrderState) => {
      const normalized = normalizeColumnOrder(nextOrder, resolvedColumns);
      const selectedKey = columnOrder[selectedColIndex];
      setColumnOrder(normalized);
      setStoredColumnOrder(normalized);
      if (selectedKey) {
        const nextIndex = normalized.indexOf(selectedKey);
        if (nextIndex >= 0) {
          setSelectedColIndex(nextIndex);
        }
      }

      if (columnOrderStorageKey) {
        try {
          localStorage.setItem(columnOrderStorageKey, JSON.stringify(normalized));
        } catch {
          // Ignore storage failures in restrictive browser modes.
        }
      }

      if (
        canPersistPublishedColumnOrder &&
        entityName &&
        !isSameColumnOrder(normalized, publishedDefaultColumnOrder)
      ) {
        void (async () => {
          const res = await fetch(`/api/metadata/layout/${entityName}/grid`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({
              layoutDefinition: {
                columnOrder: normalized,
              },
            }),
          });
          if (!res.ok) {
            throw new Error(`Layout persist failed with status ${res.status}`);
          }
        })().catch((error) => {
          console.error("Failed to persist published column order", error);
          toast.error("Failed to save published column order");
        });
      }
    },
    [
      canPersistPublishedColumnOrder,
      columnOrder,
      columnOrderStorageKey,
      entityName,
      publishedDefaultColumnOrder,
      resolvedColumns,
      selectedColIndex,
    ],
  );

  function handleColumnOrderChange(
    updater: ColumnOrderState | ((prev: ColumnOrderState) => ColumnOrderState),
  ) {
    const nextOrder = typeof updater === "function" ? updater(columnOrder) : updater;
    persistColumnOrder(nextOrder);
  }

  const handleResetGrid = () => {
    handleSearchChange("");
    onFiltersChange?.([]);
    if (onSortChange) onSortChange(null);
    else setInternalSorting([]);
    setColumnVisibility({});
    try {
      if (columnOrderStorageKey) {
        localStorage.removeItem(columnOrderStorageKey);
      }
    } catch {
      // Ignore storage failures in restrictive browser modes.
    }
    setStoredColumnOrder(null);
    const selectedKey = columnOrder[selectedColIndex];
    setColumnOrder(publishedDefaultColumnOrder);
    if (selectedKey) {
      const nextIndex = publishedDefaultColumnOrder.indexOf(selectedKey);
      if (nextIndex >= 0) {
        setSelectedColIndex(nextIndex);
      }
    }
    toast.success("Grid view reset successfully.");
  };

  const handleColumnDragStart = useCallback((columnKey: string) => {
    setDraggedColumnKey(columnKey);
    setDropTarget(null);
  }, []);

  const handleColumnDrop = useCallback(
    (targetKey: string, position: "before" | "after") => {
      if (!draggedColumnKey || draggedColumnKey === targetKey) {
        setDraggedColumnKey(null);
        setDropTarget(null);
        return;
      }

      const nextOrder = reorderColumnKeys(
        normalizeColumnOrder(columnOrder, resolvedColumns),
        draggedColumnKey,
        targetKey,
        position,
      );
      persistColumnOrder(nextOrder);
      setDraggedColumnKey(null);
      setDropTarget(null);
    },
    [columnOrder, draggedColumnKey, persistColumnOrder, resolvedColumns],
  );

  const handleCopyToClipboard = async () => {
    if (!data || data.length === 0) {
      toast.warning("No records to copy");
      return;
    }

    const exportColumns = effectiveColumns;
    const headers = exportColumns.map((col) => col.header).join("\t");

    const rows = data.map((dataRow) => {
      return exportColumns
        .map((colDef) => {
          const col = colDef as ColumnDef<T>;
          let value = "";

          if (col.getSearchValue) {
            value = col.getSearchValue(dataRow);
          } else if (col.renderValue) {
            value = col.renderValue(dataRow);
          } else {
            const rawVal = (dataRow as Record<string, any>)[col.key];
            value = rawVal !== undefined && rawVal !== null ? String(rawVal) : "";
          }

          return value.replace(/[\t\n\r]/g, " ");
        })
        .join("\t");
    });

    const tsvContent = [headers, ...rows].join("\n");
    try {
      await navigator.clipboard.writeText(tsvContent);
      toast.success(`Copied ${data.length} records to clipboard.`);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
      toast.error("Failed to copy to clipboard");
    }
  };

  const handleExportCSV = async () => {
    if (exporting) return;
    setExporting(true);

    try {
      const params = new URLSearchParams();

      const effectiveSort = onSortChange
        ? sort
          ? { key: sort.key, dir: sort.dir }
          : null
        : internalSorting.length > 0
          ? { key: internalSorting[0].id, dir: internalSorting[0].desc ? "desc" : "asc" }
          : null;
      if (effectiveSort) {
        params.set("orderBy", `${effectiveSort.key}:${effectiveSort.dir}`);
      }

      if (localSearch) {
        params.set("search", localSearch);
      }

      if (filtersProp && filtersProp.length > 0) {
        params.set("filters", JSON.stringify(filtersProp));
      }

      const res = await fetch(`/api/data/${entityName}?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch export data");

      const fullData = await res.json();
      const exportData = Array.isArray(fullData) ? fullData : fullData.data || [];

      if (!exportData || exportData.length === 0) {
        toast.warning("No records to export");
        return;
      }

      const exportColumns = effectiveColumns;
      const headers = exportColumns.map((col) => col.header);

      const csvRows = exportData.map((dataRow: any) => {
        return exportColumns.map((colDef) => {
          const col = colDef as ColumnDef<T>;
          let value = "";

          if (col.getSearchValue) {
            value = col.getSearchValue(dataRow);
          } else if (col.renderValue) {
            value = col.renderValue(dataRow);
          } else {
            const rawVal = (dataRow as Record<string, any>)[col.key];
            if (rawVal !== undefined && rawVal !== null) {
              if (
                (col.key === "primaryImageId" || col.key.toLowerCase().includes("image")) &&
                typeof rawVal === "string"
              ) {
                const host = typeof window !== "undefined" ? window.location.origin : "";
                value = `${host}/api/storage/article-images/${rawVal}`;
              } else {
                value = String(rawVal);
              }
            }
          }

          const escaped = value.replace(/"/g, '""');
          return `"${escaped}"`;
        });
      });

      const csvContent = [
        headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(","),
        ...csvRows.map((r: string[]) => r.join(",")),
      ].join("\n");

      const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      const dateStr = new Date().toISOString().split("T")[0];
      const filename = `${entityName.toLowerCase()}_export_${dateStr}.csv`;

      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Exported ${exportData.length} records successfully.`);
    } catch (err) {
      console.error("Export failed:", err);
      toast.error("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const skeletonWidthForCol = (col: ColumnDef<T>, idx: number) => {
    if (col.isNumeric) return "w-16";
    if (idx % 3 === 0) return "w-24";
    if (idx % 3 === 1) return "w-32";
    return "w-20";
  };

  const placeholderCols = useMemo(
    () => Array.from({ length: 4 }, (_, i) => ({ key: String(i), header: "" }) as ColumnDef<T>),
    [],
  );
  const skeletonCols = resolvedColumns.length > 0 ? resolvedColumns : placeholderCols;

  const allPageKeys = data.map((r) => keyExtractor(r));
  const allPageSelected = allPageKeys.length > 0 && allPageKeys.every((k) => selectedKeys.has(k));
  const toggleRowSelection = (id: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const activateRow = (dataRow: T, rowIndex: number, id: string) => {
    scrollRef.current?.focus();
    setSelectedIndex(rowIndex);
    setFocus({ entity: entityName, recordId: id, panel: panelId, area: "grid", row: rowIndex });
    onRowClick?.(dataRow);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        allPageKeys.forEach((k) => next.add(k));
        return next;
      });
    } else {
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        allPageKeys.forEach((k) => next.delete(k));
        return next;
      });
    }
  };

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col overflow-hidden",
        !flush && "rounded-lg border border-hairline",
        className,
      )}
    >
      {/* Toolbar */}
      {toolbar && (
        <div className="flex h-9 shrink-0 items-center gap-2 border-b border-hairline bg-canvas-soft px-3">
          {title && (
            <>
              <span className="text-[13px] font-medium text-ink">{title}</span>
              {!loading && (
                <span className="ml-1 text-[12px] text-ink-mute">
                  {(hasPagination ? totalCount : data.length)?.toLocaleString()} records
                </span>
              )}
            </>
          )}

          {/* Search input */}
          {onSearchChange && (
            <div className="flex flex-1 justify-center">
              <div className="relative flex items-center">
                <SearchIcon
                  size={13}
                  className="pointer-events-none absolute left-2 text-ink-mute/60"
                />
                <input
                  type="text"
                  value={localSearch}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search…"
                  className="h-7 w-full max-w-[240px] rounded-[4px] border border-hairline bg-canvas pr-7 pl-7 text-[12px] outline-none placeholder:text-ink-mute/60 focus:border-primary/40"
                />
                {localSearch && (
                  <button
                    type="button"
                    onClick={() => handleSearchChange("")}
                    className="absolute top-1/2 right-1.5 flex size-4 -translate-y-1/2 items-center justify-center text-ink-mute hover:text-ink"
                  >
                    <XIcon size={11} />
                  </button>
                )}
              </div>
            </div>
          )}

          <div className={cn("flex items-center gap-1", !onSearchChange && "ml-auto")}>
            {/* Filter button */}
            {onFiltersChange && (
              <div className="relative">
                <button
                  type="button"
                  title="Filter"
                  onClick={() => setShowFilters((p) => !p)}
                  className={cn(
                    "grid size-7 place-items-center rounded-sm text-ink-mute transition-colors hover:bg-canvas hover:text-ink",
                    (showFilters || activeFilters.length > 0) && "bg-canvas text-ink",
                  )}
                >
                  <FilterIcon size={14} />
                </button>
                {activeFilters.length > 0 && (
                  <span className="pointer-events-none absolute -top-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-primary text-[8px] leading-none font-bold text-primary-fg">
                    {activeFilters.length}
                  </span>
                )}
              </div>
            )}
            <button
              title="Refresh"
              onClick={() => onSearchChange?.(localSearch)}
              className="grid size-7 place-items-center rounded-sm text-ink-mute transition-colors hover:bg-canvas hover:text-ink"
            >
              <RefreshCwIcon size={14} />
            </button>
            <button
              title={exporting ? "Exporting..." : "Export CSV"}
              onClick={handleExportCSV}
              disabled={exporting}
              className={cn(
                "grid size-7 place-items-center rounded-sm text-ink-mute transition-colors hover:bg-canvas hover:text-ink",
                exporting && "cursor-not-allowed opacity-50",
              )}
            >
              {exporting ? (
                <RefreshCwIcon size={14} className="animate-spin text-primary" />
              ) : (
                <DownloadIcon size={14} />
              )}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    title="More"
                    className="grid size-7 place-items-center rounded-sm text-ink-mute transition-colors hover:bg-canvas hover:text-ink focus:outline-none"
                  >
                    <MoreHorizontalIcon size={14} />
                  </button>
                }
              />
              <DropdownMenuContent
                align="end"
                className="z-50 w-56 rounded-[4px] border border-hairline bg-canvas p-1 text-[13px] shadow-md"
              >
                {/* 1. Grid- & Ansichtsverwaltung */}
                <div className="px-2 py-1 text-[11px] font-bold tracking-wider text-ink-mute uppercase select-none">
                  View Management
                </div>
                <DropdownMenuItem
                  onClick={handleResetGrid}
                  className="flex cursor-pointer items-center gap-2 rounded-[3px] px-2 py-1.5 text-ink transition-colors hover:bg-canvas-soft"
                >
                  <span>Reset Grid View</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1 border-t border-hairline" />

                {/* 2. Daten-Werkzeuge */}
                <div className="px-2 py-1 text-[11px] font-bold tracking-wider text-ink-mute uppercase select-none">
                  Data Tools
                </div>
                <DropdownMenuItem
                  onClick={handleCopyToClipboard}
                  className="flex cursor-pointer items-center gap-2 rounded-[3px] px-2 py-1.5 text-ink transition-colors hover:bg-canvas-soft"
                >
                  <span>Copy to Clipboard (TSV)</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1 border-t border-hairline" />

                {/* 3. Globale Massenaktionen */}
                <div className="px-2 py-1 text-[11px] font-bold tracking-wider text-ink-mute uppercase select-none">
                  Bulk Operations
                </div>
                <DropdownMenuItem
                  onClick={() =>
                    toast.info(`Bulk archiving is not configured for ${entityName.toLowerCase()}s.`)
                  }
                  className="flex cursor-not-allowed items-center gap-2 rounded-[3px] px-2 py-1.5 text-ink-mute opacity-60 hover:bg-canvas-soft"
                >
                  <span>Archive All Filtered (Placeholder)</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Column visibility picker */}
            <div ref={colPickerRef} className="relative">
              <button
                title={t("grid.columns")}
                onClick={() => setShowColPicker((p) => !p)}
                className={cn(
                  "grid size-7 place-items-center rounded-sm text-ink-mute transition-colors hover:bg-canvas hover:text-ink",
                  showColPicker && "bg-canvas text-ink",
                )}
              >
                <ColumnsIcon size={14} />
              </button>
              {isDesignMode && (
                <button
                  type="button"
                  title="Add column"
                  onClick={() => addColumnDraft?.()}
                  className="ml-1 inline-flex h-7 items-center gap-1 rounded-sm border border-hairline px-2 text-[12px] text-ink-mute transition-colors hover:border-primary/35 hover:text-primary"
                >
                  <PlusIcon size={12} />
                  Column
                </button>
              )}
              {showColPicker && resolvedColumns.length > 0 && (
                <div className="absolute top-full right-0 z-50 min-w-[160px] rounded-[var(--radius-sm)] border border-hairline bg-canvas p-1 shadow-sm">
                  {table.getAllColumns().map((col) => {
                    const colDef = resolvedColumns.find((c) => c.key === col.id);
                    if (!colDef) return null;
                    return (
                      <label
                        key={col.id}
                        className="flex h-7 cursor-pointer items-center gap-2 rounded-sm px-2 hover:bg-canvas-soft"
                      >
                        <input
                          type="checkbox"
                          checked={col.getIsVisible()}
                          onChange={col.getToggleVisibilityHandler()}
                          className="h-3.5 w-3.5"
                        />
                        <span className="text-[12px] text-ink">{colDef.header}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filter panel */}
      {onFiltersChange && showFilters && (
        <div className="flex shrink-0 flex-col gap-1.5 border-b border-hairline bg-canvas px-3 py-2">
          {activeFilters.map((rule) => {
            const col = resolvedColumns.find(
              (c) =>
                c.key === rule.col ||
                (c.relation &&
                  (c.relation.fkField === rule.col ||
                    `${c.relation.entity}.${c.relation.labelField}` === rule.col)),
            ) as ColumnDef<T> | undefined;
            const colType = getColType(col);
            const ops = OPS_BY_TYPE[colType] ?? OPS_BY_TYPE.text;
            const noValue = rule.op === "is_empty" || rule.op === "is_not_empty";
            return (
              <div key={rule.id} className="flex items-center gap-2">
                {/* Column select */}
                <select
                  value={rule.col}
                  onChange={(e) => {
                    const newCol = resolvedColumns.find((c) => c.key === e.target.value);
                    const newType = getColType(newCol);
                    const newOps = OPS_BY_TYPE[newType] ?? OPS_BY_TYPE.text;
                    updateFilter(rule.id, { col: e.target.value, op: newOps[0].value, val: "" });
                  }}
                  className="h-7 min-w-[140px] rounded-[3px] border border-hairline bg-canvas-soft px-2 text-[12px]"
                >
                  {resolvedColumns.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.header}
                    </option>
                  ))}
                </select>
                {/* Operator select */}
                <select
                  value={rule.op}
                  onChange={(e) =>
                    updateFilter(rule.id, { op: e.target.value as FilterOp, val: "" })
                  }
                  className="h-7 min-w-[120px] rounded-[3px] border border-hairline bg-canvas-soft px-2 text-[12px]"
                >
                  {ops.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {/* Value input */}
                {!noValue && colType === "boolean" ? (
                  <select
                    value={rule.val}
                    onChange={(e) => updateFilter(rule.id, { val: e.target.value })}
                    className="h-7 min-w-0 flex-1 rounded-[3px] border border-hairline bg-canvas px-2 text-[12px]"
                  >
                    <option value="true">True</option>
                    <option value="false">False</option>
                  </select>
                ) : !noValue ? (
                  <input
                    type={colType === "number" ? "number" : colType === "date" ? "date" : "text"}
                    value={rule.val}
                    onChange={(e) => updateFilter(rule.id, { val: e.target.value })}
                    className="h-7 min-w-0 flex-1 rounded-[3px] border border-hairline bg-canvas px-2 text-[12px]"
                  />
                ) : (
                  <div className="flex-1" />
                )}
                {/* Delete button */}
                <button
                  type="button"
                  onClick={() => removeFilter(rule.id)}
                  className="flex size-6 items-center justify-center rounded-sm text-ink-mute hover:bg-canvas-soft hover:text-ink"
                >
                  <XIcon size={12} />
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onClick={addFilter}
            className="flex h-7 w-fit items-center gap-1.5 rounded-sm px-2 text-[12px] text-primary transition-colors hover:bg-canvas-soft"
          >
            <PlusIcon size={12} />
            Add filter
          </button>
        </div>
      )}

      {/* Bulk action bar */}
      {selectable && selectedKeys.size > 0 && (
        <div
          className="flex h-9 shrink-0 items-center gap-3 border-b border-hairline px-3"
          style={{ background: "color-mix(in oklab, var(--primary) 8%, transparent)" }}
        >
          <span className="text-[13px] font-medium text-primary">{selectedKeys.size} selected</span>
          {bulkActions?.map((action, i) => (
            <button
              key={i}
              type="button"
              onClick={async () => {
                await action.onClick(Array.from(selectedKeys));
                setSelectedKeys(new Set());
              }}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-[4px] border border-hairline bg-canvas px-3 text-[12px] hover:bg-canvas-soft",
                action.variant === "destructive" &&
                  "border-destructive/40 text-destructive hover:bg-destructive/5",
              )}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSelectedKeys(new Set())}
            className="ml-auto flex h-7 items-center gap-1 px-2 text-[12px] text-ink-mute hover:text-ink"
          >
            <XIcon size={12} />
            Clear
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading ? (
        <div className="flex-1 overflow-auto">
          <div className="sticky top-0 flex h-9 border-b border-hairline bg-canvas-soft">
            {selectable && <div className="w-10 shrink-0" />}
            {skeletonCols.map((col, idx) => (
              <div
                key={col.key ?? idx}
                className="flex items-center px-4"
                style={colFlexStyle(col.width)}
              >
                <Skeleton className="h-2.5 w-20" />
              </div>
            ))}
          </div>
          {Array.from({ length: 8 }).map((_, r) => (
            <div key={r} className="flex h-10 border-b border-hairline">
              {selectable && <div className="w-10 shrink-0" />}
              {skeletonCols.map((col, idx) => (
                <div
                  key={col.key ?? idx}
                  className="flex items-center px-4"
                  style={colFlexStyle(col.width)}
                >
                  <Skeleton className={cn("h-2.5", skeletonWidthForCol(col, idx))} />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : data.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center gap-3 px-4 py-16">
          <div className="grid size-12 place-items-center rounded-full border-2 border-hairline text-ink-mute">
            <InboxIcon className="size-5" strokeWidth={1.2} />
          </div>
          <div className="text-[14px] text-ink-secondary">{emptyTitle ?? t("empty.title")}</div>
          <div className="text-center text-[12px] text-ink-mute">
            {emptySubtitle ?? t("empty.subtitle")}
          </div>
          {emptyAction && (
            <button
              onClick={emptyAction.onClick}
              className="mt-1 flex h-7 items-center gap-1.5 rounded-full px-3 text-[13px]"
              style={{ background: "var(--primary)", color: "var(--primary-fg)" }}
            >
              <PlusIcon className="size-3" />
              {emptyAction.label}
              {emptyAction.kbd && (
                <span
                  className="ml-1 rounded-[3px] border px-1 font-mono text-[10px]"
                  style={{
                    borderColor: "color-mix(in oklab, var(--primary-fg) 30%, transparent)",
                    background: "color-mix(in oklab, var(--primary-fg) 12%, transparent)",
                  }}
                >
                  {emptyAction.kbd}
                </span>
              )}
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Scroll container — scoped keyboard nav */}
          <div
            ref={scrollRef}
            role="grid"
            className="flex-1 overflow-auto outline-none"
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (focusState.panel !== panelId && data.length > 0) {
                const clampedIndex = Math.max(0, Math.min(selectedIndex, rows.length - 1));
                const row = data[clampedIndex] ?? data[0];
                const id = keyExtractor(row);
                setFocus({
                  entity: entityName,
                  recordId: id,
                  panel: panelId,
                  area: "grid",
                  row: clampedIndex,
                });
              }
            }}
          >
            {/* Sticky header row */}
            <div className="sticky top-0 z-10 flex border-b border-hairline bg-canvas-soft">
              {selectable && (
                <div className="flex h-9 w-10 shrink-0 items-center justify-center">
                  <input
                    ref={headerCheckRef}
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="h-3.5 w-3.5"
                  />
                </div>
              )}
              {table.getHeaderGroups()[0]?.headers.map((header) => {
                const col = effectiveColumns.find((c) => c.key === header.id);
                const isSortable = (col?.sortable ?? false) && !isDesignMode;
                const sortEntry = effectiveSorting.find((s) => s.id === header.id);
                const designCol = isDesignMode
                  ? (designerColumnByKey.get(header.id) ?? null)
                  : null;
                const headerLabel = col?.header ?? header.id;
                const isDesignerSelected = activeDesignerHeaderKey === header.id;
                const isDragged = draggedColumnKey === header.id;
                const isDropBefore =
                  dropTarget?.key === header.id && dropTarget.position === "before";
                const isDropAfter =
                  dropTarget?.key === header.id && dropTarget.position === "after";

                if (isDesignMode) {
                  return (
                    <button
                      key={header.id}
                      type="button"
                      aria-pressed={isDesignerSelected}
                      aria-label={`Select column ${headerLabel}`}
                      onClick={() => selectDesignerHeader(header.id)}
                      className={cn(
                        "flex h-9 shrink-0 items-center gap-1 px-4 text-[12px] font-medium text-ink-mute transition-all outline-none select-none",
                        (col?.isNumeric || col?.align === "right") && "justify-end",
                        col?.align === "center" && "justify-center",
                        isDesignerSelected
                          ? "bg-[color-mix(in_oklab,var(--primary)_8%,transparent)] text-ink shadow-sm ring-1 ring-primary/60 ring-inset"
                          : "ring-1 ring-primary/20 ring-inset hover:bg-[color-mix(in_oklab,var(--primary)_4%,transparent)] hover:ring-primary/50",
                      )}
                      style={colFlexStyle(col?.width)}
                    >
                      <GripVerticalIcon className="size-3 flex-none text-primary/40" />
                      <span className="truncate text-ink">{headerLabel}</span>
                      <span
                        className={cn(
                          "ml-auto inline-flex max-w-[56%] shrink-0 items-center rounded-[3px] border px-1.5 py-0.5 font-mono text-[9px] leading-none tracking-[0.04em]",
                          isDesignerSelected
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-hairline bg-canvas text-ink-mute",
                        )}
                        title={designCol?.identity ?? `grid-column:${header.id}`}
                      >
                        {designCol?.identity ?? `grid-column:${header.id}`}
                      </span>
                      {designCol?.pin && <PinIcon className="size-2.5 flex-none text-primary" />}
                    </button>
                  );
                }

                return (
                  <div
                    key={header.id}
                    onDragOver={(e) => {
                      if (isDesignMode || !draggedColumnKey || draggedColumnKey === header.id)
                        return;
                      e.preventDefault();
                      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                      const position = e.clientX < rect.left + rect.width / 2 ? "before" : "after";
                      setDropTarget({ key: header.id, position });
                    }}
                    onDrop={(e) => {
                      if (isDesignMode) return;
                      e.preventDefault();
                      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                      const position = e.clientX < rect.left + rect.width / 2 ? "before" : "after";
                      handleColumnDrop(header.id, position);
                    }}
                    onDragLeave={(e) => {
                      if (
                        e.relatedTarget instanceof Node &&
                        e.currentTarget.contains(e.relatedTarget)
                      ) {
                        return;
                      }
                      setDropTarget((current) => (current?.key === header.id ? null : current));
                    }}
                    className={cn(
                      "group flex h-9 shrink-0 items-center gap-1 px-4 text-[12px] font-medium text-ink-mute select-none",
                      (col?.isNumeric || col?.align === "right") && "justify-end",
                      col?.align === "center" && "justify-center",
                      isSortable && "cursor-pointer transition-colors hover:text-ink",
                      isDragged && "opacity-40",
                      isDropBefore && "border-l-2 border-primary/60",
                      isDropAfter && "border-r-2 border-primary/60",
                      (isDropBefore || isDropAfter) &&
                        "bg-[color-mix(in_oklab,var(--primary)_5%,transparent)]",
                    )}
                    style={colFlexStyle(col?.width)}
                  >
                    <button
                      type="button"
                      aria-label={`Reorder column ${headerLabel}`}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      draggable
                      onDragStart={(e) => {
                        if (isDesignMode) return;
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", header.id);
                        handleColumnDragStart(header.id);
                      }}
                      onDragEnd={() => {
                        setDraggedColumnKey(null);
                        setDropTarget(null);
                      }}
                      className={cn(
                        "flex size-4 shrink-0 cursor-grab items-center justify-center rounded-sm text-ink-mute opacity-0 transition-opacity group-hover:opacity-100",
                        draggedColumnKey === header.id && "text-primary opacity-100",
                        isDesignMode && "pointer-events-none",
                      )}
                    >
                      <GripVerticalIcon size={11} />
                    </button>
                    {isSortable ? (
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-1 text-inherit",
                          (col?.isNumeric || col?.align === "right") && "justify-end",
                          col?.align === "center" && "justify-center",
                        )}
                        onClick={() => header.column.toggleSorting()}
                      >
                        <span className="truncate">{headerLabel}</span>
                        <ChevronUpIcon
                          size={11}
                          className={cn(
                            "shrink-0 transition-[opacity,transform] duration-100",
                            sortEntry === undefined
                              ? "opacity-20"
                              : sortEntry.desc
                                ? "rotate-180 opacity-100"
                                : "rotate-0 opacity-100",
                          )}
                        />
                      </button>
                    ) : (
                      <span className="truncate">{headerLabel}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Body — virtual when virtualized=true, flat otherwise */}
            {virtualized ? (
              <div style={{ position: "relative", height: `${virtualizer.getTotalSize()}px` }}>
                {virtualizer.getVirtualItems().map((vItem) => {
                  const row = rows[vItem.index];
                  if (!row) return null;
                  const dataRow = row.original;
                  const id = keyExtractor(dataRow);
                  const isSelected = selectedIndex === vItem.index && focusState.panel === panelId;
                  const isChecked = selectable && selectedKeys.has(id);
                  return (
                    // eslint-disable-next-line
                    <div
                      key={row.id}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${vItem.start}px)`,
                        height: 40,
                        ...(isSelected
                          ? {
                              borderLeft: "2px solid var(--primary-soft)",
                              backgroundColor:
                                "color-mix(in oklab, var(--primary) 9%, transparent)",
                            }
                          : isChecked
                            ? {
                                backgroundColor:
                                  "color-mix(in oklab, var(--primary) 5%, transparent)",
                              }
                            : undefined),
                      }}
                      className={cn(
                        "relative flex cursor-pointer border-b border-hairline transition-colors",
                        !isSelected && !isChecked && "hover:bg-canvas-soft",
                      )}
                      onClick={() => activateRow(dataRow, vItem.index, id)}
                      onDoubleClick={() => onRowOpen?.(dataRow)}
                    >
                      {selectable && (
                        <button
                          type="button"
                          className="flex w-10 shrink-0 items-center justify-center"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRowSelection(id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleRowSelection(id);
                            }
                          }}
                          aria-pressed={isChecked}
                          aria-label={`Select row ${id}`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="pointer-events-none h-3.5 w-3.5"
                          />
                        </button>
                      )}
                      {row.getVisibleCells().map((cell, cellIdx) => {
                        const col = effectiveColumns.find((c) => c.key === cell.column.id) as
                          | ColumnDef<T>
                          | undefined;
                        if (!col) return null;
                        const value = (dataRow as Record<string, any>)[col.key];
                        const rendered = col.render
                          ? col.render(dataRow)
                          : typeof value === "object" &&
                              value !== null &&
                              ("en" in value || "de" in value)
                            ? value[i18n.language] || value.en || value.de
                            : value;
                        const isCellFocused = isSelected && selectedColIndex === cellIdx;
                        return (
                          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                          <div
                            key={cell.id}
                            role="gridcell"
                            onClick={(e) => {
                              e.stopPropagation();
                              activateRow(dataRow, vItem.index, id);
                              setSelectedColIndex(cellIdx);
                            }}
                            className={cn(
                              "flex shrink-0 items-center border border-transparent text-[13px] font-light text-ink transition-all",
                              isCellFocused && transientSearchActive ? "px-1" : "px-4",
                              col.isNumeric && "justify-end font-mono tabular-nums",
                              col.align === "center" && "justify-center",
                              col.align === "right" && "justify-end",
                              isCellFocused &&
                                "rounded-[2px] border-primary/60 bg-primary/[0.04] ring-1 ring-primary/40 ring-inset",
                            )}
                            style={{
                              ...colFlexStyle(col.width),
                              overflow: "hidden",
                            }}
                          >
                            {isCellFocused && transientSearchActive ? (
                              <div className="relative flex h-[85%] w-full animate-in items-center gap-1.5 overflow-hidden rounded border border-primary/40 bg-primary/10 px-2 text-xs font-medium text-primary duration-100 select-none zoom-in-95 fade-in">
                                <SearchIcon size={12} className="shrink-0 text-primary/80" />
                                <span className="shrink-0 text-[10px] font-bold tracking-wider text-primary/60 uppercase">
                                  {col.header}:
                                </span>
                                <span className="flex-1 truncate bg-transparent text-left font-mono font-semibold text-primary outline-none">
                                  {transientQuery}
                                </span>
                                <span className="-ml-0.5 shrink-0 animate-pulse font-bold text-primary select-none">
                                  |
                                </span>
                              </div>
                            ) : (
                              <span className="truncate">{rendered as React.ReactNode}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ) : (
              <>
                {rows.map((row, index) => {
                  const dataRow = row.original;
                  const id = keyExtractor(dataRow);
                  const isSelected = selectedIndex === index && focusState.panel === panelId;
                  const isChecked = selectable && selectedKeys.has(id);
                  return (
                    // eslint-disable-next-line
                    <div
                      key={row.id}
                      data-row-idx={index}
                      style={{
                        height: 40,
                        ...(isSelected
                          ? {
                              borderLeft: "2px solid var(--primary-soft)",
                              backgroundColor:
                                "color-mix(in oklab, var(--primary) 9%, transparent)",
                            }
                          : isChecked
                            ? {
                                backgroundColor:
                                  "color-mix(in oklab, var(--primary) 5%, transparent)",
                              }
                            : undefined),
                      }}
                      className={cn(
                        "relative flex cursor-pointer border-b border-hairline transition-colors",
                        !isSelected && !isChecked && "hover:bg-canvas-soft",
                      )}
                      onClick={() => activateRow(dataRow, index, id)}
                      onDoubleClick={() => onRowOpen?.(dataRow)}
                    >
                      {selectable && (
                        <button
                          type="button"
                          className="flex w-10 shrink-0 items-center justify-center"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRowSelection(id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleRowSelection(id);
                            }
                          }}
                          aria-pressed={isChecked}
                          aria-label={`Select row ${id}`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="pointer-events-none h-3.5 w-3.5"
                          />
                        </button>
                      )}
                      {row.getVisibleCells().map((cell, cellIdx) => {
                        const col = effectiveColumns.find((c) => c.key === cell.column.id) as
                          | ColumnDef<T>
                          | undefined;
                        if (!col) return null;
                        const value = (dataRow as Record<string, any>)[col.key];
                        const rendered = col.render
                          ? col.render(dataRow)
                          : typeof value === "object" &&
                              value !== null &&
                              ("en" in value || "de" in value)
                            ? value[i18n.language] || value.en || value.de
                            : value;
                        const isCellFocused = isSelected && selectedColIndex === cellIdx;
                        return (
                          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                          <div
                            key={cell.id}
                            role="gridcell"
                            onClick={(e) => {
                              e.stopPropagation();
                              activateRow(dataRow, index, id);
                              setSelectedColIndex(cellIdx);
                            }}
                            className={cn(
                              "flex shrink-0 items-center border border-transparent text-[13px] font-light text-ink transition-all",
                              isCellFocused && transientSearchActive ? "px-1" : "px-4",
                              col.isNumeric && "justify-end font-mono tabular-nums",
                              col.align === "center" && "justify-center",
                              col.align === "right" && "justify-end",
                              isCellFocused &&
                                "rounded-[2px] border-primary/60 bg-primary/[0.04] ring-1 ring-primary/40 ring-inset",
                            )}
                            style={{
                              ...colFlexStyle(col.width),
                              overflow: "hidden",
                            }}
                          >
                            {isCellFocused && transientSearchActive ? (
                              <div className="relative flex h-[85%] w-full animate-in items-center gap-1.5 overflow-hidden rounded border border-primary/40 bg-primary/10 px-2 text-xs font-medium text-primary duration-100 select-none zoom-in-95 fade-in">
                                <SearchIcon size={12} className="shrink-0 text-primary/80" />
                                <span className="shrink-0 text-[10px] font-bold tracking-wider text-primary/60 uppercase">
                                  {col.header}:
                                </span>
                                <span className="flex-1 truncate bg-transparent text-left font-mono font-semibold text-primary outline-none">
                                  {transientQuery}
                                </span>
                                <span className="-ml-0.5 shrink-0 animate-pulse font-bold text-primary select-none">
                                  |
                                </span>
                              </div>
                            ) : (
                              <span className="truncate">{rendered as React.ReactNode}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* Pagination bar — only when totalCount is provided */}
          {hasPagination && (
            <div className="flex h-8 shrink-0 items-center gap-2 border-t border-hairline bg-canvas-soft px-3 text-[12px] text-ink-mute">
              <span className="shrink-0">
                {((page - 1) * pageSize + 1).toLocaleString()}–
                {Math.min(page * pageSize, totalCount).toLocaleString()} {t("grid.of")}{" "}
                {totalCount.toLocaleString()} records
              </span>

              <div className="mx-auto flex items-center gap-0.5">
                <button
                  onClick={() => onPageChange?.(1)}
                  disabled={page <= 1}
                  className={cn(
                    "h-6 min-w-[24px] rounded-[3px] border border-hairline bg-canvas px-1 text-[11px] hover:bg-canvas-soft",
                    page <= 1 && "pointer-events-none opacity-40",
                  )}
                >
                  «
                </button>
                <button
                  onClick={() => onPageChange?.(page - 1)}
                  disabled={page <= 1}
                  className={cn(
                    "h-6 min-w-[24px] rounded-[3px] border border-hairline bg-canvas px-1 text-[11px] hover:bg-canvas-soft",
                    page <= 1 && "pointer-events-none opacity-40",
                  )}
                >
                  ‹
                </button>
                {(() => {
                  const start = Math.max(1, page - 2);
                  const end = Math.min(totalPages, start + 4);
                  const nums: number[] = [];
                  for (let p = start; p <= end; p++) nums.push(p);
                  return nums.map((p) => (
                    <button
                      key={p}
                      onClick={() => onPageChange?.(p)}
                      className="h-6 min-w-[24px] rounded-[3px] border px-1 text-[11px] hover:bg-canvas-soft"
                      style={
                        p === page
                          ? {
                              background: "var(--primary)",
                              color: "var(--primary-fg)",
                              borderColor: "var(--primary)",
                            }
                          : { background: "var(--canvas)", borderColor: "var(--hairline)" }
                      }
                    >
                      {p}
                    </button>
                  ));
                })()}
                <button
                  onClick={() => onPageChange?.(page + 1)}
                  disabled={page >= totalPages}
                  className={cn(
                    "h-6 min-w-[24px] rounded-[3px] border border-hairline bg-canvas px-1 text-[11px] hover:bg-canvas-soft",
                    page >= totalPages && "pointer-events-none opacity-40",
                  )}
                >
                  ›
                </button>
                <button
                  onClick={() => onPageChange?.(totalPages)}
                  disabled={page >= totalPages}
                  className={cn(
                    "h-6 min-w-[24px] rounded-[3px] border border-hairline bg-canvas px-1 text-[11px] hover:bg-canvas-soft",
                    page >= totalPages && "pointer-events-none opacity-40",
                  )}
                >
                  »
                </button>
              </div>

              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
                className="ml-auto h-6 rounded-[3px] border border-hairline bg-canvas px-1 text-[12px]"
              >
                {[25, 50, 100].map((s) => (
                  <option key={s} value={s}>
                    {s} {t("grid.perPage")}
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export const DataGrid = forwardRef(DataGridInner) as <T>(
  props: DataGridProps<T> & React.RefAttributes<DataGridHandle>,
) => React.ReactElement;
