import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CornerDownRightIcon,
  PlusIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
} from "lucide-react";
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { formatDate, formatMoney, StatusDot } from "../lib/formatters";
import { cn } from "../lib/utils";
import { useCommands } from "../platform/command-registry";
import { useFocus } from "../platform/focus-manager";
import { AddressPickerField } from "./address-picker-field";
import type { AddressSnapshot } from "./address-picker-field";
import { DeliveryAddressPickerField } from "./delivery-address-picker-field";
import { Dialog, DialogContent } from "./dialog";
import {
  DocumentTargetGroupDialog,
  type DocumentTargetGroupCandidate,
} from "./document-target-group-dialog";
import { LookupField, createStaticLookupSource, type LookupSource } from "./lookup-field";
import { TrackingEditor } from "./tracking-editor";

export interface DocumentEditorProps {
  documentId: string;
  documentGroupId?: string;
  companyId?: string;
  onClose: () => void;
  onCreateNewDocument: (groupId?: string) => void;
  onSaved?: (savedId: string) => void;
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
  customAttributes?: Record<string, unknown> | null;
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
  articleNo?: string | null;
  articleTextSnapshot: string | null;
  lineType?: string | null;
  bomGroupId?: string | null;
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
  bomType?: string | null;
  trackingMode?: string | null;
}

interface TaxCodeRow {
  taxCodeId: string;
  taxRate: string;
}

interface ArticleMetaRow {
  articleId: string;
  articleNo: string;
  name: string;
  bomType?: string | null;
  trackingMode?: string | null;
}

interface TrackingFocusRequest {
  lineId: string;
  token: string;
}

interface BomComponentRow {
  bomId: string;
  componentArticleId: string;
  articleNo: string;
  name: string;
  quantity: string;
  scrapPercentage: string;
  sortOrder: number;
  unit: string | null;
}

interface ConvertCandidate {
  documentGroupId: string;
  name: string;
  documentType: string;
  groupNumber: number;
}

interface DuplicateDialogState {
  open: boolean;
  recordId: string | null;
  candidates: DocumentTargetGroupCandidate[];
  selectedGroupId: string | null;
  isPending: boolean;
}

interface DocumentAuditNode {
  documentId: string;
  documentNo: string;
  documentType: string;
  documentDirection: string;
  status: string;
  documentGroupId: string | null;
  transactionId: string;
  parentDocumentId: string | null;
  stornoDocumentId: string | null;
  documentDate: string;
  postedAt: string | null;
  cancelledAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
  isCurrent: boolean;
  isOrigin: boolean;
  isDerived: boolean;
  isStornoSource: boolean;
  isStornoTarget: boolean;
  isArchived: boolean;
  relationTags: string[];
}

interface DocumentAuditLink {
  fromDocumentId: string;
  toDocumentId: string;
  relationType: "conversion" | "storno";
}

interface ProductionFactTraceRow {
  documentLineId: string;
  sourceDocumentLineId: string;
  lineNo: number;
  lineType: string;
  articleId: string | null;
  articleTextSnapshot: string | null;
  warehouseId: string | null;
  side: "output" | "input";
  expectedQty: string;
  movementQty: string;
  varianceQty: string;
  inventoryMovementId: string | null;
  referenceText: string | null;
}

interface DocumentAuditTrail {
  currentDocumentId: string;
  transactionId: string;
  nodes: DocumentAuditNode[];
  links: DocumentAuditLink[];
  productionFacts: ProductionFactTraceRow[];
}

// Stable empty arrays — inline `= []` in useQuery creates a new ref every render,
// which makes useMemo deps change every render and causes an infinite setState loop.
const EMPTY_TAX_CODES: TaxCodeRow[] = [];
const EMPTY_DOC_LINES: any[] = [];
const BOM_SALES_DOC_TYPES = new Set(["N", "A", "L", "R", "G"]);
const BOM_PRODUCTION_DOC_TYPES = new Set(["q", "p"]);

// ─── small helpers ────────────────────────────────────────────────────────────

const inputBase =
  "h-7 w-full border bg-canvas rounded px-2 text-[13px] text-ink outline-none transition-colors border-hairline-input focus-visible:ring-[2px] focus-visible:ring-[color-mix(in_oklab,var(--primary)_20%,transparent)] focus-visible:border-primary disabled:opacity-40";

const MOVEMENT_DOCUMENT_TYPES = new Set(["V", "Z", "E", "U", "q", "p"]);

interface AddressLockState {
  billingAddress?: boolean;
  deliveryAddress?: boolean;
}

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
    articleNo: null,
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

function isBlankDraftLine(line: LineRow): boolean {
  return (
    !!line.isNew &&
    !line.articleId &&
    !line.articleTextSnapshot &&
    (line.lineType == null || line.lineType === "article") &&
    Number(line.quantity ?? 1) === 1 &&
    Number(line.netPrice ?? 0) === 0 &&
    (line.discountPercentage == null || Number(line.discountPercentage) === 0) &&
    !line.taxCodeId &&
    !line.unit
  );
}

function normalizeLineForSave(line: LineRow) {
  return {
    lineNo: line.lineNo,
    articleId: line.articleId,
    articleNo: line.articleNo,
    articleTextSnapshot: line.articleTextSnapshot,
    lineType: line.lineType ?? "article",
    quantity: String(line.quantity),
    unit: line.unit,
    netPrice: String(line.netPrice),
    discountPercentage: line.discountPercentage != null ? String(line.discountPercentage) : null,
    taxCodeId: line.taxCodeId,
  };
}

function serializeLines(lines: LineRow[]) {
  return JSON.stringify(
    lines.filter((line) => !line.isDeleted && !isBlankDraftLine(line)).map(normalizeLineForSave),
  );
}

function getPersistableLines(lines: LineRow[]) {
  return lines.filter((line) => !line.isDeleted && !isBlankDraftLine(line));
}

function normalizeHeaderForSave(header: DocHeader, hidePartyFields: boolean) {
  return {
    documentGroupId: header.documentGroupId ?? null,
    documentType: header.documentType ?? null,
    documentDate: header.documentDate ?? null,
    customerId: hidePartyFields ? null : (header.customerId ?? null),
    billingAddress: hidePartyFields ? null : (header.billingAddress ?? null),
    deliveryAddress: hidePartyFields ? null : (header.deliveryAddress ?? null),
    deliveryAddressId: hidePartyFields ? null : (header.deliveryAddressId ?? null),
    customAttributes: header.customAttributes ?? null,
    currencyId: header.currencyId ?? null,
    warehouseId: header.warehouseId ?? null,
    paymentTermId: header.paymentTermId ?? null,
    shippingMethodId: header.shippingMethodId ?? null,
  };
}

function getAddressLocks(customAttributes: DocHeader["customAttributes"]): AddressLockState {
  const addressLocks = (customAttributes as { addressLocks?: AddressLockState } | null | undefined)
    ?.addressLocks;
  return addressLocks ?? {};
}

function setAddressLock(
  customAttributes: DocHeader["customAttributes"],
  field: keyof AddressLockState,
  locked: boolean,
): Record<string, unknown> {
  const next = {
    ...(customAttributes ?? {}),
    addressLocks: {
      ...getAddressLocks(customAttributes),
      [field]: locked,
    },
  };

  return next;
}

function normalizeCurrencyId(
  value: string | null | undefined,
  currencies: Array<{ currencyId?: string; code?: string }>,
) {
  if (!value) return null;
  const matched = currencies.find((c) => c.code === value || c.currencyId === value);
  return matched?.code ?? value;
}

function resolveArticleLabel(line: LineRow, articleMeta?: ArticleMetaRow | null) {
  return (
    line.articleNo ??
    articleMeta?.articleNo ??
    line.articleTextSnapshot ??
    line.articleId?.slice(0, 8) ??
    "—"
  );
}

function isBomHeaderLineType(lineType?: string | null) {
  return lineType === "sales_bom_header" || lineType === "production_output";
}

function shouldExpandBom(
  articleMeta: ArticleMetaRow | null | undefined,
  documentType?: string | null,
) {
  if (!articleMeta?.articleId || !documentType) return false;
  if (articleMeta.bomType === "sales") return BOM_SALES_DOC_TYPES.has(documentType);
  if (articleMeta.bomType === "production") return BOM_PRODUCTION_DOC_TYPES.has(documentType);
  return false;
}

function resolveBomHeaderLineType(
  articleMeta: ArticleMetaRow | null | undefined,
  documentType?: string | null,
) {
  if (!articleMeta || !documentType) return "article";
  if (articleMeta.bomType === "sales" && BOM_SALES_DOC_TYPES.has(documentType))
    return "sales_bom_header";
  if (articleMeta.bomType === "production" && BOM_PRODUCTION_DOC_TYPES.has(documentType))
    return "production_output";
  return "article";
}

function resolveTrackingMode(articleMeta?: ArticleMetaRow | null): "serial" | "batch" | null {
  const trackingMode = articleMeta?.trackingMode ?? null;
  if (trackingMode === "serial" || trackingMode === "batch") return trackingMode;
  return null;
}

function lineFromPersistedRow(row: any): LineRow {
  return {
    _id: row.documentLineId ?? row._id ?? `saved-${row.lineNo ?? Date.now()}`,
    documentLineId: row.documentLineId ?? null,
    lineNo: Number(row.lineNo ?? 0),
    articleId: row.articleId ?? null,
    articleNo: row.articleNo ?? null,
    articleTextSnapshot: row.articleTextSnapshot ?? null,
    lineType: row.lineType ?? "article",
    bomGroupId: row.bomGroupId ?? null,
    quantity: Number(row.quantity ?? 1),
    unit: row.unit ?? null,
    netPrice: Number(row.netPrice ?? 0),
    discountPercentage: row.discountPercentage != null ? Number(row.discountPercentage) : null,
    taxCodeId: row.taxCodeId ?? null,
    taxRate: row.taxRate ?? null,
    isNew: false,
    isDeleted: false,
  };
}

// ─── DocLookupField ───────────────────────────────────────────────────────────

function DocLookupField({
  label,
  focusField,
  value,
  onChange,
  items,
  placeholder = "—",
  tabIndex,
  onTabForward,
}: {
  label: string;
  focusField: string;
  value: string | null;
  onChange: (id: string | null) => void;
  items: Array<{ id: string; label: string }>;
  placeholder?: string;
  tabIndex?: number;
  onTabForward?: () => void;
}) {
  const { setFocus } = useFocus();
  const source = useMemo(
    () =>
      createStaticLookupSource(
        items.map((item) => ({ value: item.id, label: item.label, raw: item })),
        {
          title: label,
          valueColumn: "value",
          labelColumns: ["label"],
          placeholder,
          emptyLabel: "No results",
        },
      ),
    [items, label, placeholder],
  );

  return (
    <LookupField
      value={value}
      source={source}
      tabIndex={tabIndex}
      placeholder={placeholder}
      onTabForward={onTabForward}
      onFocusChange={(focused) => {
        if (focused) {
          setFocus({ area: "lookup", field: focusField, row: null });
        }
      }}
      onChange={(next) => onChange(next)}
    />
  );
}

// ─── ArticleSearchCell ────────────────────────────────────────────────────────

