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

import { executeCapability } from "../lib/capability-client";
import { entityGet, entityList } from "../lib/entity-capabilities";
import { formatDate, formatMoney, StatusDot } from "../lib/formatters";
import { isLocalizedText, resolveLocalizedText } from "../lib/localized-text";
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
import { LangtextEditor } from "./langtext-editor";
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
  noteText?: string | null;
  noteTextSourceEntity?: string | null;
  noteTextSourceId?: string | null;
  noteTextSourceField?: string | null;
  noteTextLinkedAt?: string | null;
  noteTextOverriddenAt?: string | null;
  preText?: string | null;
  preTextSourceEntity?: string | null;
  preTextSourceId?: string | null;
  preTextSourceField?: string | null;
  preTextLinkedAt?: string | null;
  preTextOverriddenAt?: string | null;
  postText?: string | null;
  postTextSourceEntity?: string | null;
  postTextSourceId?: string | null;
  postTextSourceField?: string | null;
  postTextLinkedAt?: string | null;
  postTextOverriddenAt?: string | null;
  stornoText?: string | null;
  stornoTextSourceEntity?: string | null;
  stornoTextSourceId?: string | null;
  stornoTextSourceField?: string | null;
  stornoTextLinkedAt?: string | null;
  stornoTextOverriddenAt?: string | null;
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
  requireSerialTracking?: boolean;
  requireBatchTracking?: boolean;
}

