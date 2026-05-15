import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDownIcon, ChevronRightIcon, PlusIcon, SlidersHorizontalIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { AddressPickerField } from "./address-picker-field";
import type { AddressSnapshot } from "./address-picker-field";
import { formatMoney, StatusDot } from "../lib/formatters";
import { cn } from "../lib/utils";
import { useCommands } from "../platform/command-registry";

export interface DocumentEditorProps {
  documentId: string;
  documentGroupId?: string;
  onClose: () => void;
}

// ─── types ───────────────────────────────────────────────────────────────────

interface DocHeader {
  documentId?: string;
  documentNo?: string;
  status?: string;
  documentType?: string;
  documentGroupId?: string;
  customerId?: string | null;
  billingAddress?: AddressSnapshot | null;
  deliveryAddressId?: string | null;
  deliveryAddress?: AddressSnapshot | null;
  warehouseId?: string | null;
  paymentTermId?: string | null;
  shippingMethodId?: string | null;
  currencyId?: string | null;
  documentDate?: string | null;
  totalNet?: string | null;
  totalTax?: string | null;
  totalGross?: string | null;
}

interface DocGroup {
  documentGroupId: string;
  name: string;
  documentType: string;
  defaultWarehouseId?: string | null;
  defaultPaymentTermId?: string | null;
  defaultShippingMethodId?: string | null;
  defaultCurrencyId?: string | null;
}

interface LineRow {
  _id: string;
  documentLineId?: string;
  lineNo: number;
  articleId: string | null;
  articleTextSnapshot: string | null;
  quantity: number;
  unit: string | null;
  netPrice: number;
  discountPercentage: number | null;
  taxCodeId: string | null;
  taxRate: number | null;
  isNew?: boolean;
  isDeleted?: boolean;
}

interface ArticleResult {
  articleId: string;
  articleNo: string;
  name: string;
  baseUnit: string | null;
  taxClassId: string | null;
}

interface TaxCodeRow {
  taxCodeId: string;
  taxRate: string;
}

// Stable empty arrays — inline `= []` in useQuery creates a new ref every render,
// which makes useMemo deps change every render and causes an infinite setState loop.
const EMPTY_TAX_CODES: TaxCodeRow[] = [];
const EMPTY_DOC_LINES: any[] = [];

// ─── small helpers ────────────────────────────────────────────────────────────

const inputBase =
  "h-7 w-full border bg-canvas rounded px-2 text-[13px] text-ink outline-none transition-colors border-hairline-input focus-visible:ring-[2px] focus-visible:ring-[color-mix(in_oklab,var(--primary)_20%,transparent)] focus-visible:border-primary disabled:opacity-40";

function lineNet(qty: number, price: number, disc: number | null): number {
  return qty * price * (1 - (disc ?? 0) / 100);
}