function ArticleSearchCell({
  value,
  textSnapshot,
  onSelect,
  inputRef,
  rowIndex,
  onFocus,
}: {
  value: string | null;
  textSnapshot: string | null;
  onSelect: (article: ArticleResult, rowIndex: number) => void;
  inputRef?: React.Ref<HTMLInputElement>;
  rowIndex: number;
  onFocus?: () => void;
}) {
  const { setFocus } = useFocus();
  const source = useMemo<LookupSource<ArticleResult>>(
    () => ({
      title: "Articles",
      placeholder: "Search articles",
      emptyLabel: "No articles found",
      search: async (query, options) => {
        const params = new URLSearchParams({ q: query, limit: String(options?.limit ?? 20) });
        const res = await fetch(`/api/articles/search?${params.toString()}`);
        if (!res.ok) return [];
        const rows = (await res.json()) as ArticleResult[];
        return rows.map((row) => ({
          value: row.articleId,
          label: `${row.articleNo} — ${row.name}`,
          description: row.baseUnit ?? undefined,
          raw: row,
        }));
      },
      resolve: async (articleId) => {
        if (!articleId || !textSnapshot) return null;
        return {
          value: articleId,
          label: textSnapshot,
          raw: {
            articleId,
            articleNo: textSnapshot,
            name: textSnapshot,
            baseUnit: null,
            taxClassId: null,
            bomType: null,
            trackingMode: null,
          },
        };
      },
    }),
    [textSnapshot],
  );

  return (
    <LookupField
      value={value}
      source={source}
      tabIndex={undefined}
      placeholder="Search articles"
      ref={inputRef}
      className="min-w-0"
      onFocusChange={(focused) => {
        if (!focused) return;
        setFocus({
          workspace: "documents",
          panel: "document-editor",
          entity: "document",
          area: "grid",
          field: "articleId",
          row: rowIndex,
        });
        onFocus?.();
      }}
      onChange={(next, item) => {
        if (item?.raw) {
          onSelect(item.raw as ArticleResult, rowIndex);
          return;
        }
        if (!next) return;
        const articleNo = item?.label?.split(" — ")[0] ?? next;
        onSelect(
          {
            articleId: next,
            articleNo,
            name: item?.label ?? next,
            baseUnit: null,
            taxClassId: null,
            bomType: null,
            trackingMode: null,
          },
          rowIndex,
        );
      }}
    />
  );
}

// ─── DocumentLinesEditor ──────────────────────────────────────────────────────

interface DocumentLinesEditorHandle {
  focusFirstLine: () => void;
  addLine: () => void;
  commitCurrentEdit: () => Promise<LineRow | null>;
  deleteCurrentLine: () => void;
  duplicateCurrentLine: () => void;
  getLines: () => LineRow[];
  getDraftLines: () => LineRow[];
  isDirty: () => boolean;
  getPersistableLines: () => LineRow[];
}

const DocumentLinesEditor = forwardRef<
  DocumentLinesEditorHandle,
  {
    documentId: string | null;
    documentType?: string | null;
    warehouseId?: string | null;
    customerId: string | null;
    documentDate: string | null;
    status?: string;
    onLinesChange?: (lines: LineRow[]) => void;
    onDirtyChange?: (dirty: boolean) => void;
  }
