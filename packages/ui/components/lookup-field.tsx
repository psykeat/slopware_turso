import { useQuery } from "@tanstack/react-query";
import { ChevronDownIcon, XIcon } from "lucide-react";
import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { cn } from "../lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog";

export interface LookupItem<T = unknown> {
  value: string;
  label: string;
  description?: string;
  raw?: T;
}

export interface LookupSource<T = unknown> {
  search: (query: string, options?: { limit?: number }) => Promise<LookupItem<T>[]>;
  resolve?: (value: string) => Promise<LookupItem<T> | null>;
  title?: string;
  placeholder?: string;
  emptyLabel?: string;
  cacheKey?: string;
}

export interface LookupFieldProps<T = unknown> {
  label?: string;
  value: string | null;
  source: LookupSource<T>;
  onChange: (value: string | null, item?: LookupItem<T> | null) => void;
  tabIndex?: number;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  onTabForward?: () => void;
  onFocusChange?: (focused: boolean) => void;
}

const inputBase =
  "h-8 w-full border bg-canvas rounded px-2.5 text-[13px] text-ink outline-none transition-colors border-hairline-input focus-visible:ring-[3px] focus-visible:ring-[color-mix(in_oklab,var(--primary)_20%,transparent)] focus-visible:border-primary disabled:opacity-50 disabled:cursor-not-allowed";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function buildDropdownStyle(anchor: DOMRect | null) {
  if (!anchor) return undefined;
  return {
    position: "fixed" as const,
    top: Math.round(anchor.bottom + 4),
    left: Math.round(anchor.left),
    width: Math.round(anchor.width),
  };
}

function LookupOptionList<T>({
  items,
  selectedIndex,
  onHover,
  onPick,
  emptyLabel,
}: {
  items: LookupItem<T>[];
  selectedIndex: number;
  onHover: (index: number) => void;
  onPick: (item: LookupItem<T>) => void;
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return <div className="px-3 py-2 text-[12px] text-ink-mute">{emptyLabel}</div>;
  }

  return (
    <>
      {items.map((item, index) => (
        <button
          key={`${item.value}-${index}`}
          type="button"
          className={cn(
            "flex w-full cursor-pointer flex-col gap-0.5 border-b border-hairline px-3 py-2 text-left transition-colors last:border-0 hover:bg-canvas-soft",
            index === selectedIndex && "bg-canvas-soft",
          )}
          onMouseEnter={() => onHover(index)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(item)}
        >
          <span className="truncate text-[13px] font-medium text-ink">{item.label}</span>
          {item.description && (
            <span className="truncate text-[11px] text-ink-mute">{item.description}</span>
          )}
        </button>
      ))}
    </>
  );
}