function lineTax(net: number, rate: number | null): number {
  return net * ((rate ?? 0) / 100);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function nextLineNo(lines: LineRow[]): number {
  if (lines.length === 0) return 10;
  return Math.max(...lines.map((l) => l.lineNo)) + 10;
}

function emptyLine(parentId: string, lineNo: number): LineRow {
  return {
    _id: `new-${Date.now()}-${Math.random()}`,
    lineNo,
    articleId: null,
    articleTextSnapshot: null,
    quantity: 1,
    unit: null,
    netPrice: 0,
    discountPercentage: null,
    taxCodeId: null,
    taxRate: null,
    isNew: true,
  };
}

// ─── DocLookupField ───────────────────────────────────────────────────────────

interface LookupItem { id: string; label: string }

function DocLookupField({
  label,
  value,
  onChange,
  items,
  placeholder = "—",
  tabIndex,
}: {
  label: string;
  value: string | null;
  onChange: (id: string | null) => void;
  items: LookupItem[];
  placeholder?: string;
  tabIndex?: number;
}) {
  const { t } = useTranslation('ui');
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [idx, setIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setIdx(0);
      setTimeout(() => searchRef.current?.focus(), 30);
    }
  }, [isOpen]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        setIsOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = useMemo(
    () =>
      search
        ? items.filter((i) => i.label.toLowerCase().includes(search.toLowerCase()))
        : items,
    [items, search],
  );

  const selected = items.find((i) => i.id === value);

  const pick = (item: LookupItem) => {
    onChange(item.id);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && filtered[idx]) { e.preventDefault(); pick(filtered[idx]); }
    else if (e.key === "Escape") setIsOpen(false);
    else if (e.key === "F5") { e.preventDefault(); setIsOpen((o) => !o); }
  };

  return (
    <div className="flex flex-col gap-1" ref={containerRef}>
      {label && <label className="text-[11px] font-medium uppercase tracking-wider text-ink-mute">{label}</label>}
      <div className="relative">
        <div
          tabIndex={tabIndex}
          className="h-8 flex items-center justify-between gap-1 cursor-pointer rounded border border-hairline-input bg-canvas px-2.5 text-[13px] text-ink outline-none focus-visible:ring-[2px] focus-visible:ring-[color-mix(in_oklab,var(--primary)_20%,transparent)] focus-visible:border-primary"
          onClick={() => setIsOpen((o) => !o)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " " || e.key === "F5") { e.preventDefault(); setIsOpen((o) => !o); }
            else handleKeyDown(e);
          }}
        >
          <span className={selected ? "text-ink" : "text-ink-mute"}>{selected?.label ?? placeholder}</span>
          <ChevronDownIcon className="size-3.5 shrink-0 text-ink-mute" />
        </div>

        {isOpen && (
          <div className="absolute z-50 mt-1 w-full rounded-md border border-hairline bg-canvas shadow-lg" style={{ maxHeight: 220 }}>
            <div className="border-b border-hairline px-2 py-1.5">
              <input
                ref={searchRef}
                className="w-full bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-mute"
                placeholder={t('document.lookup.search')}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setIdx(0); }}
                onKeyDown={handleKeyDown}
              />
            </div>
            <div className="overflow-auto" style={{ maxHeight: 168 }}>
              {filtered.length === 0 && (
                <div className="px-3 py-2 text-[12px] text-ink-mute">{t('document.lookup.noEntries')}</div>
              )}
              {filtered.map((item, i) => (
                <div
                  key={item.id}
                  className={cn(
                    "cursor-pointer px-3 py-1.5 text-[13px] transition-colors hover:bg-canvas-soft",
                    i === idx && "bg-canvas-soft",
                    item.id === value && "font-medium text-primary",
                  )}
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => pick(item)}
                >
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ArticleSearchCell ────────────────────────────────────────────────────────

function ArticleSearchCell({
  value,
  textSnapshot,
  onSelect,
  inputRef,
}: {
  value: string | null;
  textSnapshot: string | null;
  onSelect: (article: ArticleResult) => void;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const { t } = useTranslation('ui');
  const [query, setQuery] = useState(value ? (textSnapshot ?? "") : "");
  const [isOpen, setIsOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        setIsOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const { data: results = [] } = useQuery<ArticleResult[]>({
    queryKey: ["article-search", query],
    queryFn: async () => {
      const res = await fetch(`/api/articles/search?q=${encodeURIComponent(query)}&limit=20`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isOpen && query.length >= 1,
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && isOpen && results[idx]) { e.preventDefault(); onSelect(results[idx]); setIsOpen(false); }
    else if (e.key === "Escape") setIsOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <input
        ref={inputRef}
        className={cn(inputBase, "text-[12px]")}
        value={query}
        placeholder={t('document.lines.articleSearch')}
        onChange={(e) => { setQuery(e.target.value); setIsOpen(true); setIdx(0); }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
      />
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 mt-0.5 w-80 rounded-md border border-hairline bg-canvas shadow-lg" style={{ maxHeight: 240 }}>
          {results.map((r, i) => (
            <div
              key={r.articleId}
              className={cn(
                "flex cursor-pointer items-center justify-between gap-2 border-b border-hairline px-3 py-1.5 last:border-0 hover:bg-canvas-soft transition-colors",
                i === idx && "bg-canvas-soft",
              )}
              onMouseEnter={() => setIdx(i)}
              onClick={() => { onSelect(r); setIsOpen(false); }}
            >
              <div className="flex flex-col min-w-0">
                <span className="text-[13px] font-medium text-ink truncate">{r.name}</span>
                <span className="font-mono text-[11px] text-ink-mute">{r.articleNo}</span>
              </div>
              {r.baseUnit && <span className="shrink-0 text-[11px] text-ink-mute">{r.baseUnit}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── DocumentLinesEditor ──────────────────────────────────────────────────────

interface DocumentLinesEditorHandle {
  focusFirstLine: () => void;
}

const DocumentLinesEditor = forwardRef<DocumentLinesEditorHandle, {
  documentId: string | null;
  customerId: string | null;
  documentDate: string | null;
  status?: string;
  onLinesChange?: (lines: LineRow[]) => void;
}>(function DocumentLinesEditor({ documentId, customerId, documentDate, status, onLinesChange }, ref) {
  const { t } = useTranslation('ui');
  const isPosted = status === "posted";
  const queryClient = useQueryClient();
  const [lines, setLines] = useState<LineRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVals, setEditVals] = useState<Partial<LineRow>>({});
  const [korrLineId, setKorrLineId] = useState<string | null>(null);
  const [korrDelta, setKorrDelta] = useState<string>("");

  const korrMutation = useMutation({
    mutationFn: async ({ lineId, qtyDelta }: { lineId: string; qtyDelta: number }) => {
      const res = await fetch(`/api/documents/lines/${lineId}/delta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qtyDelta }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data", "documentLine", documentId] });
      setKorrLineId(null);
      setKorrDelta("");
      toast.success(t('document.lines.korrekturPosted'));
    },
    onError: (err: any) => toast.error(err.message ?? t('document.lines.korrekturError')),
  });

  const articleInputRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const discRef = useRef<HTMLInputElement>(null);

  const { data: existingLines = EMPTY_DOC_LINES, isLoading } = useQuery({
    queryKey: ["data", "documentLine", documentId],
    queryFn: async () => {
      if (!documentId) return EMPTY_DOC_LINES;
      const res = await fetch(`/api/data/documentLine?documentId=${documentId}`);
      if (!res.ok) return EMPTY_DOC_LINES;
      return res.json();
    },
    enabled: !!documentId,
  });

  const { data: taxCodes = EMPTY_TAX_CODES } = useQuery<TaxCodeRow[]>({
    queryKey: ["data", "taxCode"],
    queryFn: async () => {
      const res = await fetch("/api/data/taxCode?limit=100");
      if (!res.ok) return EMPTY_TAX_CODES;
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const taxRateMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const tc of taxCodes as TaxCodeRow[]) {
      m[tc.taxCodeId] = Number(tc.taxRate ?? 0);
    }
    return m;
  }, [taxCodes]);

  useEffect(() => {
    const mapped: LineRow[] = ((existingLines as any[]) ?? []).map((l: any) => ({
      _id: l.documentLineId,
      documentLineId: l.documentLineId,
      lineNo: l.lineNo,
      articleId: l.articleId ?? null,
      articleTextSnapshot: l.articleTextSnapshot ?? null,
      quantity: Number(l.quantity ?? 1),
      unit: l.unit ?? null,
      netPrice: Number(l.netPrice ?? 0),
      discountPercentage: l.discountPercentage != null ? Number(l.discountPercentage) : null,
      taxCodeId: l.taxCodeId ?? null,
      taxRate: l.taxCodeId ? (taxRateMap[l.taxCodeId] ?? null) : null,
    }));
    setLines(mapped);
  }, [existingLines, taxRateMap]);

  // Auto-add first empty line
  useEffect(() => {
    if (!isLoading && documentId && lines.length === 0 && editingId === null) {
      addLine();
    }
  }, [isLoading, documentId, lines.length]);

  // Sync to parent for save
  useEffect(() => {
    onLinesChange?.(lines.filter((l) => !l.isDeleted));
  }, [lines]);

  // Focus article input on new edit
  useEffect(() => {
    if (editingId) {
      setTimeout(() => {
        articleInputRef.current?.focus();
        articleInputRef.current?.select();
      }, 30);
    }
  }, [editingId]);

  useImperativeHandle(ref, () => ({
    focusFirstLine: () => {
      const firstVisible = lines.find((l) => !l.isDeleted);
      if (firstVisible) {
        startEdit(firstVisible);
      } else {
        addLine();
      }
      setTimeout(() => articleInputRef.current?.focus(), 50);
    },
  }));

  function addLine() {
    const newLine = emptyLine(documentId ?? "", nextLineNo(lines));
    setLines((prev) => [...prev, newLine]);
    setEditingId(newLine._id);
    setEditVals({ ...newLine });
  }

  function startEdit(line: LineRow) {
    setEditingId(line._id);
    setEditVals({ ...line });
  }

  function commitEdit() {
    if (!editingId) return;
    setLines((prev) =>
      prev.map((l) =>
        l._id === editingId
          ? { ...l, ...editVals, taxRate: editVals.taxCodeId ? (taxRateMap[editVals.taxCodeId as string] ?? null) : null }
          : l,
      ),
    );
    setEditingId(null);
    setEditVals({});
  }

  function cancelEdit() {
    // remove if new and unchanged
    const current = lines.find((l) => l._id === editingId);
    if (current?.isNew && !current.articleId) {
      setLines((prev) => prev.filter((l) => l._id !== editingId));
    }
    setEditingId(null);
    setEditVals({});
  }

  function deleteLine(id: string) {
    setLines((prev) =>
      prev
        .map((l) => (l._id === id ? { ...l, isDeleted: true } : l))
        .filter((l) => !(l.isDeleted && l.isNew)),
    );
    if (editingId === id) { setEditingId(null); setEditVals({}); }
  }

  async function handleArticleSelect(article: ArticleResult) {
    // Fetch pricing
    let price = 0;
    let taxCodeId: string | null = null;
    try {
      const params = new URLSearchParams({ articleId: article.articleId });
      if (customerId) params.set("customerId", customerId);
      if (documentDate) params.set("documentDate", documentDate);
      const res = await fetch(`/api/articles/${article.articleId}/pricing?${params}`);
      if (res.ok) {
        const data = await res.json();
        price = Number(data.unitPrice ?? 0);
        taxCodeId = data.taxCodeId ?? null;
      }
    } catch { /* pricing optional */ }

    setEditVals((prev) => ({
      ...prev,
      articleId: article.articleId,
      articleTextSnapshot: article.name,
      unit: article.baseUnit ?? null,
      netPrice: price,
      taxCodeId,
    }));

    // Advance focus to qty
    setTimeout(() => {
      qtyRef.current?.focus();
      qtyRef.current?.select();
    }, 30);
  }

  function handleLineCellKeyDown(e: React.KeyboardEvent, field: "qty" | "price" | "disc") {
    if (e.key === "Tab") {
      e.preventDefault();
      if (field === "qty") { priceRef.current?.focus(); priceRef.current?.select(); }
      else if (field === "price") { discRef.current?.focus(); discRef.current?.select(); }
      else if (field === "disc") {
        // commit + move to next line
        commitEdit();
        const activeLines = lines.filter((l) => !l.isDeleted);
        const currentIdx = activeLines.findIndex((l) => l._id === editingId);
        if (currentIdx >= 0 && currentIdx < activeLines.length - 1) {
          const next = activeLines[currentIdx + 1];
          setTimeout(() => startEdit(next), 30);
        } else {
          setTimeout(() => addLine(), 30);
        }
      }
    } else if (e.key === "Escape") {
      cancelEdit();
    } else if (e.key === "Delete" && e.ctrlKey) {
      e.preventDefault();
      deleteLine(editingId!);
    }
  }

  const visibleLines = lines.filter((l) => !l.isDeleted);

  const totals = useMemo(() => {
    let net = 0, tax = 0;
    for (const l of visibleLines) {
      const n = lineNet(l.quantity, l.netPrice, l.discountPercentage);
      net += n;
      tax += lineTax(n, l.taxRate);
    }
    return { net, tax, gross: net + tax };
  }, [visibleLines]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Table header */}
      <div className="shrink-0 grid border-b border-hairline bg-canvas-soft text-[11px] font-medium uppercase tracking-wider text-ink-mute" style={{ gridTemplateColumns: "48px 180px 1fr 72px 56px 96px 64px 60px 96px 32px" }}>
        {[t('document.lines.pos'), t('document.lines.article'), t('document.lines.description'), t('document.lines.qty'), t('document.lines.unit'), t('document.lines.price'), t('document.lines.discount'), t('document.lines.taxRate'), t('document.lines.net'), ""].map((h, i) => (
          <div key={i} className="px-2 py-1.5">{h}</div>
        ))}
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-16 text-[13px] text-ink-mute">{t('document.loading')}</div>
        ) : visibleLines.length === 0 ? (
          <div className="flex items-center justify-center h-16 text-[13px] text-ink-mute">
            {t('document.lines.empty')}
          </div>
        ) : (
          visibleLines.map((line) => {
            const isEditing = editingId === line._id;
            const isKorr = korrLineId === line._id;
            const net = lineNet(line.quantity, line.netPrice, line.discountPercentage);
            const ev = editVals;

            return (
              <div key={line._id} className="border-b border-hairline">
                <div
                  className={cn(
                    "grid text-[13px] transition-colors",
                    isPosted ? "cursor-default" : "cursor-pointer",
                    isEditing ? "bg-[color-mix(in_oklab,var(--primary)_4%,var(--canvas))]" : "hover:bg-canvas-soft",
                    isKorr && "bg-[color-mix(in_oklab,var(--primary)_4%,var(--canvas))]",
                  )}
                  style={{ gridTemplateColumns: "48px 180px 1fr 72px 56px 96px 64px 60px 96px 32px" }}
                  onClick={() => !isEditing && !isPosted && startEdit(line)}
                >
                  {/* Pos */}
                  <div className="px-2 py-1.5 font-mono text-[12px] text-ink-mute tabular-nums self-center">
                    {String(line.lineNo).padStart(3, "0")}
                  </div>

                  {/* Article */}
                  <div className="px-1.5 py-1 self-center">
                    {isEditing ? (
                      <ArticleSearchCell
                        value={ev.articleId ?? null}
                        textSnapshot={ev.articleTextSnapshot ?? null}
                        onSelect={handleArticleSelect}
                        inputRef={articleInputRef}
                      />
                    ) : (
                      <span className="font-mono text-[12px] text-ink-mute">{line.articleTextSnapshot ?? line.articleId?.slice(0, 8) ?? "—"}</span>
                    )}
                  </div>

                  {/* Description */}
                  <div className="px-1.5 py-1 self-center min-w-0">
                    {isEditing ? (
                      <input
                        tabIndex={-1}
                        className={cn(inputBase, "text-[12px]")}
                        value={(ev.articleTextSnapshot ?? "") as string}
                        placeholder={t('document.lines.description')}
                        onChange={(e) => setEditVals((v) => ({ ...v, articleTextSnapshot: e.target.value }))}
                      />
                    ) : (
                      <span className="truncate block">{line.articleTextSnapshot ?? ""}</span>
                    )}
                  </div>

                  {/* Qty */}
                  <div className="px-1.5 py-1 self-center">
                    {isEditing ? (
                      <input
                        ref={qtyRef}
                        className={cn(inputBase, "tabular-nums text-right text-[12px]")}
                        type="number"
                        value={(ev.quantity ?? 1) as number}
                        onChange={(e) => setEditVals((v) => ({ ...v, quantity: Number(e.target.value) }))}
                        onKeyDown={(e) => handleLineCellKeyDown(e, "qty")}
                      />
                    ) : (
                      <span className="tabular-nums text-right block">{line.quantity}</span>
                    )}
                  </div>

                  {/* Unit */}
                  <div className="px-2 py-1.5 self-center text-ink-mute text-[12px]">
                    {isEditing ? (ev.unit ?? line.unit ?? "") : (line.unit ?? "")}
                  </div>

                  {/* Unit price */}
                  <div className="px-1.5 py-1 self-center">
                    {isEditing ? (
                      <input
                        ref={priceRef}
                        className={cn(inputBase, "tabular-nums text-right text-[12px]")}
                        type="number"
                        step="0.01"
                        value={(ev.netPrice ?? 0) as number}
                        onChange={(e) => setEditVals((v) => ({ ...v, netPrice: Number(e.target.value) }))}
                        onKeyDown={(e) => handleLineCellKeyDown(e, "price")}
                      />
                    ) : (
                      <span className="tabular-nums text-right block">{formatMoney(line.netPrice)}</span>
                    )}
                  </div>

                  {/* Discount */}
                  <div className="px-1.5 py-1 self-center">
                    {isEditing ? (
                      <input
                        ref={discRef}
                        className={cn(inputBase, "tabular-nums text-right text-[12px]")}
                        type="number"
                        step="0.1"
                        min={0}
                        max={100}
                        value={(ev.discountPercentage ?? "") as number | string}
                        placeholder="0"
                        onChange={(e) => setEditVals((v) => ({ ...v, discountPercentage: e.target.value ? Number(e.target.value) : null }))}
                        onKeyDown={(e) => handleLineCellKeyDown(e, "disc")}
                      />
                    ) : (
                      <span className="tabular-nums text-right block">{line.discountPercentage ? `${line.discountPercentage}%` : ""}</span>
                    )}
                  </div>

                  {/* Tax rate */}
                  <div className="px-2 py-1.5 self-center text-right tabular-nums text-ink-mute text-[12px]">
                    {isEditing
                      ? (ev.taxCodeId ? `${taxRateMap[ev.taxCodeId as string] ?? 0}%` : "—")
                      : (line.taxRate != null ? `${line.taxRate}%` : "—")}
                  </div>

                  {/* Line net */}
                  <div className="px-2 py-1.5 self-center text-right tabular-nums text-[12px]">
                    {formatMoney(net)}
                  </div>

                  {/* Action button: Korrektur (posted) or Delete (draft) */}
                  <div className="flex items-center justify-center py-1">
                    {isPosted ? (
                      <button
                        tabIndex={-1}
                        title="Korrektur"
                        className={cn(
                          "p-0.5 transition-colors",
                          isKorr ? "text-primary" : "text-ink-mute hover:text-primary",
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isKorr) {
                            setKorrLineId(null);
                            setKorrDelta("");
                          } else {
                            setKorrLineId(line._id);
                            setKorrDelta("");
                          }
                        }}
                      >
                        <SlidersHorizontalIcon className="size-3.5" />
                      </button>
                    ) : (
                      <button
                        tabIndex={-1}
                        className="p-0.5 text-ink-mute hover:text-destructive transition-colors"
                        onClick={(e) => { e.stopPropagation(); deleteLine(line._id); }}
                      >
                        <Trash2Icon className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline Korrektur panel */}
                {isKorr && line.documentLineId && (
                  <div className="flex items-center gap-3 px-3 py-2 bg-[color-mix(in_oklab,var(--primary)_6%,var(--canvas))] border-t border-[color-mix(in_oklab,var(--primary)_20%,transparent)]">
                    <span className="text-[12px] font-medium text-ink-mute shrink-0">{t('document.lines.qtyDelta')}</span>
                    <input
                      type="number"
                      step="1"
                      autoFocus
                      className={cn(inputBase, "w-24 tabular-nums text-right text-[12px]")}
                      value={korrDelta}
                      placeholder="z.B. -2"
                      onChange={(e) => setKorrDelta(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const delta = Number(korrDelta);
                          if (!isNaN(delta) && delta !== 0 && line.documentLineId) {
                            korrMutation.mutate({ lineId: line.documentLineId, qtyDelta: delta });
                          }
                        } else if (e.key === "Escape") {
                          setKorrLineId(null);
                          setKorrDelta("");
                        }
                      }}
                    />
                    <button
                      className="h-7 px-3 rounded text-[12px] disabled:opacity-40 transition-colors"
                      style={{ background: "var(--primary)", color: "var(--primary-fg)" }}
                      disabled={korrMutation.isPending || !korrDelta || Number(korrDelta) === 0}
                      onClick={() => {
                        const delta = Number(korrDelta);
                        if (!isNaN(delta) && delta !== 0 && line.documentLineId) {
                          korrMutation.mutate({ lineId: line.documentLineId, qtyDelta: delta });
                        }
                      }}
                    >
                      {t('document.lines.apply')}
                    </button>
                    <button
                      className="h-7 px-3 rounded text-[12px] border border-hairline text-ink-secondary hover:text-ink transition-colors"
                      onClick={() => { setKorrLineId(null); setKorrDelta(""); }}
                    >
                      {t('document.lines.cancel')}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Totals + add */}
      <div className="shrink-0 border-t border-hairline bg-canvas-soft px-3 py-2 flex items-center gap-4">
        <button
          className="flex items-center gap-1.5 h-7 px-3 rounded border border-hairline text-[13px] text-ink-secondary hover:border-primary hover:text-primary transition-colors"
          onClick={addLine}
        >
          <PlusIcon className="size-3.5" />
          Position hinzufügen
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-6 text-[13px] tabular-nums">
          <span className="text-ink-mute">Netto <span className="ml-1 text-ink font-medium">{formatMoney(totals.net)}</span></span>
          <span className="text-ink-mute">MwSt <span className="ml-1 text-ink font-medium">{formatMoney(totals.tax)}</span></span>
          <span className="text-ink-mute font-medium">Brutto <span className="ml-1.5 text-[15px] text-ink font-semibold">{formatMoney(totals.gross)}</span></span>
        </div>
      </div>
    </div>
  );
});

// ─── Main DocumentEditor ──────────────────────────────────────────────────────

export function DocumentEditor({ documentId, documentGroupId, onClose }: DocumentEditorProps) {
  const { t } = useTranslation('ui');
  const queryClient = useQueryClient();
  const { registerCommand } = useCommands();
  const isNew = documentId === "__new__";

  const [header, setHeader] = useState<DocHeader>({});
  const [isHeaderDirty, setIsHeaderDirty] = useState(false);
  const [pendingLines, setPendingLines] = useState<LineRow[]>([]);
  const [showTechnical, setShowTechnical] = useState(false);
  const linesEditorRef = useRef<DocumentLinesEditorHandle>(null);

  // ── fetch existing document ──
  const { data: docData, isLoading: isDocLoading } = useQuery({
    queryKey: ["data", "document", documentId],
    queryFn: async () => {
      const res = await fetch(`/api/data/document/${documentId}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !isNew,
  });

  // ── fetch document group for defaults ──
  const groupId = documentGroupId ?? (docData as any)?.documentGroupId;
  const { data: groupData } = useQuery<DocGroup | null>({
    queryKey: ["data", "documentGroup", groupId],
    queryFn: async () => {
      if (!groupId) return null;
      const res = await fetch(`/api/data/documentGroup/${groupId}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!groupId,
  });

  // ── document type + group selectors (new documents only) ──
  const { data: allDocTypes = [] } = useQuery({
    queryKey: ["data", "documentType"],
    queryFn: async () => { const r = await fetch("/api/data/documentType?limit=100"); return r.ok ? r.json() : []; },
    enabled: isNew,
    staleTime: 5 * 60 * 1000,
  });
  const selectedDocType = header.documentType ?? null;
  const { data: docGroupsForType = [] } = useQuery({
    queryKey: ["data", "documentGroup", selectedDocType],
    queryFn: async () => {
      if (!selectedDocType) return [];
      const r = await fetch(`/api/data/documentGroup?documentType=${selectedDocType}&limit=100`);
      return r.ok ? r.json() : [];
    },
    enabled: isNew && !!selectedDocType,
  });

  // ── lookup tables ──
  const { data: warehouses = [] } = useQuery({
    queryKey: ["data", "warehouse"],
    queryFn: async () => { const r = await fetch("/api/data/warehouse?limit=200"); return r.ok ? r.json() : []; },
    staleTime: 5 * 60 * 1000,
  });
  const { data: paymentTerms = [] } = useQuery({
    queryKey: ["data", "paymentTerm"],
    queryFn: async () => { const r = await fetch("/api/data/paymentTerm?limit=200"); return r.ok ? r.json() : []; },
    staleTime: 5 * 60 * 1000,
  });
  const { data: shippingMethods = [] } = useQuery({
    queryKey: ["data", "shippingMethod"],
    queryFn: async () => { const r = await fetch("/api/data/shippingMethod?limit=200"); return r.ok ? r.json() : []; },
    staleTime: 5 * 60 * 1000,
  });
  const { data: currencies = [] } = useQuery({
    queryKey: ["data", "currency"],
    queryFn: async () => { const r = await fetch("/api/data/currency?limit=200"); return r.ok ? r.json() : []; },
    staleTime: 5 * 60 * 1000,
  });

  // ── initialize header from doc or group defaults ──
  useEffect(() => {
    if (!isNew && docData) {
      setHeader(docData as DocHeader);
      setIsHeaderDirty(false);
    }
  }, [isNew, docData]);

  // Merge group defaults into the new-document draft when they load.
  // Guard via ref so we apply defaults exactly once per group.
  const appliedGroupRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isNew || !groupData) return;
    if (appliedGroupRef.current === groupData.documentGroupId) return;
    appliedGroupRef.current = groupData.documentGroupId;
    setHeader((prev) => ({
      documentGroupId: groupData.documentGroupId,
      documentType: groupData.documentType,
      documentDate: prev.documentDate ?? today(),
      warehouseId: prev.warehouseId ?? groupData.defaultWarehouseId ?? null,
      paymentTermId: prev.paymentTermId ?? groupData.defaultPaymentTermId ?? null,
      shippingMethodId: prev.shippingMethodId ?? groupData.defaultShippingMethodId ?? null,
      currencyId: prev.currencyId ?? groupData.defaultCurrencyId ?? "EUR",
      ...prev,
    }));
  // eslint-disable-next-line react-hooks-js/set-state-in-effect
  }, [isNew, groupData]);

  const patchHeader = (fields: Partial<DocHeader>) => {
    setHeader((prev) => ({ ...prev, ...fields }));
    setIsHeaderDirty(true);
  };

  // ── mutations ──
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isNew) {
        // 1. create header via dedicated endpoint (handles companyId, documentNo, transactionId)
        const res = await fetch("/api/documents/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentGroupId: header.documentGroupId,
            documentType: header.documentType,
            documentDate: header.documentDate ?? today(),
            status: "draft",
            customerId: header.customerId ?? null,
            billingAddress: header.billingAddress ?? null,
            deliveryAddress: header.deliveryAddress ?? null,
            deliveryAddressId: header.deliveryAddressId ?? null,
            currencyId: header.currencyId ?? null,
            warehouseId: header.warehouseId ?? null,
            paymentTermId: header.paymentTermId ?? null,
            shippingMethodId: header.shippingMethodId ?? null,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        const doc = await res.json();
        const newId = doc.documentId;

        // 2. save lines
        for (let i = 0; i < pendingLines.length; i++) {
          const l = pendingLines[i];
          await fetch("/api/data/documentLine", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              documentId: newId,
              lineNo: l.lineNo,
              articleId: l.articleId,
              articleTextSnapshot: l.articleTextSnapshot,
              quantity: String(l.quantity),
              unit: l.unit,
              netPrice: String(l.netPrice),
              discountPercentage: l.discountPercentage != null ? String(l.discountPercentage) : null,
              taxCodeId: l.taxCodeId,
            }),
          });
        }

        return newId;
      } else {
        // patch header if dirty
        if (isHeaderDirty) {
          const res = await fetch(`/api/data/document/${documentId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(header),
          });
          if (!res.ok) throw new Error(await res.text());
        }

        // batch save lines
        for (const l of pendingLines) {
          if (l.isDeleted && l.documentLineId) {
            await fetch(`/api/data/documentLine/${l.documentLineId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ archived: true }),
            });
          } else if (l.isNew) {
            await fetch("/api/data/documentLine", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                documentId,
                lineNo: l.lineNo,
                articleId: l.articleId,
                articleTextSnapshot: l.articleTextSnapshot,
                quantity: String(l.quantity),
                unit: l.unit,
                netPrice: String(l.netPrice),
                discountPercentage: l.discountPercentage != null ? String(l.discountPercentage) : null,
                taxCodeId: l.taxCodeId,
              }),
            });
          } else if (l.documentLineId) {
            await fetch(`/api/data/documentLine/${l.documentLineId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                lineNo: l.lineNo,
                articleId: l.articleId,
                articleTextSnapshot: l.articleTextSnapshot,
                quantity: String(l.quantity),
                unit: l.unit,
                netPrice: String(l.netPrice),
                discountPercentage: l.discountPercentage != null ? String(l.discountPercentage) : null,
                taxCodeId: l.taxCodeId,
              }),
            });
          }
        }
        return documentId;
      }
    },
    onSuccess: (savedId) => {
      queryClient.invalidateQueries({ queryKey: ["data", "document"] });
      queryClient.invalidateQueries({ queryKey: ["data", "documentLine"] });
      setIsHeaderDirty(false);
      toast.success(t('document.actions.save'));
      if (isNew && savedId !== documentId) {
        // Close and let parent re-open with real ID
        onClose();
      }
    },
    onError: (err: any) => toast.error(err.message),
  });

  const postMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/documents/${documentId}/post`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data", "document"] });
      toast.success(t('document.actions.post'));
    },
    onError: (err: any) => toast.error(err.message),
  });

  const convertMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/documents/${documentId}/convert`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data", "document"] });
      toast.success(t('document.actions.convert'));
      onClose();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const stornoMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/documents/${documentId}/storno`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data", "document"] });
      toast.success(t('document.actions.storno'));
      onClose();
    },
    onError: (err: any) => toast.error(err.message),
  });

  // ── commands ──
  const { mutate: saveDocMutate } = saveMutation;
  const { mutate: postDocMutate } = postMutation;
  const handleSave = useCallback(() => saveDocMutate(), [saveDocMutate]);
  const handlePost = useCallback(() => postDocMutate(), [postDocMutate]);

  useEffect(() => {
    return registerCommand({
      id: "doc-save",
      label: { en: "Save Document", de: "Beleg speichern" },
      shortcut: "F10",
      group: "document",
      scope: "context",
      handler: handleSave,
    });
  }, [registerCommand, handleSave]);

  useEffect(() => {
    const status = (header as any).status ?? "draft";
    return registerCommand({
      id: "doc-post",
      label: { en: "Post Document", de: "Beleg buchen" },
      shortcut: "F9",
      group: "document",
      scope: "context",
      isEnabled: () => status === "draft" && !isNew,
      handler: handlePost,
    });
  }, [registerCommand, handlePost, header, isNew]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  // ── lookup items ──
  const warehouseItems: LookupItem[] = (warehouses as any[]).map((w: any) => ({ id: w.warehouseId, label: w.name ?? w.code }));
  const paymentTermItems: LookupItem[] = (paymentTerms as any[]).map((p: any) => ({ id: p.paymentTermId, label: typeof p.name === "object" ? (p.name?.de ?? p.name?.en ?? "") : String(p.name ?? "") }));
  const shippingItems: LookupItem[] = (shippingMethods as any[]).map((s: any) => ({ id: s.shippingMethodId, label: typeof s.name === "object" ? (s.name?.de ?? s.name?.en ?? "") : String(s.name ?? "") }));
  const currencyItems: LookupItem[] = (currencies as any[]).map((c: any) => ({ id: c.currencyId ?? c.code, label: `${c.code} – ${typeof c.name === "object" ? (c.name?.de ?? c.name?.en ?? "") : String(c.name ?? "")}` }));

  const docStatus = (header as any).status ?? (isNew ? "draft" : "—");
  const docNo = isNew ? "wird vergeben" : ((header.documentNo ?? documentId));
  const groupLabel = groupData ? `${groupData.documentType}${String(groupData.documentGroupId).slice(-2)} · ${groupData.name}` : (documentGroupId ?? "");
  const canPost = !isNew && docStatus === "draft";
  const canConvert = !isNew && docStatus === "draft";
  const canStorno = !isNew && docStatus === "posted";

  if (!isNew && isDocLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-canvas">
        <span className="text-[13px] text-ink-mute">{t('document.loading')}</span>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-canvas overflow-hidden">
      {/* Breadcrumb bar */}
      <div className="h-9 shrink-0 flex items-center gap-2 px-3 bg-canvas-soft border-b border-hairline">
        <span className="text-[13px] text-ink-mute">{t('document.breadcrumb')}</span>
        {groupLabel && (
          <>
            <ChevronRightIcon className="size-3 text-hairline-input" />
            <span className="text-[13px] text-ink-mute">{groupLabel}</span>
          </>
        )}
        <ChevronRightIcon className="size-3 text-hairline-input" />
        <span className={cn("text-[13px] font-medium", isNew && "text-ink-mute italic")}>{docNo}</span>
        <StatusDot status={docStatus} />
        {isHeaderDirty && <span className="text-[11px] text-primary ml-1">●</span>}
      </div>

      {/* Header form */}
      <div className="shrink-0 border-b border-hairline bg-canvas">
        {/* DocType + DocGroup selectors — only for new documents without a pre-set group */}
        {isNew && !documentGroupId && (
          <div className="grid gap-x-6 px-4 pt-4 pb-2" style={{ gridTemplateColumns: "1fr 1fr 200px 160px" }}>
            <DocLookupField
              label={t('document.fields.documentType')}
              tabIndex={0}
              value={header.documentType ?? null}
              onChange={(id) => patchHeader({ documentType: id ?? undefined, documentGroupId: undefined })}
              items={(allDocTypes as any[]).map((dt: any) => ({
                id: dt.movementType,
                label: `${dt.movementType} — ${dt.name}`,
              }))}
              placeholder={t('document.lookup.selectType')}
            />
            <DocLookupField
              label={t('document.fields.documentGroup')}
              tabIndex={0}
              value={header.documentGroupId ?? null}
              onChange={(id) => {
                const grp = (docGroupsForType as any[]).find((g: any) => g.documentGroupId === id);
                if (grp) {
                  patchHeader({
                    documentGroupId: grp.documentGroupId,
                    warehouseId: header.warehouseId ?? grp.defaultWarehouseId ?? null,
                    paymentTermId: header.paymentTermId ?? grp.defaultPaymentTermId ?? null,
                    shippingMethodId: header.shippingMethodId ?? grp.defaultShippingMethodId ?? null,
                    currencyId: header.currencyId ?? grp.defaultCurrencyId ?? null,
                  });
                } else {
                  patchHeader({ documentGroupId: id ?? undefined });
                }
              }}
              items={(docGroupsForType as any[]).map((g: any) => ({
                id: g.documentGroupId,
                label: `${String(g.groupNumber ?? "").padStart(2, "0")} — ${g.name}`,
              }))}
              placeholder={selectedDocType ? t('document.lookup.selectGroup') : t('document.lookup.selectTypeFirst')}
            />
            <div /><div />
          </div>
        )}
        <div className="grid gap-x-6 px-4 py-4" style={{ gridTemplateColumns: "1fr 1fr 200px 160px" }}>
          {/* Col 1: Invoice address */}
          <AddressPickerField
            label={t('document.fields.billingAddress')}
            tabIndex={1}
            value={header.customerId ?? null}
            addressData={header.billingAddress ?? null}
            onChange={(id, json, raw) => {
              const update: Partial<DocHeader> = {
                customerId: id,
                billingAddress: json,
              };
              // Auto-fill currency and payment term from address if present
              if (raw?.currencyId && !header.currencyId) update.currencyId = raw.currencyId;
              if (raw?.paymentTermId && !header.paymentTermId) update.paymentTermId = raw.paymentTermId;
              // Auto-fill delivery address from address default
              if (raw?.defaultDeliveryAddressId && !header.deliveryAddressId) {
                update.deliveryAddressId = raw.defaultDeliveryAddressId;
              }
              patchHeader(update);
            }}
          />

          {/* Col 2: Delivery address */}
          <AddressPickerField
            label={t('document.fields.deliveryAddress')}
            tabIndex={2}
            value={header.deliveryAddressId ?? null}
            addressData={header.deliveryAddress ?? null}
            onChange={(id, json) => patchHeader({ deliveryAddressId: id, deliveryAddress: json })}
          />

          {/* Col 3: Logistics */}
          <div className="flex flex-col gap-3">
            <DocLookupField
              label={t('document.fields.warehouse')}
              tabIndex={3}
              value={header.warehouseId ?? null}
              onChange={(id) => patchHeader({ warehouseId: id })}
              items={warehouseItems}
              placeholder="—"
            />
            <DocLookupField
              label={t('document.fields.paymentTerm')}
              tabIndex={5}
              value={header.paymentTermId ?? null}
              onChange={(id) => patchHeader({ paymentTermId: id })}
              items={paymentTermItems}
              placeholder="—"
            />
            <DocLookupField
              label={t('document.fields.shippingMethod')}
              tabIndex={6}
              value={header.shippingMethodId ?? null}
              onChange={(id) => patchHeader({ shippingMethodId: id })}
              items={shippingItems}
              placeholder="—"
            />
          </div>

          {/* Col 4: Date + currency */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium uppercase tracking-wider text-ink-mute">{t('document.fields.date')}</label>
              <input
                tabIndex={4}
                type="date"
                className={cn(inputBase, "h-8")}
                value={header.documentDate ?? ""}
                onChange={(e) => patchHeader({ documentDate: e.target.value })}
              />
            </div>
            <div onKeyDown={(e) => {
              if (e.key === "Tab" && !e.shiftKey) {
                e.preventDefault();
                linesEditorRef.current?.focusFirstLine();
              }
            }}>
              <DocLookupField
                label={t('document.fields.currency')}
                tabIndex={7}
                value={header.currencyId ?? null}
                onChange={(id) => patchHeader({ currencyId: id })}
                items={currencyItems}
                placeholder="EUR"
              />
            </div>
          </div>
        </div>

        {/* Technical info expander */}
        {!isNew && (
          <div className="border-t border-hairline px-4 py-1.5">
            <button
              className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-ink-mute hover:text-ink transition-colors"
              onClick={() => setShowTechnical((v) => !v)}
            >
              {showTechnical ? <ChevronDownIcon className="size-3" /> : <ChevronRightIcon className="size-3" />}
              {t('document.technicalFields')}
            </button>
            {showTechnical && (
              <div className="mt-2 mb-1 grid grid-cols-4 gap-3 rounded bg-canvas-soft p-3">
                {["documentId", "documentType", "documentGroupId", "documentDirection", "status", "versionNo", "createdAt", "updatedAt"].map((f) => (
                  <div key={f} className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-ink-mute">{f}</span>
                    <span className="font-mono text-[11px] text-ink truncate">{String((header as any)[f] ?? "—")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lines */}
      <div className="flex-1 min-h-0">
        <DocumentLinesEditor
          ref={linesEditorRef}
          documentId={isNew ? null : documentId}
          customerId={header.customerId ?? null}
          documentDate={header.documentDate ?? null}
          status={docStatus}
          onLinesChange={setPendingLines}
        />
      </div>

      {/* Footer */}
      <div className="h-11 shrink-0 border-t border-hairline flex items-center px-4 gap-2 bg-canvas">
        <button
          onClick={onClose}
          className="h-7 px-4 rounded-full text-[13px] border border-hairline text-ink-secondary hover:text-ink hover:border-hairline-input transition-colors"
        >
          {t('document.actions.close')}
        </button>
        <div className="flex-1" />

        {canConvert && (
          <button
            onClick={() => convertMutation.mutate()}
            disabled={convertMutation.isPending}
            className="h-7 px-4 rounded-full text-[13px] border border-hairline text-ink-secondary hover:text-ink hover:border-hairline-input transition-colors disabled:opacity-40"
          >
            {convertMutation.isPending ? t('document.actions.converting') : t('document.actions.convert')}
          </button>
        )}
        {canStorno && (
          <button
            onClick={() => stornoMutation.mutate()}
            disabled={stornoMutation.isPending}
            className="h-7 px-4 rounded-full text-[13px] border border-hairline text-ink-secondary hover:text-ink hover:border-hairline-input transition-colors disabled:opacity-40"
          >
            {stornoMutation.isPending ? t('document.actions.cancelling') : t('document.actions.storno')}
          </button>
        )}
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="h-7 px-4 rounded-full text-[13px] border border-hairline text-ink-secondary hover:text-ink hover:border-hairline-input transition-colors disabled:opacity-40"
        >
          {saveMutation.isPending ? t('document.actions.saving') : t('document.actions.save')}
        </button>
        {canPost && (
          <button
            onClick={() => postMutation.mutate()}
            disabled={postMutation.isPending}
            className="h-7 px-4 rounded-full text-[13px] disabled:opacity-40"
            style={{ background: "var(--primary)", color: "var(--primary-fg)" }}
          >
            {postMutation.isPending ? t('document.actions.posting') : t('document.actions.post')}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const DIRECTION_FROM_TYPE: Record<string, string> = {
  N: "OUTBOUND", A: "OUTBOUND", L: "OUTBOUND", R: "OUTBOUND", G: "OUTBOUND",
  b: "INBOUND", l: "INBOUND", r: "INBOUND", g: "INBOUND",
  V: "ADJUSTMENT", Z: "ADJUSTMENT", E: "ADJUSTMENT", U: "ADJUSTMENT",
  q: "PRODUCTION", p: "PRODUCTION",
};

function deriveDirection(type: string): string {
  return DIRECTION_FROM_TYPE[type] ?? "OUTBOUND";
}