>(function DocumentLinesEditor(
  {
    documentId,
    documentType,
    warehouseId,
    customerId,
    documentDate,
    status,
    onLinesChange,
    onDirtyChange,
  },
  ref,
) {
  const { t } = useTranslation("ui");
  const { setFocus } = useFocus();
  const isPosted = status === "posted";
  const queryClient = useQueryClient();
  const [lines, setLines] = useState<LineRow[]>([]);
  const linesRef = useRef<LineRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVals, setEditVals] = useState<Partial<LineRow>>({});
  const [editingArticleMeta, setEditingArticleMeta] = useState<ArticleMetaRow | null>(null);
  const [korrLineId, setKorrLineId] = useState<string | null>(null);
  const [korrDelta, setKorrDelta] = useState<string>("");
  const [baselineSnapshot, setBaselineSnapshot] = useState<string | null>(null);
  const bomCacheRef = useRef<Record<string, BomComponentRow[]>>({});
  const [trackingFocus, setTrackingFocus] = useState<TrackingFocusRequest | null>(null);

  const effectiveLines = useMemo(() => {
    if (!editingId) return lines;
    return lines.map((line) => (line._id === editingId ? { ...line, ...editVals } : line));
  }, [editVals, editingId, lines]);

  const currentSnapshot = useMemo(() => serializeLines(effectiveLines), [effectiveLines]);
  const isDirty = baselineSnapshot != null && currentSnapshot !== baselineSnapshot;

  const replaceLines = useCallback((next: LineRow[]) => {
    linesRef.current = next;
    setLines(next);
  }, []);

  useEffect(() => {
    setBaselineSnapshot(null);
    onDirtyChange?.(false);
    setEditingArticleMeta(null);
    setTrackingFocus(null);
  }, [documentId, onDirtyChange]);

  const pushGridFocus = useCallback(
    (field: string | null, row: number | null) => {
      setFocus({
        workspace: "documents",
        panel: "document-editor",
        entity: "document",
        recordId: documentId,
        area: "grid",
        field,
        row,
        mode: isPosted ? "view" : "edit",
      });
    },
    [documentId, isPosted, setFocus],
  );

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
      toast.success(t("document.lines.korrekturPosted"));
    },
    onError: (err: any) => toast.error(err.message ?? t("document.lines.korrekturError")),
  });

  const articleInputRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const discRef = useRef<HTMLInputElement>(null);
  const korrInputRef = useRef<HTMLInputElement>(null);

  const { data: existingLines = EMPTY_DOC_LINES, isLoading } = useQuery({
    queryKey: ["data", "documentLine", documentId],
    queryFn: async () => {
      if (!documentId) return EMPTY_DOC_LINES;
      const res = await fetch(`/api/data/documentLine?documentId=${documentId}&orderBy=lineNo:asc`);
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

  const articleIds = useMemo(
    () =>
      Array.from(
        new Set(
          lines
            .map((line) => line.articleId)
            .filter((articleId): articleId is string => !!articleId),
        ),
      ),
    [lines],
  );
  const articleQueries = useQueries({
    queries: articleIds.map((articleId) => ({
      queryKey: ["data", "article", articleId],
      queryFn: async () => {
        const res = await fetch(`/api/data/article/${articleId}`);
        if (!res.ok) return null;
        return res.json() as Promise<ArticleMetaRow>;
      },
      enabled: !!articleId,
      staleTime: 5 * 60 * 1000,
    })),
  });
  const articleQueryRows = articleQueries.map((query) => query.data);
  const articleMetaById = useMemo(() => {
    const map = new Map<string, ArticleMetaRow>();
    for (let i = 0; i < articleIds.length; i++) {
      const row = articleQueryRows[i] ?? null;
      if (row?.articleId) map.set(articleIds[i], row);
    }
    return map;
  }, [articleIds, articleQueryRows]);

  function assignBomGroups(inputLines: LineRow[]) {
    const grouped: LineRow[] = [];
    let currentGroupId: string | null = null;
    let currentHeaderId: string | null = null;

    for (const line of inputLines) {
      if (isBomHeaderLineType(line.lineType)) {
        currentGroupId = line.bomGroupId ?? line.documentLineId ?? line._id;
        currentHeaderId = line._id;
        grouped.push({ ...line, bomGroupId: currentGroupId });
        continue;
      }

      if (line.lineType === "bom_component" && currentGroupId && currentHeaderId) {
        grouped.push({ ...line, bomGroupId: currentGroupId });
        continue;
      }

      currentGroupId = null;
      currentHeaderId = null;
      grouped.push({ ...line, bomGroupId: line.bomGroupId ?? null });
    }

    return grouped;
  }

  function mergePersistedDocumentLines(source: LineRow[], persisted: any[]) {
    const next = [...source];
    for (const row of persisted.map(lineFromPersistedRow)) {
      const matchIndex = next.findIndex((line) => {
        if (line.documentLineId && row.documentLineId && line.documentLineId === row.documentLineId)
          return true;
        return (
          line.lineNo === row.lineNo &&
          line.lineType === row.lineType &&
          line.articleId === row.articleId
        );
      });

      if (matchIndex >= 0) {
        const current = next[matchIndex];
        next[matchIndex] = {
          ...current,
          ...row,
          bomGroupId: current.bomGroupId ?? row.bomGroupId ?? null,
          isNew: false,
          isDeleted: false,
        };
        continue;
      }

      const insertAt = next.findIndex((line) => line.lineNo > row.lineNo);
      next.splice(insertAt >= 0 ? insertAt : next.length, 0, row);
    }

    return assignBomGroups(next);
  }

  useEffect(() => {
    const mapped: LineRow[] = assignBomGroups(
      ((existingLines as any[]) ?? []).map((l: any) => ({
        _id: l.documentLineId,
        documentLineId: l.documentLineId,
        lineNo: l.lineNo,
        articleId: l.articleId ?? null,
        articleNo: l.articleNo ?? null,
        articleTextSnapshot: l.articleTextSnapshot ?? null,
        lineType: l.lineType ?? "article",
        quantity: Number(l.quantity ?? 1),
        unit: l.unit ?? null,
        netPrice: Number(l.netPrice ?? 0),
        discountPercentage: l.discountPercentage != null ? Number(l.discountPercentage) : null,
        taxCodeId: l.taxCodeId ?? null,
        taxRate: l.taxCodeId ? (taxRateMap[l.taxCodeId] ?? null) : null,
      })),
    );
    // Hydrate the editable line draft from async query data.
    // eslint-disable-next-line react-hooks-js/set-state-in-effect
    replaceLines(mapped);
    if (baselineSnapshot == null && !isLoading) {
      setBaselineSnapshot(serializeLines(mapped));
      onDirtyChange?.(false);
    }
  }, [baselineSnapshot, existingLines, isLoading, taxRateMap, replaceLines, onDirtyChange]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [currentSnapshot, isDirty, onDirtyChange]);

  // Auto-add first empty line
  const addLine = useCallback(() => {
    const current = linesRef.current;
    const newLine = emptyLine(documentId ?? "", nextLineNo(current));
    replaceLines([...current, newLine]);
    setEditingId(newLine._id);
    setEditVals({ ...newLine });
    pushGridFocus("articleId", current.length);
  }, [documentId, pushGridFocus, replaceLines]);

  useEffect(() => {
    if (
      !isLoading &&
      documentId &&
      (existingLines as any[]).length === 0 &&
      linesRef.current.length === 0 &&
      editingId === null
    ) {
      addLine();
    }
  }, [addLine, editingId, existingLines, documentId, isLoading]);

  // Sync to parent for save
  useEffect(() => {
    onLinesChange?.(effectiveLines.filter((l) => !l.isDeleted));
  }, [effectiveLines, onLinesChange]);

  // Focus article input on new edit
  useEffect(() => {
    if (editingId) {
      setTimeout(() => {
        articleInputRef.current?.focus();
        articleInputRef.current?.select();
      }, 30);
    }
  }, [editingId]);

  useEffect(() => {
    if (!editingId) return;
    const draft = getEditableLineDraft();
    if (!draft?.articleId) return;
    const draftArticleId = draft.articleId;
    if (!draftArticleId) return;
    const articleMeta = editingArticleMeta ?? articleMetaById.get(draftArticleId) ?? null;
    if (!shouldExpandBom(articleMeta, documentType)) return;

    let cancelled = false;
    void (async () => {
      const next = await syncBomExplosion(
        draft,
        editingArticleMeta ?? articleMetaById.get(draftArticleId) ?? null,
      );
      if (cancelled) return;
      replaceLines(assignBomGroups(next));
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    articleMetaById,
    documentType,
    editVals.articleId,
    editVals.quantity,
    editingArticleMeta,
    editingId,
  ]);

  useEffect(() => {
    if (korrLineId) {
      setTimeout(() => {
        korrInputRef.current?.focus();
        korrInputRef.current?.select();
      }, 30);
    }
  }, [korrLineId]);

  useImperativeHandle(ref, () => ({
    focusFirstLine: () => {
      const firstVisible = lines.find((l) => !l.isDeleted && l.lineType !== "bom_component");
      if (firstVisible) {
        startEdit(
          firstVisible,
          lines.findIndex((l) => l._id === firstVisible._id),
        );
      } else {
        addLine();
      }
      setTimeout(() => articleInputRef.current?.focus(), 50);
    },
    addLine: () => {
      addLine();
    },
    commitCurrentEdit: () => {
      return commitEdit();
    },
    deleteCurrentLine: () => {
      if (editingId) deleteLine(editingId);
    },
    duplicateCurrentLine: () => {
      duplicateLine();
    },
    getLines: () => linesRef.current,
    getDraftLines: () => linesRef.current.filter((line) => !isBlankDraftLine(line)),
    isDirty: () => isDirty,
    getPersistableLines: () => getPersistableLines(effectiveLines),
  }));

  function startEdit(line: LineRow, rowIndex?: number) {
    if (line.lineType === "bom_component") return;
    setEditingId(line._id);
    setEditVals({ ...line });
    setEditingArticleMeta(line.articleId ? (articleMetaById.get(line.articleId) ?? null) : null);
    pushGridFocus("articleId", rowIndex ?? linesRef.current.findIndex((l) => l._id === line._id));
  }

  function getEditableLineDraft() {
    if (!editingId) return null;
    const current = linesRef.current.find((line) => line._id === editingId);
    if (!current) return null;
    return {
      ...current,
      ...editVals,
      articleNo: editVals.articleNo ?? current.articleNo ?? null,
      taxRate: editVals.taxCodeId ? (taxRateMap[editVals.taxCodeId as string] ?? null) : null,
    } as LineRow;
  }

  async function fetchBomComponents(articleId: string) {
    const cached = bomCacheRef.current[articleId];
    if (cached) return cached;

    const res = await fetch(`/api/articles/${articleId}/bom`);
    if (!res.ok) {
      return [] as BomComponentRow[];
    }

    const data = (await res.json()) as { components?: BomComponentRow[] };
    const components = data.components ?? [];
    bomCacheRef.current[articleId] = components;
    return components;
  }

  function buildBomComponentRows(
    header: LineRow,
    components: BomComponentRow[],
    groupId: string,
    existingChildren: LineRow[] = [],
  ): LineRow[] {
    const baseQty = Number(header.quantity ?? 0);
    return components.map((component, index) => {
      const existing = existingChildren[index];
      const componentQty = Number(component.quantity ?? 0);
      const scrapFactor = 1 + Number(component.scrapPercentage ?? 0) / 100;
      return {
        _id: existing?._id ?? `new-${Date.now()}-${Math.random()}-${index}`,
        documentLineId: existing?.documentLineId,
        lineNo: header.lineNo + index + 1,
        articleId: component.componentArticleId,
        articleNo: component.articleNo,
        articleTextSnapshot: component.name,
        lineType: "bom_component",
        bomGroupId: groupId,
        quantity: Number((baseQty * componentQty * scrapFactor).toFixed(6)),
        unit: component.unit,
        netPrice: 0,
        discountPercentage: null,
        taxCodeId: null,
        taxRate: null,
        isNew: existing ? existing.isNew : !header.documentLineId,
        isDeleted: false,
      } satisfies LineRow;
    });
  }

  function replaceGroupChildren(
    next: LineRow[],
    headerIndex: number,
    headerLine: LineRow,
    children: LineRow[],
  ) {
    const currentGroupId = headerLine.bomGroupId ?? headerLine.documentLineId ?? headerLine._id;
    let oldCount = 0;
    for (let i = headerIndex + 1; i < next.length; i++) {
      const line = next[i];
      if (line.lineType !== "bom_component") break;
      if (line.bomGroupId && line.bomGroupId !== currentGroupId) break;
      oldCount += 1;
    }

    next.splice(headerIndex + 1, oldCount, ...children);

    const delta = children.length - oldCount;
    if (delta !== 0) {
      for (let i = headerIndex + 1 + children.length; i < next.length; i++) {
        next[i] = {
          ...next[i],
          lineNo: next[i].lineNo + delta,
        };
      }
    }
  }

  async function syncBomExplosion(
    nextHeader: LineRow,
    articleMetaOverride?: ArticleMetaRow | null,
  ) {
    const articleMeta =
      articleMetaOverride ??
      (nextHeader.articleId ? (articleMetaById.get(nextHeader.articleId) ?? null) : null);
    const shouldExplode = shouldExpandBom(articleMeta, documentType);
    const next = [...linesRef.current];
    const headerIndex = next.findIndex((line) => line._id === nextHeader._id);
    if (headerIndex < 0) return next;
    const currentGroupId = nextHeader.bomGroupId ?? nextHeader.documentLineId ?? nextHeader._id;
    const existingChildren: LineRow[] = [];
    for (let i = headerIndex + 1; i < next.length; i++) {
      const line = next[i];
      if (line.lineType !== "bom_component") break;
      if (line.bomGroupId && line.bomGroupId !== currentGroupId) break;
      existingChildren.push(line);
    }

    if (!shouldExplode) {
      const normalizedHeader = { ...nextHeader, lineType: "article", bomGroupId: null };
      next[headerIndex] = normalizedHeader;
      for (let i = headerIndex + 1; i < next.length; i++) {
        const line = next[i];
        if (line.lineType !== "bom_component") break;
        if (line.bomGroupId && line.bomGroupId !== currentGroupId) break;
        next[i] = { ...line, isDeleted: true };
      }
      return next;
    }

    const groupId = currentGroupId;
    const components = await fetchBomComponents(nextHeader.articleId!);
    const children = buildBomComponentRows(
      {
        ...nextHeader,
        lineType: resolveBomHeaderLineType(articleMeta, documentType),
        bomGroupId: groupId,
      },
      components,
      groupId,
      existingChildren,
    );
    const normalizedHeader = {
      ...nextHeader,
      lineType: resolveBomHeaderLineType(articleMeta, documentType),
      bomGroupId: groupId,
    };

    next[headerIndex] = normalizedHeader;
    replaceGroupChildren(next, headerIndex, normalizedHeader, children);
    return next;
  }

  async function commitEdit(): Promise<LineRow | null> {
    if (!editingId) return null;

    const nextHeader = getEditableLineDraft();
    if (!nextHeader) {
      setEditingId(null);
      setEditVals({});
      setEditingArticleMeta(null);
      return null;
    }

    const next = linesRef.current.map((line) =>
      line._id === editingId
        ? {
            ...line,
            ...nextHeader,
            bomGroupId: line.bomGroupId ?? nextHeader.bomGroupId ?? null,
          }
        : line,
    );

    replaceLines(next);
    setEditingId(null);
    setEditVals({});

    const normalizedHeader = next.find((line) => line._id === nextHeader._id) ?? null;
    if (!normalizedHeader) return null;
    const articleMeta =
      editingArticleMeta ??
      (normalizedHeader.articleId
        ? (articleMetaById.get(normalizedHeader.articleId) ?? null)
        : null);
    setEditingArticleMeta(null);
    const resolvedNext = await syncBomExplosion(normalizedHeader, articleMeta);
    replaceLines(assignBomGroups(resolvedNext));
    return normalizedHeader;
  }

  async function persistLineForTracking(line: LineRow): Promise<LineRow | null> {
    if (!documentId || line.documentLineId) return line;

    const res = await fetch("/api/data/documentLine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId,
        ...normalizeLineForSave(line),
      }),
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }

    const persisted = (await res.json()) as unknown[];
    const merged = mergePersistedDocumentLines(linesRef.current, persisted);
    replaceLines(merged);

    return (
      merged.find(
        (row) =>
          row.documentLineId != null &&
          row.lineNo === line.lineNo &&
          row.lineType === line.lineType &&
          row.articleId === line.articleId,
      ) ?? null
    );
  }

  function advanceToNextLine(currentLineId: string, currentRowIndex: number) {
    const activeLines = linesRef.current.filter((l) => !l.isDeleted);
    const currentIdx = activeLines.findIndex((l) => l._id === currentLineId);
    const rowIndex = currentIdx >= 0 ? currentIdx : currentRowIndex;
    if (rowIndex >= 0) {
      let nextIdx = rowIndex + 1;
      while (nextIdx < activeLines.length && activeLines[nextIdx].lineType === "bom_component") {
        nextIdx += 1;
      }
      if (nextIdx < activeLines.length) {
        const next = activeLines[nextIdx];
        setTimeout(() => startEdit(next, nextIdx), 30);
        return;
      }
    }
    setTimeout(() => addLine(), 30);
  }

  const clearTrackingFocus = useCallback(() => {
    setTrackingFocus(null);
  }, [setTrackingFocus]);

  function cancelEdit() {
    // remove if new and unchanged
    const current = linesRef.current.find((l) => l._id === editingId);
    if (current?.isNew && !current.articleId) {
      replaceLines(linesRef.current.filter((l) => l._id !== editingId));
    }
    setEditingId(null);
    setEditVals({});
    setEditingArticleMeta(null);
  }

  function duplicateLine() {
    if (!editingId) return;
    const currentLines = linesRef.current;
    const sourceIndex = currentLines.findIndex((l) => l._id === editingId);
    if (sourceIndex < 0) return;
    const source = currentLines[sourceIndex];
    const sourceDraft = editingId === source._id ? { ...source, ...editVals } : source;
    const copy: LineRow = {
      ...sourceDraft,
      _id: `new-${Date.now()}-${Math.random()}`,
      documentLineId: undefined,
      isNew: true,
      isDeleted: false,
      lineNo: sourceDraft.lineNo + 1,
    };
    const next = [...currentLines];
    next.splice(sourceIndex + 1, 0, copy);
    replaceLines(next);
    setEditingId(copy._id);
    setEditVals({ ...copy });
    setEditingArticleMeta(copy.articleId ? (articleMetaById.get(copy.articleId) ?? null) : null);
    pushGridFocus("articleId", sourceIndex + 1);
    setTimeout(() => articleInputRef.current?.focus(), 30);
  }

  function deleteLine(id: string) {
    const source = linesRef.current;
    const index = source.findIndex((l) => l._id === id);
    if (index < 0) return;
    const current = source[index];
    const next = [...source];
    const groupId = current.bomGroupId ?? current.documentLineId ?? current._id;
    next[index] = { ...current, isDeleted: true };

    if (isBomHeaderLineType(current.lineType)) {
      for (let i = index + 1; i < next.length; i++) {
        const line = next[i];
        if (line.lineType !== "bom_component") break;
        if (line.bomGroupId && line.bomGroupId !== groupId) break;
        next[i] = { ...line, isDeleted: true };
      }
    }

    replaceLines(next.filter((l) => !(l.isDeleted && l.isNew)));
    if (editingId === id) {
      setEditingId(null);
      setEditVals({});
      setEditingArticleMeta(null);
    }
  }

  async function handleArticleSelect(article: ArticleResult, rowIndex: number) {
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
    } catch {
      /* pricing optional */
    }

    const articleMeta = article.articleId
      ? (articleMetaById.get(article.articleId) ?? {
          articleId: article.articleId,
          articleNo: article.articleNo,
          name: article.name,
          bomType: article.bomType ?? null,
          trackingMode: article.trackingMode ?? null,
        })
      : null;
    const resolvedLineType = resolveBomHeaderLineType(articleMeta, documentType);
    setEditingArticleMeta(articleMeta);

    setEditVals((prev) => ({
      ...prev,
      articleId: article.articleId,
      articleNo: article.articleNo,
      articleTextSnapshot: article.name,
      unit: article.baseUnit ?? null,
      netPrice: price,
      taxCodeId,
      lineType: resolvedLineType,
      bomGroupId: shouldExpandBom(articleMeta, documentType)
        ? (prev.bomGroupId ?? prev.documentLineId ?? prev._id ?? null)
        : null,
    }));

    if (shouldExpandBom(articleMeta, documentType)) {
      void fetchBomComponents(article.articleId);
    }

    pushGridFocus("qty", rowIndex);

    // Advance focus to qty
    setTimeout(() => {
      qtyRef.current?.focus();
      qtyRef.current?.select();
    }, 30);
  }

  function handleLineCellKeyDown(
    e: React.KeyboardEvent,
    field: "qty" | "price" | "disc",
    currentLineTrackingMode: "serial" | "batch" | null,
    currentRowIndex: number,
  ) {
    if (e.key === "Tab") {
      e.preventDefault();
      if (field === "qty") {
        priceRef.current?.focus();
        priceRef.current?.select();
      } else if (field === "price") {
        discRef.current?.focus();
        discRef.current?.select();
      } else if (field === "disc") {
        const currentId = editingId;
        if (currentLineTrackingMode && documentId) {
          void (async () => {
            try {
              const committed = await commitEdit();
              if (!committed || committed._id !== currentId) return;
              const persisted = committed.documentLineId
                ? committed
                : await persistLineForTracking(committed);
              if (persisted?.documentLineId) {
                setTrackingFocus({
                  lineId: persisted._id,
                  token: `${persisted._id}:${Date.now()}`,
                });
              }
            } catch (err: any) {
              toast.error(err?.message ?? "Failed to save tracked line");
            }
          })();
          return;
        }

        void commitEdit().then(() => {
          advanceToNextLine(currentId ?? "", currentRowIndex);
        });
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      cancelEdit();
    } else if (e.key === "Delete" && e.ctrlKey) {
      e.preventDefault();
      deleteLine(editingId!);
    }
  }

  const visibleLines = lines.filter((l) => !l.isDeleted);
  const visibleDraftLines = effectiveLines.filter((l) => !l.isDeleted);

  const totals = useMemo(() => {
    let net = 0,
      tax = 0;
    for (const l of visibleDraftLines) {
      const n = lineNet(l.quantity, l.netPrice, l.discountPercentage);
      net += n;
      tax += lineTax(n, l.taxRate);
    }
    return { net, tax, gross: net + tax };
  }, [visibleDraftLines]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Table header */}
      <div
        className="grid shrink-0 border-b border-hairline bg-canvas-soft text-[11px] font-medium tracking-wider text-ink-mute uppercase"
        style={{ gridTemplateColumns: "48px 180px 1fr 72px 56px 96px 64px 60px 96px 32px" }}
      >
        {[
          t("document.lines.pos"),
          t("document.lines.article"),
          t("document.lines.description"),
          t("document.lines.qty"),
          t("document.lines.unit"),
          t("document.lines.price"),
          t("document.lines.discount"),
          t("document.lines.taxRate"),
          t("document.lines.net"),
          "",
        ].map((h, i) => (
          <div key={i} className="px-2 py-1.5">
            {h}
          </div>
        ))}
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex h-16 items-center justify-center text-[13px] text-ink-mute">
            {t("document.loading")}
          </div>
        ) : visibleLines.length === 0 ? (
          <div className="flex h-16 items-center justify-center text-[13px] text-ink-mute">
            {t("document.lines.empty")}
          </div>
        ) : (
          visibleLines.map((line, rowIndex) => {
            const isEditing = editingId === line._id;
            const isKorr = korrLineId === line._id;
            const isBomComponent = line.lineType === "bom_component";
            const canEditRow = !isPosted && !isBomComponent;
            const row = isEditing ? { ...line, ...editVals } : line;
            const net = lineNet(row.quantity, row.netPrice, row.discountPercentage);
            const articleMeta = isEditing
              ? (editingArticleMeta ??
                (row.articleId ? (articleMetaById.get(row.articleId) ?? null) : null))
              : line.articleId
                ? (articleMetaById.get(line.articleId) ?? null)
                : null;
            const lineTrackingMode = resolveTrackingMode(articleMeta);
            const ev = editVals;

            return (
              <div key={line._id} className="border-b border-hairline">
                {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- row is a keyboard-focusable command surface */}
                <div
                  className={cn(
                    "grid text-[13px] transition-colors",
                    canEditRow ? "cursor-pointer" : "cursor-default",
                    isBomComponent && "bg-canvas-soft/40",
                    isEditing
                      ? "bg-[color-mix(in_oklab,var(--primary)_4%,var(--canvas))]"
                      : "hover:bg-canvas-soft",
                    isKorr && "bg-[color-mix(in_oklab,var(--primary)_4%,var(--canvas))]",
                  )}
                  role={canEditRow ? "button" : undefined}
                  tabIndex={canEditRow ? 0 : undefined}
                  style={{
                    gridTemplateColumns: "48px 180px 1fr 72px 56px 96px 64px 60px 96px 32px",
                  }}
                  onClick={() => !isEditing && canEditRow && startEdit(line, rowIndex)}
                  onKeyDown={(e) => {
                    if (canEditRow && !isEditing && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      startEdit(line, rowIndex);
                    }
                  }}
                  onBlurCapture={(e) => {
                    if (!isEditing || isBomComponent) return;
                    const nextTarget = e.relatedTarget as Node | null;
                    if (nextTarget && e.currentTarget.contains(nextTarget)) return;
                    window.setTimeout(() => {
                      void commitEdit();
                    }, 0);
                  }}
                >
                  {/* Pos */}
                  <div
                    className={cn(
                      "self-center px-2 py-1.5 font-mono text-[12px] tabular-nums",
                      isBomComponent ? "text-ink-secondary" : "text-ink-mute",
                    )}
                  >
                    <span className="inline-flex items-center gap-1">
                      {isBomComponent && (
                        <CornerDownRightIcon className="size-3.5 shrink-0 text-ink-mute" />
                      )}
                      {String(line.lineNo).padStart(3, "0")}
                    </span>
                  </div>

                  {/* Article */}
                  <div className={cn("self-center px-1.5 py-1", isBomComponent && "pl-5")}>
                    {isEditing ? (
                      <ArticleSearchCell
                        value={ev.articleId ?? null}
                        textSnapshot={ev.articleTextSnapshot ?? null}
                        onSelect={handleArticleSelect}
                        inputRef={articleInputRef}
                        rowIndex={rowIndex}
                      />
                    ) : (
                      <span className="font-mono text-[12px] text-ink-mute">
                        {resolveArticleLabel(line, articleMeta)}
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <div className={cn("min-w-0 self-center px-1.5 py-1", isBomComponent && "pl-5")}>
                    {isEditing ? (
                      <input
                        tabIndex={-1}
                        className={cn(inputBase, "text-[12px]")}
                        value={(ev.articleTextSnapshot ?? "") as string}
                        placeholder={t("document.lines.description")}
                        onChange={(e) =>
                          setEditVals((v) => ({ ...v, articleTextSnapshot: e.target.value }))
                        }
                      />
                    ) : (
                      <span className="block truncate">{line.articleTextSnapshot ?? ""}</span>
                    )}
                  </div>

                  {/* Qty */}
                  <div className="self-center px-1.5 py-1">
                    {isEditing ? (
                      <input
                        ref={qtyRef}
                        className={cn(inputBase, "text-right text-[12px] tabular-nums")}
                        type="number"
                        value={(ev.quantity ?? 1) as number}
                        onChange={(e) =>
                          setEditVals((v) => ({ ...v, quantity: Number(e.target.value) }))
                        }
                        onFocus={() => pushGridFocus("qty", rowIndex)}
                        onKeyDown={(e) =>
                          handleLineCellKeyDown(e, "qty", lineTrackingMode, rowIndex)
                        }
                      />
                    ) : (
                      <span className="block text-right tabular-nums">{line.quantity}</span>
                    )}
                  </div>

                  {/* Unit */}
                  <div className="self-center px-2 py-1.5 text-[12px] text-ink-mute">
                    {isEditing ? (ev.unit ?? line.unit ?? "") : (line.unit ?? "")}
                  </div>

                  {/* Unit price */}
                  <div className="self-center px-1.5 py-1">
                    {isEditing ? (
                      <input
                        ref={priceRef}
                        className={cn(inputBase, "text-right text-[12px] tabular-nums")}
                        type="number"
                        step="0.01"
                        value={(ev.netPrice ?? 0) as number}
                        onChange={(e) =>
                          setEditVals((v) => ({ ...v, netPrice: Number(e.target.value) }))
                        }
                        onFocus={() => pushGridFocus("price", rowIndex)}
                        onKeyDown={(e) =>
                          handleLineCellKeyDown(e, "price", lineTrackingMode, rowIndex)
                        }
                      />
                    ) : (
                      <span className="block text-right tabular-nums">
                        {formatMoney(line.netPrice)}
                      </span>
                    )}
                  </div>

                  {/* Discount */}
                  <div className="self-center px-1.5 py-1">
                    {isEditing ? (
                      <input
                        ref={discRef}
                        className={cn(inputBase, "text-right text-[12px] tabular-nums")}
                        type="number"
                        step="0.1"
                        min={0}
                        max={100}
                        value={(ev.discountPercentage ?? "") as number | string}
                        placeholder="0"
                        onChange={(e) =>
                          setEditVals((v) => ({
                            ...v,
                            discountPercentage: e.target.value ? Number(e.target.value) : null,
                          }))
                        }
                        onFocus={() => pushGridFocus("disc", rowIndex)}
                        onKeyDown={(e) =>
                          handleLineCellKeyDown(e, "disc", lineTrackingMode, rowIndex)
                        }
                      />
                    ) : (
                      <span className="block text-right tabular-nums">
                        {line.discountPercentage ? `${line.discountPercentage}%` : ""}
                      </span>
                    )}
                  </div>

                  {/* Tax rate */}
                  <div className="self-center px-2 py-1.5 text-right text-[12px] text-ink-mute tabular-nums">
                    {isEditing
                      ? ev.taxCodeId
                        ? `${taxRateMap[ev.taxCodeId as string] ?? 0}%`
                        : "—"
                      : line.taxRate != null
                        ? `${line.taxRate}%`
                        : "—"}
                  </div>

                  {/* Line net */}
                  <div className="self-center px-2 py-1.5 text-right text-[12px] tabular-nums">
                    {formatMoney(net)}
                  </div>

                  {/* Action button: Korrektur (posted) or Delete (draft) */}
                  <div className="flex items-center justify-center py-1">
                    {isBomComponent ? (
                      <span className="text-[11px] text-ink-mute">—</span>
                    ) : isPosted ? (
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
                        className="p-0.5 text-ink-mute transition-colors hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteLine(line._id);
                        }}
                      >
                        <Trash2Icon className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {lineTrackingMode &&
                  !isBomComponent &&
                  (line.documentLineId ? (
                    <div className="border-t border-hairline">
                      <TrackingEditor
                        documentId={documentId ?? ""}
                        documentLineId={line.documentLineId}
                        trackingMode={lineTrackingMode}
                        lineQty={line.quantity}
                        documentType={documentType ?? ""}
                        articleId={line.articleId ?? ""}
                        warehouseId={warehouseId ?? undefined}
                        isPosted={isPosted}
                        autoFocusToken={
                          trackingFocus?.lineId === line._id ? trackingFocus.token : null
                        }
                        onAdvance={() => advanceToNextLine(line._id, rowIndex)}
                        onAutoFocusConsumed={clearTrackingFocus}
                      />
                    </div>
                  ) : (
                    <div className="ml-6 border-t border-hairline bg-canvas-soft/40 px-4 py-2 text-[12px] text-ink-mute">
                      Serien- oder Chargenerfassung wird nach dem Speichern der Position hier
                      sichtbar.
                    </div>
                  ))}

                {/* Inline Korrektur panel */}
                {isKorr && line.documentLineId && (
                  <div className="flex items-center gap-3 border-t border-[color-mix(in_oklab,var(--primary)_20%,transparent)] bg-[color-mix(in_oklab,var(--primary)_6%,var(--canvas))] px-3 py-2">
                    <span className="shrink-0 text-[12px] font-medium text-ink-mute">
                      {t("document.lines.qtyDelta")}
                    </span>
                    <input
                      ref={korrInputRef}
                      type="number"
                      step="1"
                      className={cn(inputBase, "w-24 text-right text-[12px] tabular-nums")}
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
                          e.preventDefault();
                          e.stopPropagation();
                          setKorrLineId(null);
                          setKorrDelta("");
                        }
                      }}
                    />
                    <button
                      className="h-7 rounded px-3 text-[12px] transition-colors disabled:opacity-40"
                      style={{ background: "var(--primary)", color: "var(--primary-fg)" }}
                      disabled={korrMutation.isPending || !korrDelta || Number(korrDelta) === 0}
                      onClick={() => {
                        const delta = Number(korrDelta);
                        if (!isNaN(delta) && delta !== 0 && line.documentLineId) {
                          korrMutation.mutate({ lineId: line.documentLineId, qtyDelta: delta });
                        }
                      }}
                    >
                      {t("document.lines.apply")}
                    </button>
                    <button
                      className="h-7 rounded border border-hairline px-3 text-[12px] text-ink-secondary transition-colors hover:text-ink"
                      onClick={() => {
                        setKorrLineId(null);
                        setKorrDelta("");
                      }}
                    >
                      {t("document.lines.cancel")}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Totals + add */}
      <div className="flex shrink-0 items-center gap-4 border-t border-hairline bg-canvas-soft px-3 py-2">
        <button
          className="flex h-7 items-center gap-1.5 rounded border border-hairline px-3 text-[13px] text-ink-secondary transition-colors hover:border-primary hover:text-primary"
          onClick={addLine}
        >
          <PlusIcon className="size-3.5" />
          Position hinzufügen
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-6 text-[13px] tabular-nums">
          <span className="text-ink-mute">
            Netto <span className="ml-1 font-medium text-ink">{formatMoney(totals.net)}</span>
          </span>
          <span className="text-ink-mute">
            MwSt <span className="ml-1 font-medium text-ink">{formatMoney(totals.tax)}</span>
          </span>
          <span className="font-medium text-ink-mute">
            Brutto{" "}
            <span className="ml-1.5 text-[15px] font-semibold text-ink">
              {formatMoney(totals.gross)}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
});

// ─── Main DocumentEditor ──────────────────────────────────────────────────────

export function DocumentEditor({
  documentId,
  documentGroupId,
  companyId,
  onClose,
  onCreateNewDocument,
  onSaved,
}: DocumentEditorProps) {
  const { t } = useTranslation("ui");
  const queryClient = useQueryClient();
  const { registerCommand } = useCommands();
  const { setFocus, resetFocus } = useFocus();
  const isNew = documentId === "__new__";

  const [header, setHeader] = useState<DocHeader>({});
  const [headerBaselineSnapshot, setHeaderBaselineSnapshot] = useState<string | null>(null);
  const [isLinesDirty, setIsLinesDirty] = useState(false);
  const [pendingLines, setPendingLines] = useState<LineRow[]>([]);
  const [showTechnical, setShowTechnical] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [convertCandidates, setConvertCandidates] = useState<ConvertCandidate[] | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [duplicateDialog, setDuplicateDialog] = useState<DuplicateDialogState>({
    open: false,
    recordId: null,
    candidates: [],
    selectedGroupId: null,
    isPending: false,
  });
  const linesEditorRef = useRef<DocumentLinesEditorHandle>(null);
  const editorRootRef = useRef<HTMLDivElement>(null);
  const didAutoFocusRef = useRef(false);

  useEffect(() => {
    setFocus({
      workspace: "documents",
      panel: "document-editor",
      entity: "document",
      recordId: isNew ? null : documentId,
      area: "form",
      mode: isNew ? "create" : "edit",
    });
    return () => resetFocus();
  }, [documentId, isNew, resetFocus, setFocus]);

  useEffect(() => {
    didAutoFocusRef.current = false;
    setHeader({});
    setHeaderBaselineSnapshot(null);
    setIsLinesDirty(false);
    setPendingLines([]);
    setCloseDialogOpen(false);
  }, [documentId, documentGroupId, isNew]);

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
    queryFn: async () => {
      const r = await fetch("/api/data/documentType?limit=100");
      return r.ok ? r.json() : [];
    },
    enabled: isNew,
    staleTime: 5 * 60 * 1000,
  });
  const selectedDocType = header.documentType ?? null;
  const { data: docGroupsForType = [] } = useQuery({
    queryKey: ["data", "documentGroup", selectedDocType, companyId],
    queryFn: async () => {
      if (!selectedDocType) return [];
      const params = new URLSearchParams({ documentType: selectedDocType, limit: "100" });
      if (companyId) params.set("companyId", companyId);
      const r = await fetch(`/api/data/documentGroup?${params}`);
      return r.ok ? r.json() : [];
    },
    enabled: isNew && !!selectedDocType,
  });

  // ── lookup tables ──
  const { data: warehouses = [] } = useQuery({
    queryKey: ["data", "warehouse", companyId],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "200" });
      if (companyId) params.set("companyId", companyId);
      const r = await fetch(`/api/data/warehouse?${params}`);
      return r.ok ? r.json() : [];
    },
    staleTime: 5 * 60 * 1000,
  });
  const { data: paymentTerms = [] } = useQuery({
    queryKey: ["data", "paymentTerm"],
    queryFn: async () => {
      const r = await fetch("/api/data/paymentTerm?limit=200");
      return r.ok ? r.json() : [];
    },
    staleTime: 5 * 60 * 1000,
  });
  const { data: shippingMethods = [] } = useQuery({
    queryKey: ["data", "shippingMethod"],
    queryFn: async () => {
      const r = await fetch("/api/data/shippingMethod?limit=200");
      return r.ok ? r.json() : [];
    },
    staleTime: 5 * 60 * 1000,
  });
  const { data: currencies = [] } = useQuery({
    queryKey: ["data", "currency"],
    queryFn: async () => {
      const r = await fetch("/api/data/currency?limit=200");
      return r.ok ? r.json() : [];
    },
    staleTime: 5 * 60 * 1000,
  });
  const { data: auditTrail, isLoading: isAuditLoading } = useQuery<DocumentAuditTrail>({
    queryKey: ["documents", "audit", documentId],
    queryFn: async () => {
      const res = await fetch(`/api/documents/${documentId}/audit`);
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<DocumentAuditTrail>;
    },
    enabled: !isNew,
    staleTime: 0,
  });

  const activeDocumentType =
    header.documentType ?? groupData?.documentType ?? (docData as any)?.documentType ?? null;
  const hidePartyFields = !!activeDocumentType && MOVEMENT_DOCUMENT_TYPES.has(activeDocumentType);
  const addressLocks = getAddressLocks(header.customAttributes);
  const billingAddressLocked = !!addressLocks.billingAddress;
  const deliveryAddressLocked = !!addressLocks.deliveryAddress;
  const headerSnapshot = useMemo(
    () => JSON.stringify(normalizeHeaderForSave(header, hidePartyFields)),
    [header, hidePartyFields],
  );
  const isHeaderDirty = headerBaselineSnapshot != null && headerSnapshot !== headerBaselineSnapshot;

  // ── initialize header from doc or group defaults ──
  useEffect(() => {
    if (!isNew && docData) {
      // Hydrate the editable header draft from async query data.
      // eslint-disable-next-line react-hooks-js/set-state-in-effect
      const hydrated = {
        ...(docData as DocHeader),
        currencyId: normalizeCurrencyId(
          (docData as DocHeader).currencyId ?? null,
          currencies as any[],
        ),
      };
      setHeader(hydrated);
      setHeaderBaselineSnapshot(
        JSON.stringify(
          normalizeHeaderForSave(
            hydrated,
            !!(docData as any)?.documentType &&
              MOVEMENT_DOCUMENT_TYPES.has((docData as any).documentType),
          ),
        ),
      );
    }
  }, [isNew, docData, currencies]);

  // Merge group defaults into the new-document draft when they load.
  // Guard via ref so we apply defaults exactly once per group.
  const appliedGroupRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isNew || !groupData) return;
    if (appliedGroupRef.current === groupData.documentGroupId) return;
    appliedGroupRef.current = groupData.documentGroupId;
    setHeader((prev) => {
      const nextHeader = {
        documentGroupId: groupData.documentGroupId,
        documentType: groupData.documentType,
        documentDate: prev.documentDate ?? today(),
        warehouseId: prev.warehouseId ?? groupData.defaultWarehouseId ?? null,
        paymentTermId: prev.paymentTermId ?? groupData.defaultPaymentTermId ?? null,
        shippingMethodId: prev.shippingMethodId ?? groupData.defaultShippingMethodId ?? null,
        currencyId: normalizeCurrencyId(
          prev.currencyId ?? groupData.defaultCurrencyId ?? "EUR",
          currencies as any[],
        ),
        ...prev,
      };
      setHeaderBaselineSnapshot((current) =>
        current == null
          ? JSON.stringify(
              normalizeHeaderForSave(
                nextHeader,
                MOVEMENT_DOCUMENT_TYPES.has(nextHeader.documentType ?? ""),
              ),
            )
          : current,
      );
      return nextHeader;
    });
    // eslint-disable-next-line react-hooks-js/set-state-in-effect
  }, [isNew, groupData, currencies]);

  const patchHeader = (fields: Partial<DocHeader>) => {
    setHeader((prev) => ({ ...prev, ...fields }));
  };

  const setAddressFieldLock = (field: keyof AddressLockState, locked: boolean) => {
    setHeader((prev) => ({
      ...prev,
      customAttributes: setAddressLock(prev.customAttributes, field, locked),
    }));
  };

  // ── mutations ──
  const saveMutation = useMutation({
    mutationFn: async () => {
      const editorLines = linesEditorRef.current;
      await Promise.resolve(editorLines?.commitCurrentEdit());
      const linesToSave = editorLines?.getDraftLines() ?? pendingLines;
      const draftLines = linesToSave
        .filter((line) => !isBlankDraftLine(line))
        .map((line) => {
          const net = lineNet(line.quantity, line.netPrice, line.discountPercentage);
          return {
            documentLineId: line.documentLineId ?? null,
            lineNo: line.lineNo,
            articleId: line.articleId,
            articleTextSnapshot: line.articleTextSnapshot,
            lineType: line.lineType ?? "article",
            quantity: String(line.quantity),
            unit: line.unit,
            netPrice: String(line.netPrice),
            discountPercentage:
              line.discountPercentage != null ? String(line.discountPercentage) : null,
            taxCodeId: line.taxCodeId,
            taxAmount: String(lineTax(net, line.taxRate)),
            lineTotalNet: String(net),
            warehouseId: header.warehouseId ?? null,
            costCenterId: null,
            movementType: activeDocumentType ?? header.documentType ?? null,
            bomGroupId: line.bomGroupId ?? null,
            archived: !!line.isDeleted,
          };
        });

      const resolvedDocumentGroupId =
        header.documentGroupId ?? documentGroupId ?? groupData?.documentGroupId ?? null;
      const resolvedDocumentType = header.documentType ?? groupData?.documentType ?? null;
      if (!resolvedDocumentGroupId || !resolvedDocumentType) {
        throw new Error("Document group and type are required");
      }

      const res = await fetch("/api/documents/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: isNew ? null : documentId,
          documentGroupId: resolvedDocumentGroupId,
          documentType: resolvedDocumentType,
          documentDate: header.documentDate ?? today(),
          documentDirection: activeDocumentType ?? groupData?.documentType ?? null,
          customerId: hidePartyFields ? null : (header.customerId ?? null),
          billingAddress: hidePartyFields ? null : (header.billingAddress ?? null),
          deliveryAddress: hidePartyFields ? null : (header.deliveryAddress ?? null),
          deliveryAddressId: hidePartyFields ? null : (header.deliveryAddressId ?? null),
          customAttributes: header.customAttributes ?? null,
          currencyId: normalizeCurrencyId(
            header.currencyId ?? groupData?.defaultCurrencyId ?? null,
            currencies as any[],
          ),
          warehouseId: header.warehouseId ?? null,
          paymentTermId: header.paymentTermId ?? null,
          shippingMethodId: header.shippingMethodId ?? null,
          lines: draftLines,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const doc = (await res.json()) as { documentId?: string };
      return doc.documentId ?? documentId;
    },
    onSuccess: (savedId) => {
      queryClient.invalidateQueries({ queryKey: ["data", "document"] });
      queryClient.invalidateQueries({ queryKey: ["data", "documentLine"] });
      setIsLinesDirty(false);
      setCloseDialogOpen(false);
      toast.success(t("document.actions.save"));
      onSaved?.(savedId);
      onClose();
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
      queryClient.invalidateQueries({ queryKey: ["documents", "audit", documentId] });
      toast.success(t("document.actions.post"));
    },
    onError: (err: any) => toast.error(err.message),
  });

  const convertMutation = useMutation({
    mutationFn: async (targetGroupId?: string) => {
      const res = await fetch(`/api/documents/${documentId}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: targetGroupId ? JSON.stringify({ targetGroupId }) : undefined,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{
        candidates?: ConvertCandidate[];
        success?: boolean;
        newDocumentId?: string;
      }>;
    },
    onSuccess: (data) => {
      if (data.candidates) {
        setConvertCandidates(data.candidates);
        setSelectedCandidateId(
          data.candidates.length === 1 ? data.candidates[0].documentGroupId : null,
        );
      } else {
        setConvertCandidates(null);
        setSelectedCandidateId(null);
        queryClient.invalidateQueries({ queryKey: ["data", "document"] });
        queryClient.invalidateQueries({ queryKey: ["documents", "audit", documentId] });
        toast.success(t("document.actions.convert"));
        onClose();
      }
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/documents/${documentId}/delete`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ archived?: boolean; deleted?: boolean }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data", "document"] });
      queryClient.invalidateQueries({ queryKey: ["documents", "audit", documentId] });
      toast.success(t("form.archiveSuccess"));
      onClose();
    },
    onError: (err: any) => toast.error(err.message ?? t("form.fkViolationError")),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (targetGroupId: string) => {
      const res = await fetch(`/api/documents/${documentId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetGroupId }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ documentId: string; documentNo: string }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data", "document"] });
      toast.success(t("document.actions.duplicate"));
      setDuplicateDialog({
        open: false,
        recordId: null,
        candidates: [],
        selectedGroupId: null,
        isPending: false,
      });
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
      queryClient.invalidateQueries({ queryKey: ["documents", "audit", documentId] });
      toast.success(t("document.actions.storno"));
      onClose();
    },
    onError: (err: any) => toast.error(err.message),
  });

  // ── commands ──
  const { mutate: saveDocMutate } = saveMutation;
  const { mutate: postDocMutate } = postMutation;
  const { mutate: deleteDocMutate } = deleteMutation;
  const { mutate: stornoDocMutate } = stornoMutation;
  const handleSave = useCallback(() => saveDocMutate(), [saveDocMutate]);
  const handlePost = useCallback(() => postDocMutate(), [postDocMutate]);
  const handleDelete = useCallback(() => deleteDocMutate(), [deleteDocMutate]);
  const handleStorno = useCallback(() => stornoDocMutate(), [stornoDocMutate]);
  const handlePrint = useCallback(() => {
    window.open(`/api/documents/${documentId}/print`, "_blank", "noopener,noreferrer");
  }, [documentId]);
  const handleOpenDuplicateDialog = useCallback(async () => {
    const res = await fetch(`/api/documents/${documentId}/duplicate`, { method: "POST" });
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
      recordId: documentId,
      candidates,
      selectedGroupId: candidates[0]?.documentGroupId ?? null,
      isPending: false,
    });
  }, [documentId, t]);

  const docStatus = (header as any).status ?? (isNew ? "draft" : "—");
  const docNo = isNew ? "wird vergeben" : (header.documentNo ?? documentId);
  const groupLabel = groupData
    ? `${groupData.documentType}${String(groupData.documentGroupId).slice(-2)} · ${groupData.name}`
    : (documentGroupId ?? "");
  const docType = (header as any).documentType ?? "";
  const stornoDocumentId = (header as any).stornoDocumentId ?? null;
  const activeConvertCandidates = convertCandidates ?? [];
  const isDocumentDirty = isHeaderDirty || isLinesDirty;
  const handleClose = useCallback(() => {
    if (saveMutation.isPending) return;
    if (isDocumentDirty) {
      setCloseDialogOpen(true);
      return;
    }
    onClose();
  }, [isDocumentDirty, onClose, saveMutation.isPending]);
  const handleCloseWithoutSaving = useCallback(() => {
    setCloseDialogOpen(false);
    onClose();
  }, [onClose]);
  const handleSaveDraftAndClose = useCallback(() => {
    setCloseDialogOpen(false);
    saveDocMutate();
  }, [saveDocMutate]);

  useEffect(() => {
    if (didAutoFocusRef.current || (!isNew && isDocLoading)) return;
    const root = editorRootRef.current;
    if (!root) return;

    const selector = [
      'input:not([type="hidden"]):not([disabled])',
      "select:not([disabled])",
      "textarea:not([disabled])",
    ].join(", ");
    const first = root.querySelector<HTMLElement>(selector);
    didAutoFocusRef.current = true;

    requestAnimationFrame(() => {
      if (first) {
        first.focus();
        if (first instanceof HTMLInputElement && typeof first.select === "function") {
          first.select();
        }
      } else {
        linesEditorRef.current?.focusFirstLine();
      }
    });
  }, [documentId, documentGroupId, isDocLoading, isNew, groupData, header.documentId]);

  const { mutate: convertDocMutate } = convertMutation;
  const handleConvert = useCallback(() => convertDocMutate(undefined), [convertDocMutate]);
  const handleCreateNewDocument = useCallback(() => {
    onCreateNewDocument(
      documentGroupId ?? groupData?.documentGroupId ?? header.documentGroupId ?? undefined,
    );
  }, [documentGroupId, groupData?.documentGroupId, header.documentGroupId, onCreateNewDocument]);

  const commandRefs = useRef({
    handleSave: () => {},
    handlePost: () => {},
    handleDelete: () => {},
    handleStorno: () => {},
    handleClose: () => {},
    handleConvert: () => {},
    handlePrint: () => {},
    handleOpenDuplicateDialog: async () => {},
    handleCreateNewDocument: () => {},
    docStatus: "draft",
    docType: "",
    stornoDocumentId: null as string | null,
    isNew,
    isDocumentDirty: false,
    isCloseDialogOpen: false,
    isSavePending: false,
    isConvertDialogOpen: false,
    isDuplicateDialogOpen: false,
    archived: null as string | null,
    status: "draft",
    type: "",
  });

  useEffect(() => {
    commandRefs.current.handleSave = handleSave;
    commandRefs.current.handlePost = handlePost;
    commandRefs.current.handleDelete = handleDelete;
    commandRefs.current.handleStorno = handleStorno;
    commandRefs.current.handleClose = handleClose;
    commandRefs.current.handleConvert = handleConvert;
    commandRefs.current.handlePrint = handlePrint;
    commandRefs.current.handleOpenDuplicateDialog = handleOpenDuplicateDialog;
    commandRefs.current.handleCreateNewDocument = handleCreateNewDocument;
    commandRefs.current.docStatus = docStatus;
    commandRefs.current.docType = docType;
    commandRefs.current.stornoDocumentId = stornoDocumentId;
    commandRefs.current.isNew = isNew;
    commandRefs.current.isDocumentDirty = isDocumentDirty;
    commandRefs.current.isCloseDialogOpen = closeDialogOpen;
    commandRefs.current.isSavePending = saveMutation.isPending;
    commandRefs.current.isConvertDialogOpen = activeConvertCandidates.length > 0;
    commandRefs.current.isDuplicateDialogOpen = duplicateDialog.open;
    commandRefs.current.archived = (header as any).archivedAt ?? null;
    commandRefs.current.status = (header as any).status ?? "draft";
    commandRefs.current.type = (header as any).documentType ?? "";
  }, [
    handleSave,
    handlePost,
    handleDelete,
    handleStorno,
    handleClose,
    handleConvert,
    handlePrint,
    handleOpenDuplicateDialog,
    handleCreateNewDocument,
    docStatus,
    docType,
    stornoDocumentId,
    isNew,
    isDocumentDirty,
    closeDialogOpen,
    saveMutation.isPending,
    activeConvertCandidates.length,
    duplicateDialog.open,
    header,
  ]);

  useEffect(() => {
    const unregSave = registerCommand({
      id: "doc-save",
      label: { en: "Save Document", de: "Beleg speichern" },
      shortcut: "F10",
      group: "document",
      scope: "local",
      handler: () => commandRefs.current.handleSave(),
    });

    const unregCreate = registerCommand({
      id: "create-record",
      label: { en: "New Document", de: "Neuer Beleg" },
      shortcut: "F3",
      group: "document",
      scope: "local",
      isEnabled: () => true,
      handler: (state) => {
        if (state.area === "grid") {
          linesEditorRef.current?.addLine();
          return;
        }
        commandRefs.current.handleCreateNewDocument();
      },
    });

    const unregDelete = registerCommand({
      id: "delete-record",
      label: { en: "Delete Document", de: "Beleg löschen" },
      shortcut: "F4",
      group: "document",
      scope: "local",
      isEnabled: () => !commandRefs.current.isNew,
      handler: (state) => {
        if (state.area === "grid") {
          linesEditorRef.current?.deleteCurrentLine();
          return;
        }
        commandRefs.current.handleDelete();
      },
    });

    const unregDuplicate = registerCommand({
      id: "duplicate-record",
      label: { en: "Duplicate Document", de: "Beleg duplizieren" },
      shortcut: "F8",
      group: "document",
      scope: "local",
      isEnabled: () => !commandRefs.current.isNew && commandRefs.current.status !== "cancelled",
      handler: (state) => {
        if (state.area === "grid") {
          linesEditorRef.current?.duplicateCurrentLine();
          return;
        }
        commandRefs.current.handleOpenDuplicateDialog();
      },
    });

    const unregConvert = registerCommand({
      id: "transform-record",
      label: { en: "Convert Document", de: "Beleg wandeln" },
      shortcut: "F7",
      group: "document",
      scope: "local",
      isEnabled: () =>
        !commandRefs.current.isNew &&
        commandRefs.current.status !== "cancelled" &&
        !commandRefs.current.archived &&
        !["G", "g", "R", "r"].includes(commandRefs.current.type),
      handler: () => commandRefs.current.handleConvert(),
    });

    const unregPrint = registerCommand({
      id: "print-document",
      label: { en: "Print Document", de: "Beleg drucken" },
      shortcut: "F6",
      group: "document",
      scope: "local",
      isEnabled: () => !commandRefs.current.isNew,
      handler: () => commandRefs.current.handlePrint(),
    });

    const unregPost = registerCommand({
      id: "doc-post",
      label: { en: "Post Document", de: "Beleg buchen" },
      shortcut: "F9",
      group: "document",
      scope: "local",
      isEnabled: () => commandRefs.current.status === "draft" && !commandRefs.current.isNew,
      handler: () => commandRefs.current.handlePost(),
    });

    const unregStorno = registerCommand({
      id: "doc-storno",
      label: { en: "Cancel Document", de: "Beleg stornieren" },
      group: "document",
      scope: "local",
      isEnabled: () =>
        !commandRefs.current.isNew &&
        commandRefs.current.docStatus === "posted" &&
        ["R", "r"].includes(commandRefs.current.docType) &&
        !commandRefs.current.stornoDocumentId,
      handler: () => commandRefs.current.handleStorno(),
    });

    const unregClose = registerCommand({
      id: "doc-close",
      label: { en: "Close Document", de: "Beleg schließen" },
      shortcut: "Escape",
      group: "document",
      scope: "context",
      isEnabled: () =>
        !commandRefs.current.isSavePending &&
        !commandRefs.current.isCloseDialogOpen &&
        !commandRefs.current.isConvertDialogOpen &&
        !commandRefs.current.isDuplicateDialogOpen,
      handler: () => commandRefs.current.handleClose(),
    });

    return () => {
      unregSave();
      unregCreate();
      unregDelete();
      unregDuplicate();
      unregConvert();
      unregPrint();
      unregPost();
      unregStorno();
      unregClose();
    };
  }, [registerCommand, commandRefs]);

  // ── lookup items ──
  const warehouseItems = useMemo(
    () => (warehouses as any[]).map((w: any) => ({ id: w.warehouseId, label: w.name ?? w.code })),
    [warehouses],
  );
  const paymentTermItems = useMemo(
    () =>
      (paymentTerms as any[]).map((p: any) => ({
        id: p.paymentTermId,
        label: typeof p.name === "object" ? (p.name?.de ?? p.name?.en ?? "") : String(p.name ?? ""),
      })),
    [paymentTerms],
  );
  const shippingItems = useMemo(
    () =>
      (shippingMethods as any[]).map((s: any) => ({
        id: s.shippingMethodId,
        label: typeof s.name === "object" ? (s.name?.de ?? s.name?.en ?? "") : String(s.name ?? ""),
      })),
    [shippingMethods],
  );
  const currencyItems = useMemo(
    () =>
      (currencies as any[]).map((c: any) => ({
        id: c.code,
        label: `${c.code} – ${typeof c.name === "object" ? (c.name?.de ?? c.name?.en ?? "") : String(c.name ?? "")}`,
      })),
    [currencies],
  );
  if (!isNew && isDocLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-canvas">
        <span className="text-[13px] text-ink-mute">{t("document.loading")}</span>
      </div>
    );
  }

  return (
    <div ref={editorRootRef} className="flex h-full w-full flex-col overflow-hidden bg-canvas">
      {/* Breadcrumb bar */}
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-hairline bg-canvas-soft px-3">
        <span className="text-[13px] text-ink-mute">{t("document.breadcrumb")}</span>
        {groupLabel && (
          <>
            <ChevronRightIcon className="size-3 text-hairline-input" />
            <span className="text-[13px] text-ink-mute">{groupLabel}</span>
          </>
        )}
        <ChevronRightIcon className="size-3 text-hairline-input" />
        <span className={cn("text-[13px] font-medium", isNew && "text-ink-mute italic")}>
          {docNo}
        </span>
        <StatusDot status={docStatus} />
        {isDocumentDirty && <span className="ml-1 text-[11px] text-primary">●</span>}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden xl:flex-row">
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header form */}
          <div className="shrink-0 border-b border-hairline bg-canvas">
            {/* DocType + DocGroup selectors — only for new documents without a pre-set group */}
            {isNew && !documentGroupId && (
              <div
                className="grid gap-x-6 px-4 pt-4 pb-2"
                style={{ gridTemplateColumns: "1fr 1fr 200px 160px" }}
              >
                <DocLookupField
                  label={t("document.fields.documentType")}
                  focusField="documentType"
                  tabIndex={0}
                  value={header.documentType ?? null}
                  onChange={(id) =>
                    patchHeader({ documentType: id ?? undefined, documentGroupId: undefined })
                  }
                  items={(allDocTypes as any[]).map((dt: any) => ({
                    id: dt.movementType,
                    label: `${dt.movementType} — ${dt.name}`,
                  }))}
                  placeholder={t("document.lookup.selectType")}
                />
                <DocLookupField
                  label={t("document.fields.documentGroup")}
                  focusField="documentGroupId"
                  tabIndex={0}
                  value={header.documentGroupId ?? null}
                  onChange={(id) => {
                    const grp = (docGroupsForType as any[]).find(
                      (g: any) => g.documentGroupId === id,
                    );
                    if (grp) {
                      patchHeader({
                        documentGroupId: grp.documentGroupId,
                        warehouseId: header.warehouseId ?? grp.defaultWarehouseId ?? null,
                        paymentTermId: header.paymentTermId ?? grp.defaultPaymentTermId ?? null,
                        shippingMethodId:
                          header.shippingMethodId ?? grp.defaultShippingMethodId ?? null,
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
                  placeholder={
                    selectedDocType
                      ? t("document.lookup.selectGroup")
                      : t("document.lookup.selectTypeFirst")
                  }
                />
                <div />
                <div />
              </div>
            )}
            <div
              className="grid gap-x-6 px-4 py-4"
              style={{
                gridTemplateColumns: hidePartyFields
                  ? "minmax(0,1fr) 160px"
                  : "1fr 1fr 200px 160px",
              }}
            >
              {!hidePartyFields && (
                <>
                  {/* Col 1: Invoice address */}
                  <AddressPickerField
                    label={t("document.fields.billingAddress")}
                    tabIndex={0}
                    value={header.customerId ?? null}
                    addressData={header.billingAddress ?? null}
                    locked={billingAddressLocked}
                    lockLabel={t("document.actions.lock")}
                    unlockLabel={t("document.actions.unlock")}
                    onToggleLock={() =>
                      setAddressFieldLock("billingAddress", !billingAddressLocked)
                    }
                    onChange={(id, json, raw) => {
                      if (billingAddressLocked) return;
                      const update: Partial<DocHeader> = {
                        customerId: id,
                        billingAddress: json,
                      };
                      // Auto-fill currency and payment term from address if present
                      if (raw?.currencyId && !header.currencyId) update.currencyId = raw.currencyId;
                      if (raw?.paymentTermId && !header.paymentTermId)
                        update.paymentTermId = raw.paymentTermId;
                      // Auto-fill delivery address from address default
                      if (
                        raw?.defaultDeliveryAddressId &&
                        !header.deliveryAddressId &&
                        !deliveryAddressLocked
                      ) {
                        update.deliveryAddressId = raw.defaultDeliveryAddressId;
                      }
                      patchHeader(update);
                    }}
                  />

                  {/* Col 2: Delivery address */}
                  <DeliveryAddressPickerField
                    label={t("document.fields.deliveryAddress")}
                    tabIndex={0}
                    value={header.deliveryAddressId ?? null}
                    addressId={header.customerId ?? null}
                    addressData={header.deliveryAddress ?? null}
                    locked={deliveryAddressLocked}
                    lockLabel={t("document.actions.lock")}
                    unlockLabel={t("document.actions.unlock")}
                    onToggleLock={() =>
                      setAddressFieldLock("deliveryAddress", !deliveryAddressLocked)
                    }
                    onChange={(id, json) => {
                      if (deliveryAddressLocked) return;
                      patchHeader({ deliveryAddressId: id, deliveryAddress: json });
                    }}
                  />
                </>
              )}

              {/* Col 3: Logistics */}
              <div className="flex flex-col gap-3">
                <DocLookupField
                  label={t("document.fields.warehouse")}
                  focusField="warehouseId"
                  tabIndex={0}
                  value={header.warehouseId ?? null}
                  onChange={(id) => patchHeader({ warehouseId: id })}
                  items={warehouseItems}
                  placeholder="—"
                />
                <DocLookupField
                  label={t("document.fields.paymentTerm")}
                  focusField="paymentTermId"
                  tabIndex={0}
                  value={header.paymentTermId ?? null}
                  onChange={(id) => patchHeader({ paymentTermId: id })}
                  items={paymentTermItems}
                  placeholder="—"
                />
                <DocLookupField
                  label={t("document.fields.shippingMethod")}
                  focusField="shippingMethodId"
                  tabIndex={0}
                  value={header.shippingMethodId ?? null}
                  onChange={(id) => patchHeader({ shippingMethodId: id })}
                  items={shippingItems}
                  placeholder="—"
                />
              </div>

              {/* Col 4: Date + currency */}
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium tracking-wider text-ink-mute uppercase">
                    {t("document.fields.date")}
                  </label>
                  <input
                    tabIndex={0}
                    type="date"
                    className={cn(inputBase, "h-8")}
                    value={header.documentDate ?? ""}
                    onFocus={() =>
                      setFocus({
                        workspace: "documents",
                        panel: "document-editor",
                        entity: "document",
                        recordId: isNew ? null : documentId,
                        area: "form",
                        field: "documentDate",
                        mode: isNew ? "create" : "edit",
                      })
                    }
                    onChange={(e) => patchHeader({ documentDate: e.target.value })}
                  />
                </div>
                <DocLookupField
                  label={t("document.fields.currency")}
                  focusField="currencyId"
                  tabIndex={0}
                  value={header.currencyId ?? null}
                  onChange={(id) => patchHeader({ currencyId: id })}
                  items={currencyItems}
                  placeholder="EUR"
                  onTabForward={() => linesEditorRef.current?.focusFirstLine()}
                />
              </div>
            </div>

            {/* Technical info expander */}
            {!isNew && (
              <div className="border-t border-hairline px-4 py-1.5">
                <button
                  className="flex items-center gap-1 text-[10px] font-medium tracking-wider text-ink-mute uppercase transition-colors hover:text-ink"
                  onClick={() => setShowTechnical((v) => !v)}
                >
                  {showTechnical ? (
                    <ChevronDownIcon className="size-3" />
                  ) : (
                    <ChevronRightIcon className="size-3" />
                  )}
                  {t("document.technicalFields")}
                </button>
                {showTechnical && (
                  <div className="mt-2 mb-1 grid grid-cols-4 gap-3 rounded bg-canvas-soft p-3">
                    {[
                      "documentId",
                      "documentType",
                      "documentGroupId",
                      "documentDirection",
                      "status",
                      "versionNo",
                      "createdAt",
                      "updatedAt",
                    ].map((f) => (
                      <div key={f} className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-bold tracking-wider text-ink-mute uppercase">
                          {f}
                        </span>
                        <span className="truncate font-mono text-[11px] text-ink">
                          {String((header as any)[f] ?? "—")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Lines */}
          <div className="min-h-0 flex-1 overflow-hidden">
            <DocumentLinesEditor
              ref={linesEditorRef}
              documentId={isNew ? null : documentId}
              documentType={activeDocumentType}
              warehouseId={header.warehouseId ?? null}
              customerId={header.customerId ?? null}
              documentDate={header.documentDate ?? null}
              status={docStatus}
              onLinesChange={setPendingLines}
              onDirtyChange={setIsLinesDirty}
            />
          </div>
        </div>

        <aside className="max-h-72 shrink-0 overflow-hidden border-t border-hairline bg-canvas-soft/60 xl:max-h-none xl:w-80 xl:border-t-0 xl:border-l">
          <div className="flex h-full min-h-0 flex-col">
            <div className="shrink-0 border-b border-hairline px-4 py-3">
              <div className="text-[11px] font-semibold tracking-[0.18em] text-ink-mute uppercase">
                {t("document.audit.title", { defaultValue: "Audit-Verlauf" })}
              </div>
              <div className="mt-1 text-[12px] text-ink-mute">
                {t("document.audit.transaction", { defaultValue: "Transaction" })}:{" "}
                <span className="font-mono text-[11px] text-ink">
                  {auditTrail?.transactionId ?? "—"}
                </span>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {isNew ? (
                <div className="rounded border border-dashed border-hairline px-3 py-4 text-[12px] text-ink-mute">
                  {t("document.audit.noDraft", {
                    defaultValue: "Audit is available after the document is created.",
                  })}
                </div>
              ) : isAuditLoading ? (
                <div className="space-y-2">
                  <div className="h-16 animate-pulse rounded border border-hairline bg-canvas" />
                  <div className="h-16 animate-pulse rounded border border-hairline bg-canvas" />
                </div>
              ) : (
                <>
                  {(auditTrail?.nodes ?? []).map((node) => {
                    const tagLabelMap: Record<string, string> = {
                      current: t("document.audit.tags.current", { defaultValue: "Current" }),
                      origin: t("document.audit.tags.origin", { defaultValue: "Origin" }),
                      derived: t("document.audit.tags.derived", { defaultValue: "Derived" }),
                      reversal: t("document.audit.tags.reversal", { defaultValue: "Reversal" }),
                      predecessor: t("document.audit.tags.predecessor", {
                        defaultValue: "Predecessor",
                      }),
                      "storno-source": t("document.audit.tags.stornoSource", {
                        defaultValue: "Storno source",
                      }),
                      posted: t("document.audit.tags.posted", { defaultValue: "Posted" }),
                      archived: t("document.audit.tags.archived", { defaultValue: "Archived" }),
                    };

                    return (
                      <div
                        key={node.documentId}
                        className={cn(
                          "rounded border px-3 py-3 text-[12px] shadow-sm",
                          node.isCurrent
                            ? "border-primary bg-[color-mix(in_oklab,var(--primary)_6%,var(--canvas))]"
                            : "border-hairline bg-canvas",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[12px] text-ink">
                                {node.documentNo}
                              </span>
                              <StatusDot status={node.status} />
                            </div>
                            <div className="mt-0.5 text-[11px] text-ink-mute">
                              {node.documentType} · {formatDate(node.documentDate)}
                            </div>
                          </div>
                          <div className="flex flex-wrap justify-end gap-1">
                            {node.relationTags.map((tag) => (
                              <span
                                key={tag}
                                className={cn(
                                  "rounded-full border px-2 py-0.5 text-[10px] tracking-wide uppercase",
                                  tag === "current"
                                    ? "border-primary text-primary"
                                    : "border-hairline text-ink-mute",
                                )}
                              >
                                {tagLabelMap[tag] ?? tag}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-ink-mute">
                          <div className="min-w-0">
                            <div className="text-[9px] tracking-wide uppercase">parent</div>
                            <div className="truncate font-mono text-ink">
                              {node.parentDocumentId ?? "—"}
                            </div>
                          </div>
                          <div className="min-w-0">
                            <div className="text-[9px] tracking-wide uppercase">storno</div>
                            <div className="truncate font-mono text-ink">
                              {node.stornoDocumentId ?? "—"}
                            </div>
                          </div>
                          <div className="min-w-0">
                            <div className="text-[9px] tracking-wide uppercase">status</div>
                            <div className="truncate text-ink">{node.status}</div>
                          </div>
                          <div className="min-w-0">
                            <div className="text-[9px] tracking-wide uppercase">archived</div>
                            <div className="truncate text-ink">
                              {node.isArchived
                                ? formatDate(node.archivedAt ?? node.updatedAt ?? node.createdAt)
                                : "—"}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {(!auditTrail?.nodes || auditTrail.nodes.length === 0) && (
                    <div className="rounded border border-dashed border-hairline px-3 py-4 text-[12px] text-ink-mute">
                      {t("document.audit.empty", { defaultValue: "No related documents found." })}
                    </div>
                  )}

                  {auditTrail?.productionFacts?.length ? (
                    <div className="pt-2">
                      <div className="mb-2 text-[11px] font-semibold tracking-[0.18em] text-ink-mute uppercase">
                        {t("document.audit.production", { defaultValue: "Production Trace" })}
                      </div>
                      <div className="space-y-2">
                        {auditTrail.productionFacts.map((fact) => (
                          <div
                            key={fact.documentLineId}
                            className="rounded border border-hairline bg-canvas px-3 py-2 text-[12px]"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="font-mono text-[11px] text-ink">
                                  {fact.lineNo.toString().padStart(3, "0")} ·{" "}
                                  {fact.articleTextSnapshot ?? fact.articleId ?? "—"}
                                </div>
                                <div className="text-[11px] text-ink-mute">
                                  {fact.side === "output"
                                    ? t("document.audit.sideOutput", { defaultValue: "Output" })
                                    : t("document.audit.sideInput", { defaultValue: "Input" })}
                                </div>
                              </div>
                              <span
                                className={cn(
                                  "rounded-full border px-2 py-0.5 text-[10px] tracking-wide uppercase",
                                  fact.side === "output"
                                    ? "border-emerald-300 text-emerald-700"
                                    : "border-amber-300 text-amber-700",
                                )}
                              >
                                {fact.side}
                              </span>
                            </div>
                            <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-ink-mute">
                              <div>
                                <div className="text-[9px] tracking-wide uppercase">Soll</div>
                                <div className="font-mono text-ink">{fact.expectedQty}</div>
                              </div>
                              <div>
                                <div className="text-[9px] tracking-wide uppercase">Ist</div>
                                <div className="font-mono text-ink">{fact.movementQty}</div>
                              </div>
                              <div>
                                <div className="text-[9px] tracking-wide uppercase">Var.</div>
                                <div className="font-mono text-ink">{fact.varianceQty}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </aside>
      </div>

      <Dialog open={closeDialogOpen} onOpenChange={(open) => setCloseDialogOpen(open)}>
        <DialogContent className="max-w-md overflow-hidden p-0" showCloseButton={false}>
          <div className="border-b border-hairline px-5 py-4">
            <div className="text-[14px] font-semibold text-ink">
              {t("document.closePrompt.title")}
            </div>
            <div className="mt-0.5 text-[12px] text-ink-mute">
              {t("document.closePrompt.description")}
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2 px-5 py-4">
            <button
              type="button"
              className="h-8 rounded-full border border-hairline px-4 text-[13px] text-ink-secondary transition-colors hover:text-ink disabled:opacity-40"
              onClick={handleCloseWithoutSaving}
              disabled={saveMutation.isPending}
            >
              {t("document.closePrompt.closeWithoutSaving")}
            </button>
            <button
              type="button"
              className="h-8 rounded-full border border-hairline px-4 text-[13px] text-ink-secondary transition-colors hover:text-ink disabled:opacity-40"
              onClick={() => setCloseDialogOpen(false)}
              disabled={saveMutation.isPending}
            >
              {t("document.closePrompt.cancel")}
            </button>
            <button
              type="button"
              className="h-8 rounded-full px-4 text-[13px] transition-colors disabled:opacity-40"
              style={{ background: "var(--primary)", color: "var(--primary-fg)" }}
              onClick={handleSaveDraftAndClose}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending
                ? t("document.actions.saving")
                : t("document.closePrompt.saveDraftAndClose")}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Convert dialog */}
      <Dialog
        open={activeConvertCandidates.length > 0}
        onOpenChange={(open) => {
          if (!open) {
            setConvertCandidates(null);
            setSelectedCandidateId(null);
          }
        }}
      >
        <DialogContent className="max-w-sm overflow-hidden p-0">
          <div className="border-b border-hairline px-5 py-4">
            <div className="text-[14px] font-semibold text-ink">{t("document.convert.title")}</div>
            <div className="mt-0.5 text-[12px] text-ink-mute">
              {docType} {header.documentNo} → {t("document.convert.selectTarget")}
            </div>
          </div>
          <div className="flex flex-col gap-1.5 p-5">
            {activeConvertCandidates.map((c) => (
              <button
                key={c.documentGroupId}
                type="button"
                className={cn(
                  "w-full rounded border px-3 py-2 text-left text-[13px] transition-colors",
                  selectedCandidateId === c.documentGroupId || activeConvertCandidates.length === 1
                    ? "border-primary bg-[color-mix(in_oklab,var(--primary)_8%,var(--canvas))] text-ink"
                    : "border-hairline text-ink-secondary hover:border-primary hover:text-ink",
                )}
                onClick={() => setSelectedCandidateId(c.documentGroupId)}
              >
                <span className="mr-2 font-mono text-[11px] text-ink-mute">
                  {c.documentType}
                  {String(c.groupNumber).padStart(2, "0")}
                </span>
                {c.name}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2 px-5 pb-5">
            <button
              className="h-7 rounded-full border border-hairline px-4 text-[13px] text-ink-secondary transition-colors hover:text-ink"
              onClick={() => {
                setConvertCandidates(null);
                setSelectedCandidateId(null);
              }}
            >
              {t("document.actions.close")}
            </button>
            <button
              className="h-7 rounded-full px-4 text-[13px] transition-colors disabled:opacity-40"
              style={{ background: "var(--primary)", color: "var(--primary-fg)" }}
              disabled={
                convertMutation.isPending ||
                (activeConvertCandidates.length > 1 && !selectedCandidateId)
              }
              onClick={() => {
                const target =
                  activeConvertCandidates.length === 1
                    ? activeConvertCandidates[0].documentGroupId
                    : selectedCandidateId;
                if (target) convertMutation.mutate(target);
              }}
            >
              {convertMutation.isPending
                ? t("document.actions.converting")
                : t("document.convert.confirm")}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <DocumentTargetGroupDialog
        open={duplicateDialog.open}
        onOpenChange={(open) => setDuplicateDialog((p) => ({ ...p, open }))}
        title={t("document.actions.duplicate")}
        description={t("document.convert.selectTarget")}
        candidates={duplicateDialog.candidates}
        selectedGroupId={duplicateDialog.selectedGroupId}
        confirmLabel={t("document.actions.duplicate")}
        confirmPendingLabel={t("document.actions.duplicating")}
        isPending={duplicateMutation.isPending}
        onSelectGroupId={(groupId) =>
          setDuplicateDialog((p) => ({ ...p, selectedGroupId: groupId }))
        }
        onConfirm={() => {
          const target =
            duplicateDialog.selectedGroupId ?? duplicateDialog.candidates[0]?.documentGroupId;
          if (target) duplicateMutation.mutate(target);
        }}
      />
    </div>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────────