function LookupFieldInner<T>(
  {
    label,
    value,
    source,
    onChange,
    tabIndex,
    className,
    disabled = false,
    placeholder,
    onTabForward,
    onFocusChange,
  }: LookupFieldProps<T>,
  forwardedRef: React.ForwardedRef<HTMLInputElement>,
) {
  const [isOpen, setIsOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [userHasInteracted, setUserHasInteracted] = useState(false);
  const [hasTyped, setHasTyped] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const fieldInputRef = useRef<HTMLInputElement>(null);
  const dialogSearchRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const onFocusChangeRef = useRef(onFocusChange);
  const lastFocusedRef = useRef(false);
  useImperativeHandle(forwardedRef, () => fieldInputRef.current as HTMLInputElement, []);

  useEffect(() => {
    onFocusChangeRef.current = onFocusChange;
  }, [onFocusChange]);

  const queryLimit = dialogOpen ? 100 : 20;
  const lookupKey = source.cacheKey ?? source.title ?? label ?? "lookup";

  const { data: resolvedItem } = useQuery({
    queryKey: ["lookup", lookupKey, value, source.resolve, "resolve"],
    queryFn: async () => {
      if (!value || !source.resolve) return null;
      return source.resolve(value);
    },
    enabled: !!value && !isOpen && !dialogOpen && !!source.resolve,
  });

  const { data: results = [] } = useQuery({
    queryKey: [
      "lookup",
      lookupKey,
      query,
      queryLimit,
      dialogOpen ? "dialog" : "inline",
      source,
      source.search,
    ],
    queryFn: async () => source.search(query, { limit: queryLimit }),
    enabled: isOpen || dialogOpen,
    staleTime: 0,
  });

  const selectedItem = resolvedItem ?? null;
  const activeIndex = results.length === 0 ? 0 : Math.min(selectedIndex, results.length - 1);

  const displayValue =
    (isOpen || dialogOpen) && hasTyped ? query : (selectedItem?.label ?? value ?? "");

  useLayoutEffect(() => {
    if (!isOpen || dialogOpen) return;
    const syncPosition = () => {
      setAnchorRect(fieldInputRef.current?.getBoundingClientRect() ?? null);
    };
    syncPosition();
    window.addEventListener("scroll", syncPosition, true);
    window.addEventListener("resize", syncPosition);
    return () => {
      window.removeEventListener("scroll", syncPosition, true);
      window.removeEventListener("resize", syncPosition);
    };
  }, [dialogOpen, isOpen, query]);

  useEffect(() => {
    const focused = isOpen || dialogOpen;
    if (lastFocusedRef.current === focused) return;
    lastFocusedRef.current = focused;
    onFocusChangeRef.current?.(focused);
  }, [dialogOpen, isOpen]);

  useEffect(() => {
    if (!dialogOpen) return;
    const id = window.setTimeout(() => {
      dialogSearchRef.current?.focus();
      dialogSearchRef.current?.select();
    }, 0);
    return () => window.clearTimeout(id);
  }, [dialogOpen]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (portalRef.current?.contains(target)) return;
      if (dialogOpen) return;
      setIsOpen(false);
      setQuery("");
      setSelectedIndex(0);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dialogOpen]);

  const selectedResult = useMemo(() => results[activeIndex] ?? null, [results, activeIndex]);
  const canUseDOM = typeof document !== "undefined";

  const closeLookup = () => {
    setIsOpen(false);
    setDialogOpen(false);
    setQuery("");
    setSelectedIndex(0);
    setUserHasInteracted(false);
    setHasTyped(false);
  };

  const pick = (item: LookupItem<T>) => {
    onChange(item.value, item);
    closeLookup();
  };

  const openInline = (initialQuery = "") => {
    setDialogOpen(false);
    setIsOpen(true);
    setQuery(initialQuery);
    setSelectedIndex(0);
    const isTyped = initialQuery !== "";
    setUserHasInteracted(isTyped);
    setHasTyped(isTyped);
  };

  const toggleDialog = () => {
    if (dialogOpen) {
      closeLookup();
      fieldInputRef.current?.focus();
      return;
    }
    setIsOpen(true);
    setDialogOpen(true);
    setSelectedIndex(0);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (!isOpen && !dialogOpen) {
      if (event.key === "F5") {
        event.preventDefault();
        setQuery("");
        toggleDialog();
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openInline("");
        return;
      }

      if (!event.ctrlKey && !event.altKey && !event.metaKey && event.key.length === 1) {
        event.preventDefault();
        openInline(event.key);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setUserHasInteracted(true);
      setSelectedIndex((index) => Math.min(index + 1, results.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setUserHasInteracted(true);
      setSelectedIndex((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (query === "") {
        onChange(null, null);
        closeLookup();
      } else {
        const item = selectedResult;
        if (item) pick(item);
      }
      return;
    }

    if (event.key === "Tab" && !event.shiftKey) {
      if (userHasInteracted) {
        if (query === "") {
          onChange(null, null);
          closeLookup();
        } else {
          const item = selectedResult;
          if (item) pick(item);
        }
      } else {
        closeLookup();
      }
      if (onTabForward) {
        event.preventDefault();
        requestAnimationFrame(() => onTabForward());
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeLookup();
      fieldInputRef.current?.focus();
      return;
    }

    if (event.key === "F5") {
      event.preventDefault();
      toggleDialog();
    }
  };

  const popup =
    canUseDOM && isOpen && !dialogOpen && anchorRect
      ? createPortal(
          <div
            ref={portalRef}
            style={buildDropdownStyle(anchorRect)}
            className="z-[70] max-h-[260px] overflow-hidden rounded-md border border-hairline bg-canvas shadow-lg"
          >
            <div className="max-h-[260px] overflow-auto">
              <LookupOptionList
                items={results}
                selectedIndex={selectedIndex}
                onHover={setSelectedIndex}
                onPick={pick}
                emptyLabel={source.emptyLabel ?? "No results"}
              />
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)} ref={rootRef}>
      {label && (
        <label className="text-[11px] font-medium tracking-wider text-ink-mute uppercase">
          {label}
        </label>
      )}

      <div className="relative">
        <input
          ref={(node) => {
            fieldInputRef.current = node;
          }}
          tabIndex={tabIndex}
          className={cn(inputBase, "pr-8")}
          placeholder={placeholder ?? source.placeholder ?? "Select..."}
          value={displayValue}
          readOnly={!isOpen && !dialogOpen}
          disabled={disabled}
          onFocus={() => {
            if (disabled) return;
            setIsOpen(true);
            setDialogOpen(false);
            setQuery("");
            setSelectedIndex(0);
            setUserHasInteracted(false);
            setHasTyped(false);
          }}
          onBlur={() => {
            if (dialogOpen) return;
            closeLookup();
          }}
          onClick={() => {
            if (disabled) return;
            setIsOpen(true);
            setDialogOpen(false);
            setQuery("");
            setSelectedIndex(0);
            setUserHasInteracted(false);
            setHasTyped(false);
          }}
          onChange={(event) => {
            if (!isOpen && !dialogOpen) return;
            setQuery(event.target.value);
            setSelectedIndex(0);
            setUserHasInteracted(true);
            setHasTyped(true);
          }}
          onKeyDown={handleKeyDown}
        />
        {value && !disabled ? (
          <button
            type="button"
            tabIndex={-1}
            className="absolute top-1/2 right-2 -translate-y-1/2 text-ink-mute transition-colors hover:text-ink"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onChange(null, null);
              closeLookup();
              fieldInputRef.current?.focus();
            }}
          >
            <XIcon className="size-3.5" />
          </button>
        ) : (
          <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-ink-mute" />
        )}
      </div>

      {popup}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => (open ? setDialogOpen(true) : closeLookup())}
      >
        <DialogContent className="max-w-4xl overflow-hidden p-0">
          <DialogHeader className="border-b border-hairline px-5 py-4">
            <DialogTitle className="text-[14px] font-medium text-ink">
              {source.title ?? label ?? "Lookup"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 p-5">
            <input
              ref={dialogSearchRef}
              className={inputBase}
              value={query}
              placeholder={placeholder ?? source.placeholder ?? "Search..."}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleKeyDown}
            />
            <div className="max-h-[60vh] overflow-auto rounded-md border border-hairline">
              <LookupOptionList
                items={results}
                selectedIndex={selectedIndex}
                onHover={setSelectedIndex}
                onPick={pick}
                emptyLabel={source.emptyLabel ?? "No results"}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const LookupField = React.forwardRef(LookupFieldInner) as <T = unknown>(
  props: LookupFieldProps<T> & React.RefAttributes<HTMLInputElement>,
) => React.ReactElement | null;

export interface LookupFieldMeta {
  lookupTable?: string;
  lookupFilter?: unknown;
  lookupPkColumn?: string;
  lookupDisplayColumn?: string;
  lookupCodeColumn?: string;
  lookupValueColumn?: string;
  lookupSortColumn?: string;
  lookupIsI18n?: boolean;
}

export interface RemoteLookupConfig extends LookupFieldMeta {
  title: string;
  placeholder?: string;
  emptyLabel?: string;
  valueLabel?: string;
}

function localizedRecordValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (isObject(value)) {
    const preferred = value.de ?? value.en ?? value.name ?? value.label ?? value.code;
    if (typeof preferred === "string" || typeof preferred === "number") {
      return String(preferred);
    }
  }
  return "";
}

function lookupRecordLabel<T extends Record<string, unknown>>(
  record: T,
  config: RemoteLookupConfig,
  valueColumn: string,
  displayColumn: string,
  codeColumn?: string,
): LookupItem<T> {
  const rawValue = record[valueColumn] ?? record[config.lookupPkColumn ?? ""] ?? "";
  const value =
    typeof rawValue === "string" || typeof rawValue === "number" || typeof rawValue === "boolean"
      ? String(rawValue)
      : localizedRecordValue(rawValue);
  const display = localizedRecordValue(record[displayColumn]);
  const code = codeColumn ? localizedRecordValue(record[codeColumn]) : "";
  const label =
    code && display && code !== display ? `${code} — ${display}` : display || code || value;
  return {
    value,
    label,
    description: code && display && code !== display ? display : undefined,
    raw: record,
  };
}

function applyLookupFilterParams(params: URLSearchParams, lookupFilter: unknown) {
  if (!lookupFilter) return;
  if (Array.isArray(lookupFilter)) {
    params.set("filters", JSON.stringify(lookupFilter));
    return;
  }
  if (isObject(lookupFilter)) {
    for (const [key, value] of Object.entries(lookupFilter)) {
      if (value == null) continue;
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        params.set(key, String(value));
      }
    }
  }
}

export function createRemoteLookupSource(
  config: RemoteLookupConfig,
): LookupSource<Record<string, unknown>> {
  const entityName = config.lookupTable;
  if (!entityName) {
    throw new Error("createRemoteLookupSource requires lookupTable");
  }

  const valueColumn = config.lookupValueColumn ?? config.lookupPkColumn ?? `${entityName}Id`;
  const displayColumn = config.lookupDisplayColumn ?? "name";
  const codeColumn = config.lookupCodeColumn;
  const sortColumn = config.lookupSortColumn ?? displayColumn;

  return {
    title: config.title,
    cacheKey: JSON.stringify([
      entityName,
      valueColumn,
      displayColumn,
      codeColumn ?? "",
      sortColumn,
      config.lookupFilter ?? null,
    ]),
    placeholder: config.placeholder,
    emptyLabel: config.emptyLabel,
    search: async (query, options) => {
      const params = new URLSearchParams();
      params.set("limit", String(options?.limit ?? 20));
      params.set("orderBy", `${sortColumn}:asc`);
      if (query.trim()) params.set("search", query.trim());
      applyLookupFilterParams(params, config.lookupFilter);

      const res = await fetch(`/api/data/${entityName}?${params.toString()}`);
      if (!res.ok) return [];
      const rows = (await res.json()) as Record<string, unknown>[];
      return rows.map((record) =>
        lookupRecordLabel(record, config, valueColumn, displayColumn, codeColumn),
      );
    },
    resolve: async (value) => {
      if (!value) return null;
      const params = new URLSearchParams();
      params.set(valueColumn, value);
      params.set("limit", "1");
      applyLookupFilterParams(params, config.lookupFilter);
      const res = await fetch(`/api/data/${entityName}?${params.toString()}`);
      if (!res.ok) return null;
      const rows = (await res.json()) as Record<string, unknown>[];
      const row = rows[0];
      return row ? lookupRecordLabel(row, config, valueColumn, displayColumn, codeColumn) : null;
    },
  };
}

export function createStaticLookupSource<T extends Record<string, unknown>>(
  items: T[],
  config: {
    title: string;
    valueColumn: keyof T & string;
    labelColumns: Array<keyof T & string>;
    descriptionColumns?: Array<keyof T & string>;
    placeholder?: string;
    emptyLabel?: string;
  },
): LookupSource<T> {
  const mapItem = (record: T): LookupItem<T> => {
    const value = String(record[config.valueColumn] ?? "");
    const labelPieces = config.labelColumns
      .map((column) => localizedRecordValue(record[column]))
      .filter((part) => part.length > 0);
    const descriptionPieces =
      config.descriptionColumns
        ?.map((column) => localizedRecordValue(record[column]))
        .filter((part) => part.length > 0) ?? [];
    return {
      value,
      label: labelPieces.join(" — ") || value,
      description: descriptionPieces.join(" · ") || undefined,
      raw: record,
    };
  };

  return {
    title: config.title,
    cacheKey: JSON.stringify(items.map((item) => String(item[config.valueColumn] ?? ""))),
    placeholder: config.placeholder,
    emptyLabel: config.emptyLabel,
    search: async (query, options) => {
      const normalized = normalizeText(query);
      const mapped = items.map(mapItem).filter((item) => {
        if (!normalized) return true;
        return (
          normalizeText(item.label).includes(normalized) ||
          normalizeText(item.description ?? "").includes(normalized) ||
          normalizeText(item.value).includes(normalized)
        );
      });
      return mapped.slice(0, options?.limit ?? mapped.length);
    },
    resolve: async (value) => {
      const found = items.find((item) => String(item[config.valueColumn] ?? "") === value);
      return found ? mapItem(found) : null;
    },
  };
}

export function mapLookupItem<T extends Record<string, unknown>>(
  record: T,
  valueColumn: keyof T & string,
  labelColumns: Array<keyof T & string>,
  descriptionColumns?: Array<keyof T & string>,
): LookupItem<T> {
  const label = labelColumns
    .map((column) => localizedRecordValue(record[column]))
    .filter(Boolean)
    .join(" — ");
  const description = descriptionColumns
    ?.map((column) => localizedRecordValue(record[column]))
    .filter(Boolean)
    .join(" · ");
  return {
    value: String(record[valueColumn] ?? ""),
    label: label || String(record[valueColumn] ?? ""),
    description: description || undefined,
    raw: record,
  };
}

export function buildLookupConfigFromField(
  field: LookupFieldMeta,
  title: string,
  placeholder?: string,
  emptyLabel?: string,
): RemoteLookupConfig | null {
  if (!field.lookupTable) return null;
  return {
    ...field,
    title,
    placeholder,
    emptyLabel,
  };
}
