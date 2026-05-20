import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef as TsColumnDef,
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
  PencilRulerIcon,
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

import { cn } from "../lib/utils";
import { useDesigner } from "../platform/designer-context";
import { useFocus } from "../platform/focus-manager";
import type { FilterOp, FilterRule } from "../types/grid";
import { Skeleton } from "./skeleton";

export type { FilterOp, FilterRule };

export interface ColumnDef<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  align?: "left" | "center" | "right";
  isNumeric?: boolean;
  width?: string;
  sortable?: boolean;
  type?: "text" | "number" | "date" | "boolean";
  pin?: "left" | "right";
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
  const { isDesignMode, delta, initColumns, updateColumn, moveColumn } = useDesigner();
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const colPickerRef = useRef<HTMLDivElement>(null);
  const headerCheckRef = useRef<HTMLInputElement>(null);
  // Tracks what we last set as focus so the effect doesn't loop on stale focusState
  const lastFocusRef = useRef<{ id: string; entity: string; panel: string; row: number } | null>(
    null,
  );
  const lastColsRef = useRef<string>("");

  const [resolvedColumns, setResolvedColumns] = useState<ColumnDef<T>[]>(initialColumns ?? []);
  const [internalLoading, setInternalLoading] = useState(!initialColumns && !!entityName);
  const [showColPicker, setShowColPicker] = useState(false);
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const [showFilters, setShowFilters] = useState(false);
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

  // Column visibility persisted per entityName
  const storageKey = `datagrid-cols-${entityName}`;
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(columnVisibility));
    } catch {}
  }, [columnVisibility, storageKey]);

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
  }, [entityName, initialColumns, i18n.language]);

  useEffect(() => {
    if (initialColumns) {
      const sig = JSON.stringify(initialColumns);
      if (sig !== lastColsRef.current) {
        lastColsRef.current = sig;
        setResolvedColumns(initialColumns);
      }
    }
  }, [initialColumns]);

  // In design mode, honour the delta column order and visibility
  const effectiveColumns = useMemo(() => {
    if (!isDesignMode || delta.columns.length === 0) return resolvedColumns;
    const orderedKeys = delta.columns
      .slice()
      .sort((a, b) => a.order - b.order)
      .filter((c) => c.visible)
      .map((c) => c.key);
    return orderedKeys
      .map((k) => resolvedColumns.find((c) => c.key === k))
      .filter(Boolean) as typeof resolvedColumns;
  }, [isDesignMode, delta.columns, resolvedColumns]);

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
    state: { sorting: effectiveSorting, columnVisibility },
    onSortingChange: handleSortingChange,
    onColumnVisibilityChange: setColumnVisibility,
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

      if (
        !last ||
        last.id !== id ||
        last.entity !== entityName ||
        last.panel !== panelId ||
        last.row !== clampedIndex
      ) {
        lastFocusRef.current = { id, entity: entityName, panel: panelId, row: clampedIndex };
        setFocus(nextFocus);
      }
    }
    // keyExtractor is intentionally omitted — inline prop, always functionally stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, selectedIndex, entityName, panelId, rows.length]);

  // Scoped keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) {
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
            {(
              [
                { Icon: RefreshCwIcon, label: "Refresh" },
                { Icon: DownloadIcon, label: "Export" },
                { Icon: MoreHorizontalIcon, label: "More" },
              ] as const
            ).map(({ Icon, label }) => (
              <button
                key={label}
                title={label}
                className="grid size-7 place-items-center rounded-sm text-ink-mute transition-colors hover:bg-canvas hover:text-ink"
              >
                <Icon size={14} />
              </button>
            ))}
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
            const col = resolvedColumns.find((c) => c.key === rule.col);
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
                  ? delta.columns.find((c) => c.key === header.id)
                  : null;

                return (
                  <div
                    key={header.id}
                    className={cn(
                      "flex h-9 shrink-0 items-center gap-1 px-4 text-[12px] font-medium text-ink-mute select-none",
                      (col?.isNumeric || col?.align === "right") && "justify-end",
                      col?.align === "center" && "justify-center",
                      isSortable && "cursor-pointer transition-colors hover:text-ink",
                      isDesignMode &&
                        "ring-1 ring-primary/20 transition-all ring-inset hover:ring-primary/50",
                    )}
                    style={colFlexStyle(col?.width)}
                  >
                    {/* Design-mode indicator */}
                    {isDesignMode && (
                      <span className="mr-0.5 flex-none text-primary/50">
                        <PencilRulerIcon className="size-2.5" />
                      </span>
                    )}
                    {designCol?.pin && <PinIcon className="size-2.5 flex-none text-primary" />}
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
                        <span className="truncate">{col?.header ?? header.id}</span>
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
                      <span className="truncate">{col?.header ?? header.id}</span>
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
                      <button
                        type="button"
                        aria-label={`Open row ${id}`}
                        className="absolute inset-y-0 z-10 bg-transparent"
                        style={{ left: selectable ? 40 : 0, right: 0 }}
                        onClick={() => activateRow(dataRow, vItem.index, id)}
                        onDoubleClick={() => onRowOpen?.(dataRow)}
                      />
                      {row.getVisibleCells().map((cell) => {
                        const col = resolvedColumns.find((c) => c.key === cell.column.id);
                        if (!col) return null;
                        const value = (dataRow as Record<string, any>)[col.key];
                        const rendered = col.render
                          ? col.render(dataRow)
                          : typeof value === "object" &&
                              value !== null &&
                              ("en" in value || "de" in value)
                            ? value[i18n.language] || value.en || value.de
                            : value;
                        return (
                          <div
                            key={cell.id}
                            className={cn(
                              "flex shrink-0 items-center px-4 text-[13px] font-light text-ink",
                              col.isNumeric && "justify-end font-mono tabular-nums",
                              col.align === "center" && "justify-center",
                              col.align === "right" && "justify-end",
                            )}
                            style={colFlexStyle(col.width)}
                          >
                            <span className="truncate">{rendered as React.ReactNode}</span>
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
                      <button
                        type="button"
                        aria-label={`Open row ${id}`}
                        className="absolute inset-y-0 z-10 bg-transparent"
                        style={{ left: selectable ? 40 : 0, right: 0 }}
                        onClick={() => activateRow(dataRow, index, id)}
                        onDoubleClick={() => onRowOpen?.(dataRow)}
                      />
                      {row.getVisibleCells().map((cell) => {
                        const col = resolvedColumns.find((c) => c.key === cell.column.id);
                        if (!col) return null;
                        const value = (dataRow as Record<string, any>)[col.key];
                        const rendered = col.render
                          ? col.render(dataRow)
                          : typeof value === "object" &&
                              value !== null &&
                              ("en" in value || "de" in value)
                            ? value[i18n.language] || value.en || value.de
                            : value;
                        return (
                          <div
                            key={cell.id}
                            className={cn(
                              "flex shrink-0 items-center px-4 text-[13px] font-light text-ink",
                              col.isNumeric && "justify-end font-mono tabular-nums",
                              col.align === "center" && "justify-center",
                              col.align === "right" && "justify-end",
                            )}
                            style={colFlexStyle(col.width)}
                          >
                            <span className="truncate">{rendered as React.ReactNode}</span>
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
