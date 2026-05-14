import React, { useState, useEffect, useRef } from "react";
import { useFocus } from "../platform/focus-manager";
import { Skeleton } from "./skeleton";
import { cn } from "../lib/utils";
import {
  InboxIcon,
  PlusIcon,
  FilterIcon,
  RefreshCwIcon,
  DownloadIcon,
  MoreHorizontalIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

export interface ColumnDef<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  align?: "left" | "center" | "right";
  isNumeric?: boolean;
  width?: string;
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
}

export function DataGrid<T>({
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
}: DataGridProps<T>) {
  const { t } = useTranslation("ui");
  const { state: focusState, setFocus } = useFocus();
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const [columns, setColumns] = useState<ColumnDef<T>[]>(initialColumns ?? []);
  const [internalLoading, setInternalLoading] = useState(!initialColumns && !!entityName);

  const loading = internalLoading || externalLoading;

  useEffect(() => {
    let isMounted = true;
    if (!initialColumns && entityName) {
      setInternalLoading(true);
      fetch(`/api/metadata/fields/${entityName}`)
        .then((res) => {
          if (!res.ok) throw new Error(`Metadata fetch failed: ${res.status}`);
          return res.json();
        })
        .then((meta) => {
          if (!isMounted) return;
          const mappedColumns: ColumnDef<T>[] = (meta as Array<Record<string, unknown>>)
            .filter((f) => f["listVisible"] !== false)
            .map((f) => ({
              key: f["fieldName"] as string,
              header: (f["labelEn"] as string) || (f["fieldName"] as string),
              align:
                f["fieldType"] === "numeric" || f["fieldType"] === "integer"
                  ? "right"
                  : "left",
              isNumeric:
                f["fieldType"] === "numeric" || f["fieldType"] === "integer",
            }));
          setColumns(mappedColumns);
          setInternalLoading(false);
        })
        .catch((err) => {
          console.error("Failed to load metadata columns", err instanceof Error ? err.message : err);
          if (isMounted) setInternalLoading(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [entityName, initialColumns]);

  useEffect(() => {
    if (data.length > 0) {
      const row = data[selectedIndex] ?? data[0];
      const id = keyExtractor(row);
      if (focusState.recordId !== id || focusState.entity !== entityName) {
        setFocus({
          entity: entityName,
          recordId: id,
          panel: panelId,
          area: "grid",
          row: selectedIndex,
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, selectedIndex, entityName, panelId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (focusState.area !== "grid" || focusState.panel !== panelId) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, data.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Home") {
        e.preventDefault();
        setSelectedIndex(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setSelectedIndex(data.length - 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusState.area, focusState.panel, panelId, data.length]);

  const skeletonWidthForCol = (col: ColumnDef<T>, idx: number) => {
    if (col.isNumeric) return "w-16";
    if (idx % 3 === 0) return "w-24";
    if (idx % 3 === 1) return "w-32";
    return "w-20";
  };

  return (
    <div
      ref={containerRef}
      className={cn("flex flex-col h-full w-full overflow-hidden", className)}
    >
      {toolbar && (
        <div className="h-9 shrink-0 flex items-center px-3 gap-2 bg-canvas-soft border-b border-hairline">
          {title && (
            <>
              <span className="text-[13px] font-medium text-ink">{title}</span>
              {!loading && (
                <span className="text-[12px] text-ink-mute ml-1">
                  {data.length.toLocaleString()} records
                </span>
              )}
            </>
          )}
          <div className="ml-auto flex items-center gap-1">
            {(
              [
                { Icon: FilterIcon, label: "Filter" },
                { Icon: RefreshCwIcon, label: "Refresh" },
                { Icon: DownloadIcon, label: "Export" },
                { Icon: MoreHorizontalIcon, label: "More" },
              ] as const
            ).map(({ Icon, label }) => (
              <button
                key={label}
                title={label}
                className="size-7 grid place-items-center rounded-sm text-ink-mute hover:bg-canvas hover:text-ink transition-colors"
              >
                <Icon size={14} />
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {(columns.length > 0 ? columns : Array.from({ length: 4 }, (_, i) => ({ key: String(i), header: "", isNumeric: false }) as ColumnDef<T>)).map((col, idx) => (
                  <th
                    key={col.key ?? idx}
                    className="h-9 px-4 bg-canvas-soft border-b border-hairline text-left"
                  >
                    <Skeleton className="h-2.5 w-20" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, r) => (
                <tr key={r} className="h-10 border-b border-hairline">
                  {(columns.length > 0 ? columns : Array.from({ length: 4 }, (_, i) => ({ key: String(i), header: "", isNumeric: false }) as ColumnDef<T>)).map((col, idx) => (
                    <td key={col.key ?? idx} className="px-4 py-0">
                      <Skeleton className={cn("h-2.5", skeletonWidthForCol(col, idx))} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 px-4">
          <div className="size-12 rounded-full border-2 border-hairline grid place-items-center text-ink-mute">
            <InboxIcon className="size-5" strokeWidth={1.2} />
          </div>
          <div className="text-[14px] text-ink-secondary">
            {emptyTitle ?? t("empty.title")}
          </div>
          <div className="text-[12px] text-ink-mute text-center">
            {emptySubtitle ?? t("empty.subtitle")}
          </div>
          {emptyAction && (
            <button
              onClick={emptyAction.onClick}
              className="mt-1 flex items-center gap-1.5 h-7 px-3 rounded-full text-[13px]"
              style={{ background: "var(--primary)", color: "var(--primary-fg)" }}
            >
              <PlusIcon className="size-3" />
              {emptyAction.label}
              {emptyAction.kbd && (
                <span
                  className="ml-1 font-mono text-[10px] px-1 rounded-[3px] border"
                  style={{
                    borderColor:
                      "color-mix(in oklab, var(--primary-fg) 30%, transparent)",
                    background:
                      "color-mix(in oklab, var(--primary-fg) 12%, transparent)",
                  }}
                >
                  {emptyAction.kbd}
                </span>
              )}
            </button>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="sticky top-0 z-10">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "h-9 px-4 bg-canvas-soft text-left text-[12px] font-medium text-ink-mute border-b border-hairline",
                      col.isNumeric && "text-right",
                      col.align === "center" && "text-center",
                      col.align === "right" && "text-right",
                    )}
                    style={col.width ? { width: col.width } : undefined}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => {
                const id = keyExtractor(row);
                const isSelected =
                  selectedIndex === idx && focusState.panel === panelId;

                return (
                  <tr
                    key={id}
                    className={cn(
                      "h-10 border-b border-hairline cursor-pointer transition-colors",
                      !isSelected && "hover:bg-canvas-soft",
                    )}
                    style={
                      isSelected
                        ? {
                            borderLeft: "2px solid var(--primary)",
                            backgroundColor:
                              "color-mix(in oklab, var(--primary) 9%, transparent)",
                          }
                        : undefined
                    }
                    onClick={() => {
                      setSelectedIndex(idx);
                      setFocus({
                        entity: entityName,
                        recordId: id,
                        panel: panelId,
                        area: "grid",
                        row: idx,
                      });
                    }}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          "px-4 py-0 text-[13px] text-ink font-light",
                          col.isNumeric && "text-right font-mono tabular-nums",
                          col.align === "center" && "text-center",
                          col.align === "right" && "text-right",
                        )}
                      >
                        {col.render
                          ? col.render(row)
                          : (row as Record<string, unknown>)[col.key] as React.ReactNode}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