interface LineRow {
  _id: string;
  documentLineId?: string;
  lineNo: number;
  articleId: string | null;
  variantId: string | null;
  articleNo?: string | null;
  articleTextSnapshot: string | null;
  langText?: string | null;
  langTextSourceEntity?: string | null;
  langTextSourceId?: string | null;
  langTextSourceField?: string | null;
  langTextLinkedAt?: string | null;
  langTextOverriddenAt?: string | null;
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

interface ArticleVariantRow {
  variantId: string;
  articleId?: string | null;
  sku: string;
  lookupLabel?: string | null;
  variantOptionSummary?: string | null;
  availableQty?: string | null;
  isActive?: boolean | null;
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
  langtext?: string | null;
  notiztext?: string | null;
  warntext?: string | null;
  kurzbeschreibung?: string | null;
  primaryImageId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
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
const EMPTY_VARIANT_ROWS: ArticleVariantRow[] = [];
const BOM_SALES_DOC_TYPES = new Set(["N", "A", "L", "R", "G"]);
const BOM_PRODUCTION_DOC_TYPES = new Set(["q", "p"]);

// ─── small helpers ────────────────────────────────────────────────────────────

const inputBase =
  "h-7 w-full border bg-canvas rounded px-2 text-[13px] text-ink outline-none transition-colors border-hairline-input focus-visible:ring-[2px] focus-visible:ring-[color-mix(in_oklab,var(--primary)_20%,transparent)] focus-visible:border-primary disabled:opacity-40";

const MOVEMENT_DOCUMENT_TYPES = new Set(["V", "Z", "E", "U", "q", "p"]);

type DocumentTextField = "noteText" | "preText" | "postText" | "stornoText";
interface DocumentPrintOptions {
  noteText: boolean;
  preText: boolean;
  postText: boolean;
  stornoText: boolean;
  lineTexts: boolean;
  lineImages: boolean;
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
    variantId: null,
    articleNo: null,
    articleTextSnapshot: null,
    langText: null,
    langTextSourceEntity: null,
    langTextSourceId: null,
    langTextSourceField: null,
    langTextLinkedAt: null,
    langTextOverriddenAt: null,
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

export function normalizeLineForSave(line: LineRow) {
  return {
    lineNo: line.lineNo,
    articleId: line.articleId,
    variantId: line.variantId,
    articleNo: line.articleNo,
    articleTextSnapshot: line.articleTextSnapshot,
    langText: line.langText ?? null,
    langTextSourceEntity: line.langTextSourceEntity ?? null,
    langTextSourceId: line.langTextSourceId ?? null,
    langTextSourceField: line.langTextSourceField ?? null,
    langTextLinkedAt: line.langTextLinkedAt ?? null,
    langTextOverriddenAt: line.langTextOverriddenAt ?? null,
    lineType: line.variantId
      ? (line.lineType ?? "article")
      : (line.lineType === "article" || !line.lineType ? "comment" : line.lineType),
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
    noteText: header.noteText ?? null,
    noteTextSourceEntity: header.noteTextSourceEntity ?? null,
    noteTextSourceId: header.noteTextSourceId ?? null,
    noteTextSourceField: header.noteTextSourceField ?? null,
    noteTextLinkedAt: header.noteTextLinkedAt ?? null,
    noteTextOverriddenAt: header.noteTextOverriddenAt ?? null,
    preText: header.preText ?? null,
    preTextSourceEntity: header.preTextSourceEntity ?? null,
    preTextSourceId: header.preTextSourceId ?? null,
    preTextSourceField: header.preTextSourceField ?? null,
    preTextLinkedAt: header.preTextLinkedAt ?? null,
    preTextOverriddenAt: header.preTextOverriddenAt ?? null,
    postText: header.postText ?? null,
    postTextSourceEntity: header.postTextSourceEntity ?? null,
    postTextSourceId: header.postTextSourceId ?? null,
    postTextSourceField: header.postTextSourceField ?? null,
    postTextLinkedAt: header.postTextLinkedAt ?? null,
    postTextOverriddenAt: header.postTextOverriddenAt ?? null,
    stornoText: header.stornoText ?? null,
    stornoTextSourceEntity: header.stornoTextSourceEntity ?? null,
    stornoTextSourceId: header.stornoTextSourceId ?? null,
    stornoTextSourceField: header.stornoTextSourceField ?? null,
    stornoTextLinkedAt: header.stornoTextLinkedAt ?? null,
    stornoTextOverriddenAt: header.stornoTextOverriddenAt ?? null,
    customAttributes: header.customAttributes ?? null,
    currencyId: header.currencyId ?? null,
    warehouseId: header.warehouseId ?? null,
    paymentTermId: header.paymentTermId ?? null,
    shippingMethodId: header.shippingMethodId ?? null,
  };
}

function getDocumentPrintOptions(
  customAttributes: DocHeader["customAttributes"],
  defaults: DocumentPrintOptions,
): DocumentPrintOptions {
  const raw = (
    customAttributes as { documentPrintOptions?: Partial<DocumentPrintOptions> } | null | undefined
  )?.documentPrintOptions;
  return {
    noteText: raw?.noteText ?? defaults.noteText,
    preText: raw?.preText ?? defaults.preText,
    postText: raw?.postText ?? defaults.postText,
    stornoText: raw?.stornoText ?? defaults.stornoText,
    lineTexts: raw?.lineTexts ?? defaults.lineTexts,
    lineImages: raw?.lineImages ?? defaults.lineImages,
  };
}

function setDocumentPrintOptions(
  customAttributes: DocHeader["customAttributes"],
  options: DocumentPrintOptions,
): Record<string, unknown> {
  return {
    ...(customAttributes ?? {}),
    documentPrintOptions: options,
  };
}

function normalizeCurrencyId(
  value: string | null | undefined,
  currencies: Array<{ currencyId?: string; code?: string }>,
) {
  if (!value) return null;
  const matched = currencies.find((c) => c.code === value || c.currencyId === value);
  return matched?.code ?? value;
}

function nowIso() {
  return new Date().toISOString();
}

function resolveTextSourceLabel(sourceEntity?: string | null, sourceField?: string | null) {
  const parts = [sourceEntity, sourceField].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function applyHeaderTextFromSource(
  header: DocHeader,
  field: DocumentTextField,
  value: string | null | undefined,
  sourceEntity: string | null,
  sourceId: string | null,
  sourceField: string | null,
) {
  if (value == null) return header;
  const sourceEntityKey = `${field}SourceEntity` as keyof DocHeader;
  const sourceIdKey = `${field}SourceId` as keyof DocHeader;
  const sourceFieldKey = `${field}SourceField` as keyof DocHeader;
  const linkedAtKey = `${field}LinkedAt` as keyof DocHeader;
  const overriddenAtKey = `${field}OverriddenAt` as keyof DocHeader;
  return {
    ...header,
    [field]: value,
    [sourceEntityKey]: sourceEntity,
    [sourceIdKey]: sourceId,
    [sourceFieldKey]: sourceField,
    [linkedAtKey]: nowIso(),
    [overriddenAtKey]: null,
  };
}

function applyHeaderTextOverride(header: DocHeader, field: DocumentTextField, value: string) {
  const sourceEntityKey = `${field}SourceEntity` as keyof DocHeader;
  const sourceIdKey = `${field}SourceId` as keyof DocHeader;
  const sourceFieldKey = `${field}SourceField` as keyof DocHeader;
  const overriddenAtKey = `${field}OverriddenAt` as keyof DocHeader;
  return {
    ...header,
    [field]: value,
    [sourceEntityKey]: null,
    [sourceIdKey]: null,
    [sourceFieldKey]: null,
    [overriddenAtKey]: nowIso(),
  };
}

function applyLineTextOverride(line: Partial<LineRow>, value: string) {
  return {
    ...line,
    langText: value,
    langTextSourceEntity: null,
    langTextSourceId: null,
    langTextSourceField: null,
    langTextOverriddenAt: nowIso(),
  };
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

function resolveVariantLabel(line: LineRow, variantMeta?: ArticleVariantRow | null) {
  return (
    variantMeta?.lookupLabel ??
    variantMeta?.sku ??
    line.variantId?.slice(0, 8) ??
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
    variantId: row.variantId ?? null,
    articleNo: row.articleNo ?? null,
    articleTextSnapshot: row.articleTextSnapshot ?? null,
    langText: row.langText ?? null,
    langTextSourceEntity: row.langTextSourceEntity ?? null,
    langTextSourceId: row.langTextSourceId ?? null,
    langTextSourceField: row.langTextSourceField ?? null,
    langTextLinkedAt: row.langTextLinkedAt ?? null,
    langTextOverriddenAt: row.langTextOverriddenAt ?? null,
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

async function fetchArticleVariants(articleId: string): Promise<ArticleVariantRow[]> {
  return entityList<ArticleVariantRow>(
    "articleVariant",
    { articleId },
    { orderBy: "sku:asc", limit: 200 },
  ).catch(() => EMPTY_VARIANT_ROWS);
}

// ─── DocLookupField ───────────────────────────────────────────────────────────

const DocLookupField = React.forwardRef<
  HTMLInputElement,
  {
    label: string;
    focusField: string;
    value: string | null;
    onChange: (id: string | null) => void;
    items: Array<{ id: string; label: string }>;
    placeholder?: string;
    tabIndex?: number;
    onTabForward?: () => void;
    onTabBackward?: () => void;
  }
>(function DocLookupField(
  {
    label,
    focusField,
    value,
    onChange,
    items,
    placeholder = "—",
    tabIndex,
    onTabForward,
    onTabBackward,
  },
  ref,
) {
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
      ref={ref}
      value={value}
      source={source}
      tabIndex={tabIndex}
      placeholder={placeholder}
      onTabForward={onTabForward}
      onTabBackward={onTabBackward}
      onFocusChange={(focused) => {
        if (focused) {
          setFocus({ area: "lookup", field: focusField, row: null });
        }
      }}
      onChange={(next) => onChange(next)}
    />
  );
});

// ─── ArticleSearchCell ────────────────────────────────────────────────────────

function ArticleSearchCell({
  value,
  textSnapshot,
  onSelect,
  inputRef,
  rowIndex,
  onFocus,
  onTabForward,
  onTabBackward,
}: {
  value: string | null;
  textSnapshot: string | null;
  onSelect: (article: ArticleResult, rowIndex: number) => void;
  inputRef?: React.Ref<HTMLInputElement>;
  rowIndex: number;
  onFocus?: () => void;
  onTabForward?: () => void;
  onTabBackward?: () => void;
}) {
  const { setFocus } = useFocus();
  const source = useMemo<LookupSource<ArticleResult>>(
    () => ({
      title: "Articles",
      placeholder: "Search articles",
      emptyLabel: "No articles found",
      search: async (query, options) => {
        const { data } = await executeCapability<{ items: ArticleResult[] }>(
          "masterdata.article.search",
          { q: query, limit: options?.limit ?? 20 },
        );
        const rows = data.items;
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
      onTabForward={onTabForward}
      onTabBackward={onTabBackward}
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

// ─── VariantSearchCell ───────────────────────────────────────────────────────

function VariantSearchCell({
  value,
  variants,
  inputRef,
  rowIndex,
  onSelect,
  onFocus,
  onTabForward,
  onTabBackward,
  disabled = false,
  placeholder,
}: {
  value: string | null;
  variants: ArticleVariantRow[];
  inputRef?: React.Ref<HTMLInputElement>;
  rowIndex: number;
  onSelect: (variant: ArticleVariantRow | null, rowIndex: number) => void;
  onFocus?: () => void;
  onTabForward?: () => void;
  onTabBackward?: () => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const { setFocus } = useFocus();
  const activeVariants = useMemo(
    () => variants.filter((variant) => variant.isActive !== false),
    [variants],
  );
  const lookupItems = useMemo(
    () =>
      activeVariants.map((variant) => ({
        value: variant.variantId,
        label: variant.sku,
        description: [
          variant.variantOptionSummary || "Default-Variant",
          `${Number(variant.availableQty ?? 0).toFixed(3)} available`,
        ]
          .filter(Boolean)
          .join(" · "),
        raw: variant,
      })),
    [activeVariants],
  );
  const source = useMemo<LookupSource<ArticleVariantRow>>(
    () => ({
      title: "Variants",
      placeholder: placeholder ?? "Select variant",
      emptyLabel: "No active variants found",
      search: async (query, options) => {
        const normalized = query.trim().toLowerCase();
        const rows = lookupItems.filter((item) => {
          if (!normalized) return true;
          return (
            item.label.toLowerCase().includes(normalized) ||
            (item.description ?? "").toLowerCase().includes(normalized) ||
            item.value.toLowerCase().includes(normalized)
          );
        });
        return rows.slice(0, options?.limit ?? rows.length);
      },
      resolve: async (variantId) => {
        if (!variantId) return null;
        const row = variants.find((variant) => variant.variantId === variantId);
        if (!row) return null;
        return {
          value: row.variantId,
          label: row.sku,
          description: [
            row.variantOptionSummary || "Default-Variant",
            `${Number(row.availableQty ?? 0).toFixed(3)} available`,
          ]
            .filter(Boolean)
            .join(" · "),
          raw: row,
        };
      },
    }),
    [lookupItems, placeholder, variants],
  );

  return (
    <LookupField
      value={value}
      source={source}
      tabIndex={undefined}
      placeholder={placeholder ?? "Select variant"}
      ref={inputRef}
      disabled={disabled}
      className="min-w-0"
      onTabForward={onTabForward}
      onTabBackward={onTabBackward}
      onFocusChange={(focused) => {
        if (!focused) return;
        setFocus({
          workspace: "documents",
          panel: "document-editor",
          entity: "document",
          area: "grid",
          field: "variantId",
          row: rowIndex,
        });
        onFocus?.();
      }}
      onChange={(next, item) => {
        if (item?.raw) {
          onSelect(item.raw as ArticleVariantRow, rowIndex);
          return;
        }
        if (!next) {
          onSelect(null, rowIndex);
          return;
        }
        const fallback = variants.find((variant) => variant.variantId === next);
        if (fallback) {
          onSelect(fallback, rowIndex);
        }
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
  setActiveLineLangText: (html: string) => void;
  getLines: () => LineRow[];
  getDraftLines: () => LineRow[];
  isDirty: () => boolean;
  getPersistableLines: () => LineRow[];
}

type LineField = "articleId" | "variantId" | "qty" | "price" | "disc";

const DocumentLinesEditor = forwardRef<
  DocumentLinesEditorHandle,
  {
    documentId: string | null;
    documentType?: string | null;
    warehouseId?: string | null;
    customerId: string | null;
    documentDate: string | null;
    status?: string;
    companyId?: string | null;
    onLinesChange?: (lines: LineRow[]) => void;
    onDirtyChange?: (dirty: boolean) => void;
    onActiveLineChange?: (line: LineRow | null) => void;
    onTabBackwardFromFirstLine?: () => void;
  }
>(function DocumentLinesEditor(
  {
    documentId,
    documentType,
    warehouseId,
    customerId,
    documentDate,
    status,
    companyId,
    onLinesChange,
    onDirtyChange,
    onActiveLineChange,
    onTabBackwardFromFirstLine,
  },
  ref,
) {
  const { t } = useTranslation("ui");
  const { setFocus } = useFocus();
  const isPosted = status === "posted";
  const queryClient = useQueryClient();
  const [lines, setLines] = useState<LineRow[]>([]);

  // Fetch company settings for displaying article images in line items
  const { data: companySettings } = useQuery({
    queryKey: ["data", "company", companyId],
    queryFn: () =>
      companyId ? entityGet("company", companyId).catch(() => null) : Promise.resolve(null),
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });
  const linesRef = useRef<LineRow[]>([]);
  const isSelectingRef = useRef(false);
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
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setBaselineSnapshot(null);
      onDirtyChange?.(false);
      setEditingArticleMeta(null);
      setTrackingFocus(null);
    });
    return () => {
      cancelled = true;
    };
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
        mode: "edit",
      });
    },
    [documentId, setFocus],
  );

  const korrMutation = useMutation({
    mutationFn: async ({ lineId, qtyDelta }: { lineId: string; qtyDelta: number }) => {
      const { data } = await executeCapability("sales.documentLine.delta", {
        documentLineId: lineId,
        qtyDelta,
      });
      return data;
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
  const variantInputRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const discRef = useRef<HTMLInputElement>(null);
  const korrInputRef = useRef<HTMLInputElement>(null);

  const emitActiveLine = useCallback(
    (line: LineRow | null) => {
      onActiveLineChange?.(line);
    },
    [onActiveLineChange],
  );

  const { data: existingLines = EMPTY_DOC_LINES, isLoading } = useQuery({
    queryKey: ["data", "documentLine", documentId],
    queryFn: () =>
      documentId
        ? entityList("documentLine", { documentId }, { orderBy: "lineNo:asc" }).catch(
            () => EMPTY_DOC_LINES,
          )
        : Promise.resolve(EMPTY_DOC_LINES),
    enabled: !!documentId,
  });

  const { data: taxCodes = EMPTY_TAX_CODES } = useQuery<TaxCodeRow[]>({
    queryKey: ["data", "taxCode"],
    queryFn: () =>
      entityList<TaxCodeRow>("taxCode", {}, { limit: 100 }).catch(() => EMPTY_TAX_CODES),
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
      queryFn: () => entityGet<ArticleMetaRow>("article", articleId).catch(() => null),
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

  const variantIds = useMemo(
    () =>
      Array.from(
        new Set(
          effectiveLines
            .map((line) => line.variantId)
            .filter((variantId): variantId is string => !!variantId),
        ),
      ),
    [effectiveLines],
  );
  const variantQueries = useQueries({
    queries: variantIds.map((variantId) => ({
      queryKey: ["data", "articleVariant", variantId],
      queryFn: () => entityGet<ArticleVariantRow>("articleVariant", variantId).catch(() => null),
      enabled: !!variantId,
      staleTime: 5 * 60 * 1000,
    })),
  });
  const variantQueryRows = variantQueries.map((query) => query.data);
  const variantMetaById = useMemo(() => {
    const map = new Map<string, ArticleVariantRow>();
    for (let i = 0; i < variantIds.length; i++) {
      const row = variantQueryRows[i] ?? null;
      if (row?.variantId) map.set(variantIds[i], row);
    }
    return map;
  }, [variantIds, variantQueryRows]);

  const activeEditingLineType = (editVals.lineType ?? "article") as string;
  const editingArticleId = editingId ? (editVals.articleId ?? null) : null;
  const { data: editingArticleVariants = EMPTY_VARIANT_ROWS } = useQuery({
    queryKey: ["data", "articleVariant", editingArticleId],
    queryFn: async () => {
      if (!editingArticleId) return EMPTY_VARIANT_ROWS;
      return await fetchArticleVariants(editingArticleId);
    },
    enabled: !!editingId && !!editingArticleId && activeEditingLineType === "article",
    staleTime: 5 * 60 * 1000,
  });
  const activeEditingArticleVariants = useMemo(
    () => editingArticleVariants.filter((variant) => variant.isActive !== false),
    [editingArticleVariants],
  );

  useEffect(() => {
    if (!editingId || activeEditingLineType !== "article") return;
    if (!editingArticleId) return;
    if (editVals.variantId) return;
    if (activeEditingArticleVariants.length !== 1) return;

    const [onlyVariant] = activeEditingArticleVariants;
    if (!onlyVariant) return;

    queueMicrotask(() => {
      setEditVals((prev) => {
        if (prev.variantId === onlyVariant.variantId) return prev;
        return { ...prev, variantId: onlyVariant.variantId };
      });
    });
  }, [
    activeEditingArticleVariants,
    activeEditingLineType,
    editingArticleId,
    editingId,
    editVals.variantId,
  ]);

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
          line.articleId === row.articleId &&
          line.variantId === row.variantId
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
        articleId: l.articleId || null,
        variantId: l.variantId || null,
        articleNo: l.articleNo ?? null,
        articleTextSnapshot: l.articleTextSnapshot ?? null,
        langText: l.langText ?? null,
        langTextSourceEntity: l.langTextSourceEntity ?? null,
        langTextSourceId: l.langTextSourceId ?? null,
        langTextSourceField: l.langTextSourceField ?? null,
        langTextLinkedAt: l.langTextLinkedAt ?? null,
        langTextOverriddenAt: l.langTextOverriddenAt ?? null,
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
      const snapshot = serializeLines(mapped);
      queueMicrotask(() => {
        setBaselineSnapshot(snapshot);
        onDirtyChange?.(false);
      });
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
      const firstVisible = getFocusableLines()[0] ?? null;
      if (firstVisible) {
        const rowIndex = getFocusableLines().findIndex((l) => l._id === firstVisible._id);
        focusLineField(rowIndex >= 0 ? rowIndex : 0, "articleId");
        return;
      }
      addLine();
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
    setActiveLineLangText: (html: string) => {
      if (!editingId) return;
      setEditVals((prev) => applyLineTextOverride(prev, html));
    },
    getLines: () => linesRef.current,
    getDraftLines: () => linesRef.current.filter((line) => !isBlankDraftLine(line)),
    isDirty: () => isDirty,
    getPersistableLines: () => getPersistableLines(effectiveLines),
  }));

  const startEdit = useCallback(
    (line: LineRow, rowIndex?: number) => {
      if (line.lineType === "bom_component") return;
      setEditingId(line._id);
      setEditVals({ ...line });
      setEditingArticleMeta(line.articleId ? (articleMetaById.get(line.articleId) ?? null) : null);
      pushGridFocus("articleId", rowIndex ?? linesRef.current.findIndex((l) => l._id === line._id));
    },
    [articleMetaById, pushGridFocus],
  );

  const getFocusableLines = useCallback(
    () => linesRef.current.filter((line) => !line.isDeleted && line.lineType !== "bom_component"),
    [],
  );

  const focusLineField = useCallback(
    (rowIndex: number, field: LineField) => {
      const row = getFocusableLines()[rowIndex];
      if (!row) return;
      if (editingId !== row._id) {
        startEdit(row, rowIndex);
      }
      window.setTimeout(() => {
        switch (field) {
          case "articleId":
            articleInputRef.current?.focus();
            articleInputRef.current?.select();
            break;
          case "variantId":
            variantInputRef.current?.focus();
            variantInputRef.current?.select();
            break;
          case "qty":
            qtyRef.current?.focus();
            qtyRef.current?.select();
            break;
          case "price":
            priceRef.current?.focus();
            priceRef.current?.select();
            break;
          case "disc":
            discRef.current?.focus();
            discRef.current?.select();
            break;
        }
      }, 30);
    },
    [editingId, getFocusableLines, startEdit],
  );

  const focusPreviousLineField = useCallback(
    (rowIndex: number, field: LineField) => {
      if (field === "articleId") {
        if (rowIndex <= 0) {
          onTabBackwardFromFirstLine?.();
          return;
        }
        focusLineField(rowIndex - 1, "disc");
        return;
      }

      if (field === "variantId") {
        focusLineField(rowIndex, "articleId");
        return;
      }

      if (field === "qty") {
        focusLineField(rowIndex, "variantId");
        return;
      }

      if (field === "price") {
        focusLineField(rowIndex, "qty");
        return;
      }

      if (field === "disc") {
        focusLineField(rowIndex, "price");
      }
    },
    [focusLineField, onTabBackwardFromFirstLine],
  );

  const getEditableLineDraft = useCallback(() => {
    if (!editingId) return null;
    const current = linesRef.current.find((line) => line._id === editingId);
    if (!current) return null;
    return {
      ...current,
      ...editVals,
      articleNo: editVals.articleNo ?? current.articleNo ?? null,
      taxRate: editVals.taxCodeId ? (taxRateMap[editVals.taxCodeId as string] ?? null) : null,
    } as LineRow;
  }, [editVals, editingId, taxRateMap]);

  useEffect(() => {
    emitActiveLine(editingId ? getEditableLineDraft() : null);
  }, [editingId, emitActiveLine, getEditableLineDraft]);

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
        variantId: null,
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

    if ((nextHeader.lineType ?? "article") === "article" && nextHeader.articleId) {
      const variantId = nextHeader.variantId ?? null;
      if (!variantId) {
        toast.error(
          t("document.lines.variantRequired", {
            defaultValue: "Select an active variant before saving.",
          }),
        );
        setTimeout(() => {
          variantInputRef.current?.focus();
          variantInputRef.current?.select();
        }, 30);
        return null;
      }

      const selectedVariant = editingArticleVariants.find(
        (variant) => variant.variantId === variantId,
      );
      if (selectedVariant && selectedVariant.isActive === false) {
        toast.error(
          t("document.lines.variantInactive", {
            defaultValue: "Select an active variant before saving.",
          }),
        );
        setTimeout(() => {
          variantInputRef.current?.focus();
          variantInputRef.current?.select();
        }, 30);
        return null;
      }
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

    const { data } = await executeCapability<{ lines: unknown[] }>("sales.documentLine.create", {
      documentId,
      ...normalizeLineForSave(line),
    });

    const persisted = data.lines;
    const merged = mergePersistedDocumentLines(linesRef.current, persisted);
    replaceLines(merged);

    return (
      merged.find(
        (row) =>
          row.documentLineId != null &&
          row.lineNo === line.lineNo &&
          row.lineType === line.lineType &&
          row.articleId === line.articleId &&
          row.variantId === line.variantId,
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
    isSelectingRef.current = true;
    try {
      void queryClient.prefetchQuery({
        queryKey: ["data", "articleVariant", article.articleId],
        queryFn: async () => fetchArticleVariants(article.articleId),
      });
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
        variantId: null,
        articleNo: article.articleNo,
        articleTextSnapshot: article.name,
        unit: article.baseUnit ?? null,
        netPrice: price,
        taxCodeId,
        lineType: resolvedLineType,
        bomGroupId: shouldExpandBom(articleMeta, documentType)
          ? (prev.bomGroupId ?? prev.documentLineId ?? prev._id ?? null)
          : null,
        ...(articleMeta?.langtext
          ? {
              langText: articleMeta.langtext,
              langTextSourceEntity: "article",
              langTextSourceId: articleMeta.articleId,
              langTextSourceField: "langtext",
              langTextLinkedAt: nowIso(),
              langTextOverriddenAt: null,
            }
          : {}),
      }));

      if (shouldExpandBom(articleMeta, documentType)) {
        void fetchBomComponents(article.articleId);
      }

      pushGridFocus(resolvedLineType === "article" ? "variantId" : "qty", rowIndex);

      // Advance focus to the next required field for the resolved line type.
      setTimeout(() => {
        if (resolvedLineType === "article") {
          variantInputRef.current?.focus();
          variantInputRef.current?.select();
          return;
        }
        qtyRef.current?.focus();
        qtyRef.current?.select();
      }, 30);
    } finally {
      isSelectingRef.current = false;
    }
  }

  function handleVariantSelect(variant: ArticleVariantRow | null, rowIndex: number) {
    setEditVals((prev) => ({
      ...prev,
      variantId: variant?.variantId ?? null,
    }));

    if (!variant) return;

    pushGridFocus("qty", rowIndex);

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
      if (e.shiftKey) {
        if (field === "qty") {
          focusPreviousLineField(currentRowIndex, "qty");
        } else if (field === "price") {
          focusPreviousLineField(currentRowIndex, "price");
        } else if (field === "disc") {
          focusPreviousLineField(currentRowIndex, "disc");
        }
        return;
      }
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
        style={{
          gridTemplateColumns: "48px 180px 240px 1fr 72px 56px 96px 64px 60px 96px 32px",
        }}
      >
        {[
          t("document.lines.pos"),
          t("document.lines.article"),
          t("document.lines.variant", { defaultValue: "Variant" }),
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
            const canEditRow = !isBomComponent;
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
                    gridTemplateColumns: "48px 180px 240px 1fr 72px 56px 96px 64px 60px 96px 32px",
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
                    const nextTarget = e.relatedTarget as HTMLElement | null;
                    if (nextTarget && e.currentTarget.contains(nextTarget)) return;
                    if (nextTarget && (nextTarget.closest?.(".z-\\[70\\]") || nextTarget.closest?.("[class*=\"z-[70]\"]"))) return;
                    window.setTimeout(() => {
                      if (isSelectingRef.current) return;
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
                      <div className="flex items-center gap-1.5">
                        {companySettings?.showArticleImageInEntry &&
                          articleMeta?.primaryImageId && (
                            <img
                              src={`/api/storage/article-images/${articleMeta.primaryImageId}?v=${encodeURIComponent(articleMeta.primaryImageId ?? "")}`}
                              alt=""
                              className="size-6 shrink-0 rounded border border-hairline bg-canvas-soft object-cover shadow-sm"
                            />
                          )}
                        <div className="min-w-0 flex-1">
                          <ArticleSearchCell
                            value={ev.articleId ?? null}
                            textSnapshot={ev.articleTextSnapshot ?? null}
                            onSelect={handleArticleSelect}
                            inputRef={articleInputRef}
                            rowIndex={rowIndex}
                            onTabForward={() => variantInputRef.current?.focus()}
                            onTabBackward={() => focusPreviousLineField(rowIndex, "articleId")}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {companySettings?.showArticleImageInEntry &&
                          articleMeta?.primaryImageId && (
                            <img
                              src={`/api/storage/article-images/${articleMeta.primaryImageId}?v=${encodeURIComponent(articleMeta.primaryImageId ?? "")}`}
                              alt=""
                              className="size-6 shrink-0 rounded border border-hairline bg-canvas-soft object-cover shadow-sm"
                            />
                          )}
                        <span className="truncate font-mono text-[12px] text-ink-mute">
                          {resolveArticleLabel(line, articleMeta)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Variant */}
                  <div className={cn("min-w-0 self-center px-1.5 py-1", isBomComponent && "pl-5")}>
                    {isEditing ? (
                      (row.lineType ?? "article") === "article" ? (
                        <VariantSearchCell
                          value={ev.variantId ?? null}
                          variants={editingArticleVariants}
                          inputRef={variantInputRef}
                          rowIndex={rowIndex}
                          disabled={!ev.articleId}
                          placeholder={
                            ev.articleId
                              ? t("document.lines.variantPlaceholder", {
                                  defaultValue: "Select variant",
                                })
                              : t("document.lines.variantSelectArticleFirst", {
                                  defaultValue: "Select article first",
                                })
                          }
                          onSelect={handleVariantSelect}
                          onTabForward={() => qtyRef.current?.focus()}
                          onTabBackward={() => focusPreviousLineField(rowIndex, "variantId")}
                        />
                      ) : (
                        <span className="block truncate font-mono text-[12px] text-ink-mute">
                          {resolveVariantLabel(row, variantMetaById.get(row.variantId ?? ""))}
                        </span>
                      )
                    ) : (
                      <span className="block truncate font-mono text-[12px] text-ink-mute">
                        {resolveVariantLabel(row, variantMetaById.get(row.variantId ?? ""))}
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
                        isPosted={false}
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
          {t("documentEditor.addLine", { defaultValue: "Position hinzufügen" })}
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-6 text-[13px] tabular-nums">
          <span className="text-ink-mute">
            {t("documentEditor.net", { defaultValue: "Netto" })}{" "}
            <span className="ml-1 font-medium text-ink">{formatMoney(totals.net)}</span>
          </span>
          <span className="text-ink-mute">
            {t("documentEditor.tax", { defaultValue: "MwSt" })}{" "}
            <span className="ml-1 font-medium text-ink">{formatMoney(totals.tax)}</span>
          </span>
          <span className="font-medium text-ink-mute">
            {t("documentEditor.gross", { defaultValue: "Brutto" })}{" "}
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
  const { t, i18n } = useTranslation("ui");
  const queryClient = useQueryClient();
  const { registerCommand } = useCommands();
  const { setFocus, resetFocus } = useFocus();
  const isNew = documentId === "__new__";

  const [header, setHeader] = useState<DocHeader>({});
  const [headerBaselineSnapshot, setHeaderBaselineSnapshot] = useState<string | null>(null);
  const [isLinesDirty, setIsLinesDirty] = useState(false);
  const [pendingLines, setPendingLines] = useState<LineRow[]>([]);
  const [activeLine, setActiveLine] = useState<LineRow | null>(null);
  const [showTechnical, setShowTechnical] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printAfterSave, setPrintAfterSave] = useState(false);
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
  const didAutoSelectActiveLineRef = useRef(false);

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
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      didAutoFocusRef.current = false;
      setHeader({});
      setHeaderBaselineSnapshot(null);
      setIsLinesDirty(false);
      setPendingLines([]);
      setActiveLine(null);
      didAutoSelectActiveLineRef.current = false;
      setCloseDialogOpen(false);
      setPrintDialogOpen(false);
      setPrintAfterSave(false);
    });
    return () => {
      cancelled = true;
    };
  }, [documentId, documentGroupId, isNew]);

  // ── fetch existing document ──
  const { data: docData, isLoading: isDocLoading } = useQuery({
    queryKey: ["data", "document", documentId],
    queryFn: () =>
      documentId ? entityGet("document", documentId).catch(() => null) : Promise.resolve(null),
    enabled: !isNew,
  });

  // ── fetch document group for defaults ──
  const groupId = documentGroupId ?? (docData as any)?.documentGroupId;
  const { data: groupData } = useQuery<DocGroup | null>({
    queryKey: ["data", "documentGroup", groupId],
    queryFn: () =>
      groupId ? entityGet<DocGroup>("documentGroup", groupId).catch(() => null) : Promise.resolve(null),
    enabled: !!groupId,
  });

  const { data: companySettings } = useQuery({
    queryKey: ["data", "company", companyId],
    queryFn: () =>
      companyId ? entityGet("company", companyId).catch(() => null) : Promise.resolve(null),
    enabled: !!companyId,
  });

  // ── document type + group selectors (new documents only) ──
  const { data: allDocTypes = [] } = useQuery({
    queryKey: ["data", "documentType"],
    queryFn: () => entityList("documentType", {}, { limit: 100 }).catch(() => []),
    enabled: isNew,
    staleTime: 5 * 60 * 1000,
  });
  const selectedDocType = header.documentType ?? null;
  const { data: docGroupsForType = [] } = useQuery({
    queryKey: ["data", "documentGroup", selectedDocType, companyId],
    queryFn: () =>
      selectedDocType
        ? entityList(
            "documentGroup",
            { documentType: selectedDocType, ...(companyId ? { companyId } : {}) },
            { limit: 100 },
          ).catch(() => [])
        : Promise.resolve([]),
    enabled: isNew && !!selectedDocType,
  });

  // ── lookup tables ──
  const { data: warehouses = [] } = useQuery({
    queryKey: ["data", "warehouse", companyId],
    queryFn: () =>
      entityList("warehouse", companyId ? { companyId } : {}, { limit: 200 }).catch(() => []),
    staleTime: 5 * 60 * 1000,
  });
  const { data: paymentTerms = [] } = useQuery({
    queryKey: ["data", "paymentTerm"],
    queryFn: () => entityList("paymentTerm", {}, { limit: 200 }).catch(() => []),
    staleTime: 5 * 60 * 1000,
  });
  const { data: shippingMethods = [] } = useQuery({
    queryKey: ["data", "shippingMethod"],
    queryFn: () => entityList("shippingMethod", {}, { limit: 200 }).catch(() => []),
    staleTime: 5 * 60 * 1000,
  });
  const { data: currencies = [] } = useQuery({
    queryKey: ["data", "currency"],
    queryFn: () => entityList("currency", {}, { limit: 200 }).catch(() => []),
    staleTime: 5 * 60 * 1000,
  });
  const { data: auditTrail, isLoading: isAuditLoading } = useQuery<DocumentAuditTrail>({
    queryKey: ["documents", "audit", documentId],
    queryFn: async () => {
      const { data } = await executeCapability<DocumentAuditTrail>("sales.document.audit", {
        documentId,
      });
      return data;
    },
    enabled: !isNew,
    staleTime: 0,
  });

  const { data: activeArticleMeta } = useQuery<ArticleMetaRow | null>({
    queryKey: ["data", "article", activeLine?.articleId],
    queryFn: () => {
      const articleId = activeLine?.articleId;
      if (!articleId) return Promise.resolve(null);
      return entityGet<ArticleMetaRow>("article", articleId).catch(() => null);
    },
    enabled: !!activeLine?.articleId,
    staleTime: 5 * 60 * 1000,
  });

  const activeDocumentType =
    header.documentType ?? groupData?.documentType ?? (docData as any)?.documentType ?? null;
  const hidePartyFields = !!activeDocumentType && MOVEMENT_DOCUMENT_TYPES.has(activeDocumentType);
  const requireSerialTracking = !!groupData?.requireSerialTracking;
  const requireBatchTracking = !!groupData?.requireBatchTracking;
  const requiresGroupTracking = requireSerialTracking || requireBatchTracking;

  const headerSnapshot = useMemo(
    () => JSON.stringify(normalizeHeaderForSave(header, hidePartyFields)),
    [header, hidePartyFields],
  );
  const isHeaderDirty = headerBaselineSnapshot != null && headerSnapshot !== headerBaselineSnapshot;

  useEffect(() => {
    if (didAutoSelectActiveLineRef.current || activeLine) return;
    const firstVisibleLine =
      pendingLines.find((line) => !line.isDeleted && line.lineType !== "bom_component") ?? null;
    if (!firstVisibleLine) return;
    didAutoSelectActiveLineRef.current = true;
    queueMicrotask(() => setActiveLine(firstVisibleLine));
  }, [activeLine, pendingLines]);

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
      const baseline = JSON.stringify(
        normalizeHeaderForSave(
          hydrated,
          !!(docData as any)?.documentType &&
            MOVEMENT_DOCUMENT_TYPES.has((docData as any).documentType),
        ),
      );
      queueMicrotask(() => {
        setHeader(hydrated);
        setHeaderBaselineSnapshot(baseline);
      });
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
            ...normalizeLineForSave(line),
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

      const { data: doc } = await executeCapability<{ documentId?: string }>(
        "sales.document.saveDraft",
        {
          documentId: isNew ? null : documentId,
          documentGroupId: resolvedDocumentGroupId,
          documentType: resolvedDocumentType,
          documentDate: header.documentDate ?? today(),
          documentDirection: activeDocumentType ?? groupData?.documentType ?? null,
          customerId: hidePartyFields ? null : (header.customerId ?? null),
          billingAddress: hidePartyFields ? null : (header.billingAddress ?? null),
          deliveryAddress: hidePartyFields ? null : (header.deliveryAddress ?? null),
          deliveryAddressId: hidePartyFields ? null : (header.deliveryAddressId ?? null),
          noteText: header.noteText ?? null,
          noteTextSourceEntity: header.noteTextSourceEntity ?? null,
          noteTextSourceId: header.noteTextSourceId ?? null,
          noteTextSourceField: header.noteTextSourceField ?? null,
          noteTextLinkedAt: header.noteTextLinkedAt ?? null,
          noteTextOverriddenAt: header.noteTextOverriddenAt ?? null,
          preText: header.preText ?? null,
          preTextSourceEntity: header.preTextSourceEntity ?? null,
          preTextSourceId: header.preTextSourceId ?? null,
          preTextSourceField: header.preTextSourceField ?? null,
          preTextLinkedAt: header.preTextLinkedAt ?? null,
          preTextOverriddenAt: header.preTextOverriddenAt ?? null,
          postText: header.postText ?? null,
          postTextSourceEntity: header.postTextSourceEntity ?? null,
          postTextSourceId: header.postTextSourceId ?? null,
          postTextSourceField: header.postTextSourceField ?? null,
          postTextLinkedAt: header.postTextLinkedAt ?? null,
          postTextOverriddenAt: header.postTextOverriddenAt ?? null,
          stornoText: header.stornoText ?? null,
          stornoTextSourceEntity: header.stornoTextSourceEntity ?? null,
          stornoTextSourceId: header.stornoTextSourceId ?? null,
          stornoTextSourceField: header.stornoTextSourceField ?? null,
          stornoTextLinkedAt: header.stornoTextLinkedAt ?? null,
          stornoTextOverriddenAt: header.stornoTextOverriddenAt ?? null,
          customAttributes: header.customAttributes ?? null,
          currencyId: normalizeCurrencyId(
            header.currencyId ?? groupData?.defaultCurrencyId ?? null,
            currencies as any[],
          ),
          warehouseId: header.warehouseId ?? null,
          paymentTermId: header.paymentTermId ?? null,
          shippingMethodId: header.shippingMethodId ?? null,
          lines: draftLines,
        },
      );
      return doc.documentId ?? documentId;
    },
    onSuccess: (savedId) => {
      queryClient.invalidateQueries({ queryKey: ["data", "document"] });
      queryClient.invalidateQueries({ queryKey: ["data", "documentLine"] });
      setIsLinesDirty(false);
      setCloseDialogOpen(false);
      setPrintDialogOpen(false);
      toast.success(t("document.actions.save"));
      onSaved?.(savedId);
      if (printAfterSave) {
        window.open(`/api/documents/${savedId}/print`, "_blank", "noopener,noreferrer");
        setPrintAfterSave(false);
      }
      onClose();
    },
    onError: (err: any) => {
      setPrintAfterSave(false);
      toast.error(err.message);
    },
  });

  const postMutation = useMutation({
    mutationFn: async () => {
      const { data } = await executeCapability("sales.document.post", { documentId });
      return data;
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
      if (!targetGroupId) {
        const { data } = await executeCapability<{ candidates: ConvertCandidate[] }>(
          "sales.document.convertCandidates",
          { documentId },
        );
        return data as { candidates?: ConvertCandidate[]; success?: boolean; newDocumentId?: string };
      }
      const { data } = await executeCapability<{ success: boolean; newDocumentId: string }>(
        "sales.document.convert",
        { documentId, targetGroupId },
      );
      return data as { candidates?: ConvertCandidate[]; success?: boolean; newDocumentId?: string };
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
      const { data } = await executeCapability<{ archived?: boolean; deleted?: boolean }>(
        "sales.document.delete",
        { documentId },
      );
      return data;
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
      const { data } = await executeCapability<{ documentId: string; documentNo: string }>(
        "sales.document.duplicate",
        { documentId, targetGroupId },
      );
      return data;
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
      const { data } = await executeCapability("sales.document.storno", { documentId });
      return data;
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
    setPrintDialogOpen(true);
  }, []);
  const handlePrintDialogConfirm = useCallback(() => {
    setPrintAfterSave(true);
    saveDocMutate();
  }, [saveDocMutate]);
  const handleOpenDuplicateDialog = useCallback(async () => {
    let candidates: DocumentTargetGroupCandidate[];
    try {
      const { data } = await executeCapability<{ candidates: DocumentTargetGroupCandidate[] }>(
        "sales.document.duplicateCandidates",
        { documentId },
      );
      candidates = data.candidates;
    } catch (error) {
      toast.error(
        error instanceof Error && error.message ? error.message : t("document.duplicate.noTargets"),
      );
      return;
    }
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
  const printOptions = useMemo(
    () =>
      getDocumentPrintOptions(header.customAttributes, {
        noteText: companySettings?.printAddressLongText ?? true,
        preText: companySettings?.printPreText ?? true,
        postText: companySettings?.printPostText ?? true,
        stornoText: true,
        lineTexts: companySettings?.printPositionTexts ?? true,
        lineImages: companySettings?.showArticleImageOnDocuments ?? false,
      }),
    [companySettings, header.customAttributes],
  );
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

    didAutoFocusRef.current = true;

    requestAnimationFrame(() => {
      if (isNew) {
        const billingAddressPicker = root.querySelector<HTMLElement>("#billing-address-picker");
        if (billingAddressPicker) {
          billingAddressPicker.focus();
          if (
            billingAddressPicker instanceof HTMLInputElement &&
            typeof billingAddressPicker.select === "function"
          ) {
            billingAddressPicker.select();
          }
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
    isPrintDialogOpen: false,
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
    commandRefs.current.isPrintDialogOpen = printDialogOpen;
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
    printDialogOpen,
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
      handler: () => {
        linesEditorRef.current?.addLine();
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
        !commandRefs.current.isPrintDialogOpen &&
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
        label: isLocalizedText(p.name) ? resolveLocalizedText(p.name, i18n.language) : String(p.name ?? ""),
      })),
    [paymentTerms, i18n.language],
  );
  const shippingItems = useMemo(
    () =>
      (shippingMethods as any[]).map((s: any) => ({
        id: s.shippingMethodId,
        label: isLocalizedText(s.name) ? resolveLocalizedText(s.name, i18n.language) : String(s.name ?? ""),
      })),
    [shippingMethods, i18n.language],
  );
  const currencyItems = useMemo(
    () =>
      (currencies as any[]).map((c: any) => ({
        id: c.code,
        label: `${c.code} – ${isLocalizedText(c.name) ? resolveLocalizedText(c.name, i18n.language) : String(c.name ?? "")}`,
      })),
    [currencies, i18n.language],
  );
  const headerTabOrder = {
    documentType: 1,
    documentGroup: 2,
    billingAddress: 3,
    deliveryAddress: 4,
    warehouse: 5,
    paymentTerm: 6,
    shippingMethod: 7,
    date: 8,
    currency: 9,
  } as const;
  const warehouseFieldRef = useRef<HTMLInputElement>(null);
  const paymentTermFieldRef = useRef<HTMLInputElement>(null);
  const shippingFieldRef = useRef<HTMLInputElement>(null);
  const dateFieldRef = useRef<HTMLInputElement>(null);
  const currencyFieldRef = useRef<HTMLInputElement>(null);
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
                  tabIndex={headerTabOrder.documentType}
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
                  tabIndex={headerTabOrder.documentGroup}
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
                    id="billing-address-picker"
                    label={t("document.fields.billingAddress")}
                    tabIndex={headerTabOrder.billingAddress}
                    value={header.customerId ?? null}
                    addressData={header.billingAddress ?? null}
                    locked={false}
                    onChange={(id, json, raw) => {
                      const update: Partial<DocHeader> = {
                        customerId: id,
                        billingAddress: json,
                      };
                      // Auto-fill currency and payment term from address if present
                      if (raw?.currencyId && !header.currencyId) update.currencyId = raw.currencyId;
                      if (raw?.paymentTermId && !header.paymentTermId)
                        update.paymentTermId = raw.paymentTermId;
                      // Auto-fill delivery address from address default
                      if (raw?.defaultDeliveryAddressId && !header.deliveryAddressId) {
                        update.deliveryAddressId = raw.defaultDeliveryAddressId;
                      }
                      patchHeader(update);
                      const addressTextSource = (json ?? raw ?? {}) as AddressSnapshot & {
                        notizText?: string | null;
                        langText?: string | null;
                        warnText?: string | null;
                        notiztext?: string | null;
                        langtext?: string | null;
                        warntext?: string | null;
                      };
                      const addressNotizText =
                        addressTextSource.notiztext ?? addressTextSource.notizText ?? null;
                      const addressLangText =
                        addressTextSource.langtext ?? addressTextSource.langText ?? null;
                      if (addressNotizText != null) {
                        setHeader((prev) =>
                          applyHeaderTextFromSource(
                            prev,
                            "noteText",
                            addressNotizText,
                            "address",
                            id,
                            "notiztext",
                          ),
                        );
                      }
                      if (addressLangText != null) {
                        setHeader((prev) =>
                          applyHeaderTextFromSource(
                            prev,
                            "preText",
                            addressLangText,
                            "address",
                            id,
                            "langtext",
                          ),
                        );
                      }
                    }}
                  />

                  {/* Col 2: Delivery address */}
                  <DeliveryAddressPickerField
                    label={t("document.fields.deliveryAddress")}
                    tabIndex={headerTabOrder.deliveryAddress}
                    value={header.deliveryAddressId ?? null}
                    addressId={header.customerId ?? null}
                    addressData={header.deliveryAddress ?? null}
                    locked={false}
                    onChange={(id, json) => {
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
                  tabIndex={headerTabOrder.warehouse}
                  ref={warehouseFieldRef}
                  value={header.warehouseId ?? null}
                  onChange={(id) => patchHeader({ warehouseId: id })}
                  items={warehouseItems}
                  placeholder="—"
                  onTabForward={() => paymentTermFieldRef.current?.focus()}
                />
                <DocLookupField
                  label={t("document.fields.paymentTerm")}
                  focusField="paymentTermId"
                  tabIndex={headerTabOrder.paymentTerm}
                  ref={paymentTermFieldRef}
                  value={header.paymentTermId ?? null}
                  onChange={(id) => patchHeader({ paymentTermId: id })}
                  items={paymentTermItems}
                  placeholder="—"
                  onTabForward={() => shippingFieldRef.current?.focus()}
                  onTabBackward={() => warehouseFieldRef.current?.focus()}
                />
                <DocLookupField
                  label={t("document.fields.shippingMethod")}
                  focusField="shippingMethodId"
                  tabIndex={headerTabOrder.shippingMethod}
                  ref={shippingFieldRef}
                  value={header.shippingMethodId ?? null}
                  onChange={(id) => patchHeader({ shippingMethodId: id })}
                  items={shippingItems}
                  placeholder="—"
                  onTabForward={() => dateFieldRef.current?.focus()}
                  onTabBackward={() => paymentTermFieldRef.current?.focus()}
                />
              </div>

              {/* Col 4: Date + currency */}
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium tracking-wider text-ink-mute uppercase">
                    {t("document.fields.date")}
                  </label>
                  <input
                    ref={dateFieldRef}
                    tabIndex={headerTabOrder.date}
                    type="date"
                    className={cn(inputBase, "h-8")}
                    value={header.documentDate ?? ""}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        currencyFieldRef.current?.focus();
                      } else if (e.key === "Tab" && !e.shiftKey) {
                        e.preventDefault();
                        currencyFieldRef.current?.focus();
                      } else if (e.key === "Tab" && e.shiftKey) {
                        e.preventDefault();
                        shippingFieldRef.current?.focus();
                      }
                    }}
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
                  tabIndex={headerTabOrder.currency}
                  ref={currencyFieldRef}
                  value={header.currencyId ?? null}
                  onChange={(id) => patchHeader({ currencyId: id })}
                  items={currencyItems}
                  placeholder="EUR"
                  onTabForward={() => linesEditorRef.current?.focusFirstLine()}
                  onTabBackward={() => dateFieldRef.current?.focus()}
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
            {requiresGroupTracking && (
              <div className="mx-4 mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                <div className="font-medium">
                  {t("documentEditor.trackingRequired", {
                    defaultValue: "Beleggruppe erzwingt Tracking vor dem Buchen.",
                  })}
                </div>
                <div className="mt-0.5 text-[12px] text-amber-800">
                  {[
                    requireSerialTracking ? "Seriennummern" : null,
                    requireBatchTracking ? "Chargen" : null,
                  ]
                    .filter(Boolean)
                    .join(" und ")}{" "}
                  müssen für betroffene Positionen vollständig erfasst sein.
                </div>
              </div>
            )}
            <DocumentLinesEditor
              ref={linesEditorRef}
              documentId={isNew ? null : documentId}
              documentType={activeDocumentType}
              warehouseId={header.warehouseId ?? null}
              customerId={header.customerId ?? null}
              documentDate={header.documentDate ?? null}
              status={docStatus}
              companyId={companyId ?? null}
              onLinesChange={setPendingLines}
              onDirtyChange={setIsLinesDirty}
              onActiveLineChange={setActiveLine}
              onTabBackwardFromFirstLine={() => currencyFieldRef.current?.focus()}
            />
          </div>
        </div>

        <aside className="max-h-72 shrink-0 overflow-hidden border-t border-hairline bg-canvas-soft/60 xl:max-h-none xl:w-80 xl:border-t-0 xl:border-l">
          <div className="flex h-full min-h-0 flex-col">
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {/* ── TRANSACTION ID & AUDIT TRAIL BLOCK (AT THE VERY TOP) ── */}
              {!isNew && auditTrail?.transactionId && (
                <div className="flex items-center justify-between px-1 text-[11px] text-ink-mute">
                  <span>{t("document.audit.transaction", { defaultValue: "Transaction" })}:</span>
                  <span className="font-mono text-ink">{auditTrail.transactionId}</span>
                </div>
              )}

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

              {/* ── POSITIONS-LANGTEXT ── */}
              {activeLine?.articleId && (
                <div className="rounded border border-hairline bg-canvas p-3">
                  <div className="mb-2 text-[12px] font-semibold text-ink">
                    {t("document.media.positionImage", { defaultValue: "Positionsbild" })}
                  </div>
                  {activeArticleMeta?.primaryImageId ? (
                    <div className="flex items-center justify-center rounded-lg border border-hairline bg-canvas-soft p-4 transition-all hover:bg-canvas-soft/80">
                      <img
                        src={`/api/storage/article-images/${activeArticleMeta.primaryImageId}?v=${encodeURIComponent(activeArticleMeta.primaryImageId)}`}
                        alt={activeLine.articleTextSnapshot ?? "Positionsbild"}
                        className="max-h-[160px] rounded-md border border-hairline object-contain shadow-sm"
                      />
                    </div>
                  ) : (
                    <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-hairline bg-canvas-soft/30 text-[11px] text-ink-mute">
                      {t("document.media.noImage", { defaultValue: "Kein Bild hinterlegt" })}
                    </div>
                  )}
                </div>
              )}

              <div className="rounded border border-hairline bg-canvas p-2">
                <div className="mb-2 flex items-center justify-between gap-2 px-1">
                  <div className="text-[11px] text-ink-mute">
                    {t("document.langtexts.savedPerDocument", {
                      defaultValue: "Die Auswahl wird pro Beleg gespeichert.",
                    })}
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-2 rounded-full border border-hairline px-3 text-[12px] text-ink-secondary transition-colors hover:border-primary hover:text-primary"
                    onClick={() => setPrintDialogOpen(true)}
                  >
                    {t("document.actions.printOptions", { defaultValue: "Druckoptionen" })}
                  </button>
                </div>
                <LangtextEditor
                  title={t("document.langtexts.title", { defaultValue: "Langtexte" })}
                  entries={[
                    {
                      key: "noteText",
                      label: t("document.langtexts.note", { defaultValue: "Notiztext" }),
                      value: header.noteText ?? "",
                      sourceLabel: resolveTextSourceLabel(
                        header.noteTextSourceEntity,
                        header.noteTextSourceField,
                      ),
                      linked: !!header.noteTextSourceEntity || !!header.noteTextSourceId,
                      overridden: !!header.noteTextOverriddenAt,
                    },
                    {
                      key: "preText",
                      label: t("document.langtexts.pre", { defaultValue: "Vortext" }),
                      value: header.preText ?? "",
                      sourceLabel: resolveTextSourceLabel(
                        header.preTextSourceEntity,
                        header.preTextSourceField,
                      ),
                      linked: !!header.preTextSourceEntity || !!header.preTextSourceId,
                      overridden: !!header.preTextOverriddenAt,
                    },
                    {
                      key: "postText",
                      label: t("document.langtexts.post", { defaultValue: "Nachtext" }),
                      value: header.postText ?? "",
                      sourceLabel: resolveTextSourceLabel(
                        header.postTextSourceEntity,
                        header.postTextSourceField,
                      ),
                      linked: !!header.postTextSourceEntity || !!header.postTextSourceId,
                      overridden: !!header.postTextOverriddenAt,
                    },
                    {
                      key: "stornoText",
                      label: t("document.langtexts.reverse", { defaultValue: "Stornotext" }),
                      value: header.stornoText ?? "",
                      sourceLabel: resolveTextSourceLabel(
                        header.stornoTextSourceEntity,
                        header.stornoTextSourceField,
                      ),
                      linked: !!header.stornoTextSourceEntity || !!header.stornoTextSourceId,
                      overridden: !!header.stornoTextOverriddenAt,
                    },
                  ]}
                  activeKey={undefined}
                  syncKey={documentId ? `document:${documentId}:header` : "document:new:header"}
                  onChange={(fieldKey, html) => {
                    if (fieldKey === "noteText") {
                      setHeader((prev) => applyHeaderTextOverride(prev, "noteText", html));
                    } else if (fieldKey === "preText") {
                      setHeader((prev) => applyHeaderTextOverride(prev, "preText", html));
                    } else if (fieldKey === "postText") {
                      setHeader((prev) => applyHeaderTextOverride(prev, "postText", html));
                    } else if (fieldKey === "stornoText") {
                      setHeader((prev) => applyHeaderTextOverride(prev, "stornoText", html));
                    }
                  }}
                  className="h-[420px]"
                />
                <div className="mt-2 px-1 text-[11px] text-ink-mute">
                  {activeLine
                    ? `${String(activeLine.lineNo).padStart(3, "0")} · ${
                        activeLine.articleTextSnapshot ?? activeLine.articleNo ?? "—"
                      }`
                    : t("document.langtexts.noLine", {
                        defaultValue: "Wähle eine Position, um den Langtext zu bearbeiten.",
                      })}
                </div>
              </div>
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

      <Dialog open={printDialogOpen} onOpenChange={(open) => setPrintDialogOpen(open)}>
        <DialogContent className="max-w-md overflow-hidden p-0">
          <div className="border-b border-hairline px-5 py-4">
            <div className="text-[14px] font-semibold text-ink">
              {t("document.print.title", { defaultValue: "Druckoptionen" })}
            </div>
            <div className="mt-0.5 text-[12px] text-ink-mute">
              {t("document.print.description", {
                defaultValue: "Die Auswahl wird am Beleg gespeichert.",
              })}
            </div>
          </div>
          <div className="space-y-2 px-5 py-4 text-[13px]">
            {(
              [
                ["noteText", t("document.langtexts.note", { defaultValue: "Notiztext" })],
                ["preText", t("document.langtexts.pre", { defaultValue: "Vortext" })],
                ["postText", t("document.langtexts.post", { defaultValue: "Nachtext" })],
                ["stornoText", t("document.langtexts.reverse", { defaultValue: "Stornotext" })],
                [
                  "lineTexts",
                  t("document.langtexts.lineToggle", { defaultValue: "Positionstexte" }),
                ],
                [
                  "lineImages",
                  t("document.langtexts.lineImagesToggle", { defaultValue: "Positionsbilder" }),
                ],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex items-center justify-between gap-3 rounded border border-hairline px-3 py-2"
              >
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={printOptions[key]}
                  onChange={(e) =>
                    setHeader((prev) => ({
                      ...prev,
                      customAttributes: setDocumentPrintOptions(prev.customAttributes, {
                        ...printOptions,
                        [key]: e.target.checked,
                      }),
                    }))
                  }
                />
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2 px-5 pb-5">
            <button
              className="h-7 rounded-full border border-hairline px-4 text-[13px] text-ink-secondary transition-colors hover:text-ink"
              onClick={() => setPrintDialogOpen(false)}
            >
              {t("document.actions.close")}
            </button>
            <button
              className="h-7 rounded-full px-4 text-[13px] transition-colors disabled:opacity-40"
              style={{ background: "var(--primary)", color: "var(--primary-fg)" }}
              disabled={saveMutation.isPending}
              onClick={handlePrintDialogConfirm}
            >
              {saveMutation.isPending
                ? t("document.actions.saving")
                : t("document.actions.print", { defaultValue: "Drucken" })}
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
