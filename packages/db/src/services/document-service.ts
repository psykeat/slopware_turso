import { eq, and, or, sql, inArray, asc, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "../index";
import {
  document,
  documentLine,
  documentLineAllocation,
  documentGroup,
  company,
  articleBom,
  documentLineTracking,
  inventoryBalance,
  inventoryMovement,
  factSalesEvent,
  factPurchaseEvent,
  article,
  currency,
  serialNumber,
  priceList,
  priceListItem,
  numberSequence,
  journalEntry,
  journalLine,
  accountDeterminationRule,
  unit,
} from "../schema/app.schema";
import { resolveFiscalPeriodId } from "./fiscal-period-generator";
import { refreshStatisticsMVs } from "./statistics";

export interface TypeNode {
  documentType: string;
  typeLabel: string;
  mainGroup: {
    documentGroupId: string;
    name: string;
    documentType: string;
    groupNumber: number;
  } | null;
  groups: Array<{
    documentGroupId: string;
    name: string;
    documentType: string;
    groupNumber: number;
  }>;
}

export interface TreeSection {
  direction: string;
  label: string;
  types: TypeNode[];
}

export interface DocumentAuditNode {
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

export interface DocumentAuditLink {
  fromDocumentId: string;
  toDocumentId: string;
  relationType: "conversion" | "storno";
}

export interface ProductionFactTraceRow {
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

export interface DocumentAuditTrail {
  currentDocumentId: string;
  transactionId: string;
  nodes: DocumentAuditNode[];
  links: DocumentAuditLink[];
  productionFacts: ProductionFactTraceRow[];
}

const TYPE_LABELS: Record<string, string> = {
  N: "Angebote",
  A: "Aufträge",
  L: "Lieferscheine",
  R: "Rechnungen",
  G: "Gutschriften",
  b: "Bestellungen",
  l: "Wareneingänge",
  r: "Eingangsrechnungen",
  g: "Eingangsgutschriften",
  V: "Inventur",
  U: "Umbuchungen",
  Z: "Zugänge",
  E: "Entnahmen",
  q: "Produktionsaufträge",
  p: "Fertigmeldungen",
};

const toDateOrNull = (value: string | Date | null | undefined): Date | null => {
  if (value == null) return null;
  return value instanceof Date ? value : new Date(value);
};

export const DIRECTION_FROM_TYPE: Record<string, string> = {
  N: "OUTBOUND",
  A: "OUTBOUND",
  L: "OUTBOUND",
  R: "OUTBOUND",
  G: "OUTBOUND",
  b: "INBOUND",
  l: "INBOUND",
  r: "INBOUND",
  g: "INBOUND",
  V: "ADJUSTMENT",
  Z: "ADJUSTMENT",
  E: "ADJUSTMENT",
  U: "ADJUSTMENT",
  q: "PRODUCTION",
  p: "PRODUCTION",
};

const TYPE_SEQUENCE: Record<string, number> = {
  N: 1,
  A: 2,
  L: 3,
  R: 4,
  G: 5,
  b: 1,
  l: 2,
  r: 3,
  g: 4,
  V: 1,
  Z: 2,
  E: 3,
  U: 4,
  q: 1,
  p: 2,
};

const NEXT_TYPE: Record<string, string | undefined> = {
  N: "A",
  A: "L",
  L: "R",
  R: undefined,
  G: undefined,
  b: "l",
  l: "r",
  r: undefined,
  g: undefined,
  V: "Z",
  Z: "E",
  E: "U",
  U: undefined,
  q: "p",
  p: undefined,
};

const OUTBOUND_DUPLICATE_TYPES = new Set(["N", "A", "L", "R", "G"]);
const INBOUND_DUPLICATE_TYPES = new Set(["b", "l", "r", "g"]);
const ADJUSTMENT_DUPLICATE_TYPES = new Set(["V", "Z", "E", "U"]);
const PRODUCTION_DUPLICATE_TYPES = new Set(["q", "p"]);

function resolveDuplicateTargetTypes(sourceType: string): string[] {
  if (OUTBOUND_DUPLICATE_TYPES.has(sourceType)) return [...OUTBOUND_DUPLICATE_TYPES];
  if (INBOUND_DUPLICATE_TYPES.has(sourceType)) return [...INBOUND_DUPLICATE_TYPES];
  if (ADJUSTMENT_DUPLICATE_TYPES.has(sourceType)) return [sourceType];
  if (PRODUCTION_DUPLICATE_TYPES.has(sourceType)) return ["q"];
  return [];
}

const DIRECTION_LABELS: Record<string, string> = {
  OUTBOUND: "Warenausgang",
  INBOUND: "Wareneingang",
  ADJUSTMENT: "Lagerbuchungen",
  PRODUCTION: "Produktion",
};

function directionLabel(direction: string | null | undefined): string {
  return DIRECTION_LABELS[direction ?? ""] ?? "Sonstiges";
}

function resolveSerialLifecycle(movementType: string, lineType?: string | null) {
  if (movementType === "A") {
    return { status: "reserved" as const, movementLink: null };
  }

  if (movementType === "q" && lineType === "bom_component") {
    return { status: "sold" as const, movementLink: "consumedMovementId" as const };
  }

  if (["L", "R", "G", "E", "g"].includes(movementType)) {
    return { status: "sold" as const, movementLink: "consumedMovementId" as const };
  }

  return { status: "in_stock" as const, movementLink: "createdMovementId" as const };
}

function generateDocumentNo(prefix: string, nextValue: number, padding: number): string {
  return prefix + String(nextValue).padStart(padding, "0");
}

async function resolveCurrencyCode(tx: any, currencyValue?: string | null): Promise<string | null> {
  if (!currencyValue) return null;
  if (currencyValue.length === 3) return currencyValue;

  const [row] = await tx
    .select({ code: currency.code })
    .from(currency)
    .where(or(eq(currency.currencyId, currencyValue), eq(currency.code, currencyValue)))
    .limit(1);

  return row?.code ?? currencyValue.slice(0, 3).toUpperCase();
}

function parseQty(value: string | number | null | undefined): number {
  return Number(value ?? 0);
}

type DraftDocumentLineInput = {
  documentLineId?: string | null;
  lineNo: number;
  articleId?: string | null;
  articleTextSnapshot?: string | null;
  langText?: string | null;
  langTextSourceEntity?: string | null;
  langTextSourceId?: string | null;
  langTextSourceField?: string | null;
  langTextLinkedAt?: string | null;
  langTextOverriddenAt?: string | null;
  quantity: string | number;
  unit?: string | null;
  netPrice: string | number;
  discountPercentage?: string | number | null;
  taxCodeId?: string | null;
  taxAmount?: string | number | null;
  lineTotalNet?: string | number | null;
  warehouseId?: string | null;
  costCenterId?: string | null;
  movementType?: string | null;
  lineType?: string | null;
  bomGroupId?: string | null;
  archived?: boolean;
};

type SaveDocumentDraftInput = {
  documentId?: string | null;
  documentGroupId?: string | null;
  documentType?: string | null;
  documentDirection?: string | null;
  documentDate?: string | null;
  customerId?: string | null;
  billingAddress?: unknown;
  deliveryAddress?: unknown;
  deliveryAddressId?: string | null;
  customAttributes?: unknown;
  currencyId?: string | null;
  warehouseId?: string | null;
  paymentTermId?: string | null;
  shippingMethodId?: string | null;
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
  lines: DraftDocumentLineInput[];
};

type TrackingRowLike = {
  trackingId: string;
  documentLineId: string;
  serialNumberId: string | null;
  serialNo: string | null;
  batchNo: string | null;
  qty: string;
};

async function copyDocumentLineTrackingRowsBulk(
  tx: any,
  tenantId: string,
  linePairs: Array<{ sourceLineId: string; targetLineId: string }>,
) {
  if (linePairs.length === 0) return;

  const sourceLineIds = [...new Set(linePairs.map((pair) => pair.sourceLineId))];
  const trackingRows = await tx
    .select({
      documentLineId: documentLineTracking.documentLineId,
      serialNumberId: documentLineTracking.serialNumberId,
      serialNo: documentLineTracking.serialNo,
      batchNo: documentLineTracking.batchNo,
      qty: documentLineTracking.qty,
    })
    .from(documentLineTracking)
    .where(
      and(
        eq(documentLineTracking.tenantId, tenantId),
        inArray(documentLineTracking.documentLineId, sourceLineIds),
      ),
    )
    .orderBy(
      asc(documentLineTracking.documentLineId),
      asc(documentLineTracking.createdAt),
      asc(documentLineTracking.trackingId),
    );

  if (trackingRows.length === 0) return;

  const trackingBySource = new Map<string, typeof trackingRows>();
  for (const row of trackingRows) {
    const rows = trackingBySource.get(row.documentLineId) ?? [];
    rows.push(row);
    trackingBySource.set(row.documentLineId, rows);
  }

  const values: Array<{
    tenantId: string;
    documentLineId: string;
    serialNumberId: string | null;
    serialNo: string | null;
    batchNo: string | null;
    qty: string;
  }> = [];

  for (const pair of linePairs) {
    const rows = trackingBySource.get(pair.sourceLineId) ?? [];
    for (const row of rows) {
      values.push({
        tenantId,
        documentLineId: pair.targetLineId,
        serialNumberId: row.serialNumberId ?? null,
        serialNo: row.serialNo ?? null,
        batchNo: row.batchNo ?? null,
        qty: row.qty,
      });
    }
  }

  if (values.length > 0) {
    await tx.insert(documentLineTracking).values(values);
  }
}

type AuditRowLike = {
  documentId: string;
  parentDocumentId: string | null;
  stornoDocumentId: string | null;
  status: string;
  archivedAt: Date | string | null;
};

function deriveDocumentAuditContext(
  node: AuditRowLike,
  index: Map<string, Pick<AuditRowLike, "documentId" | "parentDocumentId" | "stornoDocumentId">>,
  currentDocumentId: string,
) {
  const parentExists = node.parentDocumentId ? index.has(node.parentDocumentId) : false;
  const stornoExists = node.stornoDocumentId ? index.has(node.stornoDocumentId) : false;
  const parentIsCurrent = node.parentDocumentId === currentDocumentId;
  const stornoIsCurrent = node.stornoDocumentId === currentDocumentId;

  const relationTags: string[] = [];
  if (node.documentId === currentDocumentId) relationTags.push("current");
  if (!node.parentDocumentId) relationTags.push("origin");
  if (node.parentDocumentId && parentExists) relationTags.push("derived");
  if (node.stornoDocumentId && stornoExists) relationTags.push("reversal");
  if (parentIsCurrent) relationTags.push("predecessor");
  if (stornoIsCurrent) relationTags.push("storno-source");
  if (node.status === "posted") relationTags.push("posted");
  if (node.archivedAt) relationTags.push("archived");

  return {
    relationTags,
    isCurrent: node.documentId === currentDocumentId,
    isOrigin: !node.parentDocumentId,
    isDerived: !!node.parentDocumentId,
    isStornoSource: !!node.stornoDocumentId,
    isStornoTarget: parentIsCurrent,
    isArchived: !!node.archivedAt,
  };
}

type DocumentPostingDoc = {
  documentId: string;
  companyId: string;
  documentType: string;
  documentNo: string;
  status: string;
  warehouseId: string | null;
  targetWarehouseId: string | null;
  customerId: string | null;
  postingDate: string | null;
  documentDate: string;
  documentGroupId: string | null;
  billingAddress: unknown;
  deliveryAddress: unknown;
  deliveryAddressId: string | null;
  customAttributes: unknown;
  noteText: string | null;
  noteTextSourceEntity: string | null;
  noteTextSourceId: string | null;
  noteTextSourceField: string | null;
  noteTextLinkedAt: string | Date | null;
  noteTextOverriddenAt: string | Date | null;
  preText: string | null;
  preTextSourceEntity: string | null;
  preTextSourceId: string | null;
  preTextSourceField: string | null;
  preTextLinkedAt: string | Date | null;
  preTextOverriddenAt: string | Date | null;
  postText: string | null;
  postTextSourceEntity: string | null;
  postTextSourceId: string | null;
  postTextSourceField: string | null;
  postTextLinkedAt: string | Date | null;
  postTextOverriddenAt: string | Date | null;
  stornoText: string | null;
  stornoTextSourceEntity: string | null;
  stornoTextSourceId: string | null;
  stornoTextSourceField: string | null;
  stornoTextLinkedAt: string | Date | null;
  stornoTextOverriddenAt: string | Date | null;
  paymentTermId: string | null;
  shippingMethodId: string | null;
  documentTypeId: string | null;
  transactionId: string;
};

type DocumentPostingLine = {
  documentLineId: string;
  articleId: string | null;
  lineType: string;
  warehouseId: string | null;
  quantity: string | number | null;
  netPrice: string | number | null;
  lineTotalNet: string | null;
  taxCodeId: string | null;
  costCenterId: string | null;
  bomGroupId: string | null;
  langText: string | null;
  langTextSourceEntity: string | null;
  langTextSourceId: string | null;
  langTextSourceField: string | null;
  langTextLinkedAt: string | Date | null;
  langTextOverriddenAt: string | Date | null;
};

type DocumentPostingLineWithArticle = DocumentPostingLine & {
  articleId: string;
};

type DocumentGroupAccountFallback = {
  defaultSalesAccountId: string | null;
  defaultCostAccountId: string | null;
} | null;

type JournalPostingContext = {
  lineContext: string;
  counterContext: string;
};

const JOURNAL_POSTING_CONTEXTS: Record<string, JournalPostingContext> = {
  R: { lineContext: "SALES_REVENUE", counterContext: "ACCOUNTS_RECEIVABLE" },
  G: { lineContext: "SALES_CREDIT", counterContext: "ACCOUNTS_RECEIVABLE" },
  r: { lineContext: "PURCHASE_COST", counterContext: "ACCOUNTS_PAYABLE" },
  g: { lineContext: "PURCHASE_CREDIT", counterContext: "ACCOUNTS_PAYABLE" },
};

function isOutboundFinancialMovement(movementType: string): boolean {
  return movementType === "R" || movementType === "G";
}

function resolveInventoryInitialQty(movementType: string, qty: number): string {
  if (movementType === "V") return String(qty);
  if (movementType === "A") return "0";
  if (["L", "R", "g", "E"].includes(movementType)) return String(-qty);
  return String(qty);
}

function resolveInventoryMovementQtyDelta(
  movementType: string,
  qty: number,
  stocktakeOnHandBefore: number,
): string {
  if (movementType === "V") return String(qty - stocktakeOnHandBefore);
  return String(["L", "R", "g", "E"].includes(movementType) ? -qty : qty);
}

function resolveInventoryBalanceSet(
  movementType: string,
  qty: number,
  lineNetPrice: number,
): Record<string, unknown> {
  const qtyExpr = sql`${qty}::numeric`;
  const lineNetPriceExpr = sql`${lineNetPrice}::numeric`;

  if (movementType === "L") {
    return {
      onHandQty: sql`${inventoryBalance.onHandQty} - ${qtyExpr}`,
      reservedQty: sql`${inventoryBalance.reservedQty} - ${qtyExpr}`,
      availableQty: sql`${inventoryBalance.onHandQty} - ${qtyExpr} - (${inventoryBalance.reservedQty} - ${qtyExpr}) + ${inventoryBalance.expectedPurchaseQty}`,
    };
  }

  if (movementType === "A") {
    return {
      reservedQty: sql`${inventoryBalance.reservedQty} + ${qtyExpr}`,
      availableQty: sql`${inventoryBalance.onHandQty} - (${inventoryBalance.reservedQty} + ${qtyExpr}) + ${inventoryBalance.expectedPurchaseQty}`,
    };
  }

  if (movementType === "R") {
    return {
      onHandQty: sql`${inventoryBalance.onHandQty} - ${qtyExpr}`,
      availableQty: sql`${inventoryBalance.onHandQty} - ${qtyExpr} - ${inventoryBalance.reservedQty} + ${inventoryBalance.expectedPurchaseQty}`,
    };
  }

  if (movementType === "G") {
    return {
      onHandQty: sql`${inventoryBalance.onHandQty} + ${qtyExpr}`,
      availableQty: sql`${inventoryBalance.onHandQty} + ${qtyExpr} - ${inventoryBalance.reservedQty} + ${inventoryBalance.expectedPurchaseQty}`,
    };
  }

  if (movementType === "b") {
    return {
      expectedPurchaseQty: sql`${inventoryBalance.expectedPurchaseQty} + ${qtyExpr}`,
      availableQty: sql`${inventoryBalance.onHandQty} - ${inventoryBalance.reservedQty} + (${inventoryBalance.expectedPurchaseQty} + ${qtyExpr})`,
    };
  }

  if (movementType === "l") {
    return {
      onHandQty: sql`${inventoryBalance.onHandQty} + ${qtyExpr}`,
      expectedPurchaseQty: sql`GREATEST(${inventoryBalance.expectedPurchaseQty} - ${qtyExpr}, 0)`,
      availableQty: sql`${inventoryBalance.onHandQty} + ${qtyExpr} - ${inventoryBalance.reservedQty} + GREATEST(${inventoryBalance.expectedPurchaseQty} - ${qtyExpr}, 0)`,
    };
  }

  if (movementType === "r") {
    return {
      onHandQty: sql`${inventoryBalance.onHandQty} + ${qtyExpr}`,
      expectedPurchaseQty: sql`GREATEST(${inventoryBalance.expectedPurchaseQty} - ${qtyExpr}, 0)`,
      availableQty: sql`${inventoryBalance.onHandQty} + ${qtyExpr} - ${inventoryBalance.reservedQty} + GREATEST(${inventoryBalance.expectedPurchaseQty} - ${qtyExpr}, 0)`,
      gldPurchase: sql`CASE WHEN (${inventoryBalance.onHandQty} + ${qtyExpr}) = 0 THEN 0
        ELSE (COALESCE(${inventoryBalance.gldPurchase}, 0) * ${inventoryBalance.onHandQty} + ${lineNetPriceExpr} * ${qtyExpr}) / NULLIF(${inventoryBalance.onHandQty} + ${qtyExpr}, 0)
        END`,
    };
  }

  if (movementType === "g") {
    return {
      onHandQty: sql`${inventoryBalance.onHandQty} - ${qtyExpr}`,
      availableQty: sql`${inventoryBalance.onHandQty} - ${qtyExpr} - ${inventoryBalance.reservedQty} + ${inventoryBalance.expectedPurchaseQty}`,
    };
  }

  if (movementType === "Z") {
    return {
      onHandQty: sql`${inventoryBalance.onHandQty} + ${qtyExpr}`,
      availableQty: sql`${inventoryBalance.onHandQty} + ${qtyExpr} - ${inventoryBalance.reservedQty} + ${inventoryBalance.expectedPurchaseQty}`,
    };
  }

  if (movementType === "E") {
    return {
      onHandQty: sql`${inventoryBalance.onHandQty} - ${qtyExpr}`,
      availableQty: sql`${inventoryBalance.onHandQty} - ${qtyExpr} - ${inventoryBalance.reservedQty} + ${inventoryBalance.expectedPurchaseQty}`,
    };
  }

  if (movementType === "V") {
    return {
      onHandQty: String(qty),
      availableQty: sql`${qty} - ${inventoryBalance.reservedQty} + ${inventoryBalance.expectedPurchaseQty}`,
    };
  }

  return {};
}

function resolveInventorySeedValues(
  movementType: string,
  qty: number,
): {
  onHandQty: string;
  reservedQty: string;
  availableQty: string;
} {
  const initialOnHand = resolveInventoryInitialQty(movementType, qty);
  return {
    onHandQty: movementType === "A" ? "0" : initialOnHand,
    reservedQty: movementType === "A" ? String(qty) : "0",
    availableQty: movementType === "A" ? String(-qty) : initialOnHand,
  };
}

async function loadLineTrackingRows(
  tx: any,
  tenantId: string,
  documentLineId: string,
): Promise<
  Array<{
    trackingId: string;
    documentLineId: string;
    serialNumberId: string | null;
    serialNo: string | null;
    batchNo: string | null;
    qty: string;
  }>
> {
  return await tx
    .select({
      trackingId: documentLineTracking.trackingId,
      documentLineId: documentLineTracking.documentLineId,
      serialNumberId: documentLineTracking.serialNumberId,
      serialNo: documentLineTracking.serialNo,
      batchNo: documentLineTracking.batchNo,
      qty: documentLineTracking.qty,
    })
    .from(documentLineTracking)
    .where(
      and(
        eq(documentLineTracking.tenantId, tenantId),
        eq(documentLineTracking.documentLineId, documentLineId),
      ),
    )
    .orderBy(asc(documentLineTracking.createdAt), asc(documentLineTracking.trackingId));
}

async function loadTrackingRowsByLineIds(
  tx: any,
  tenantId: string,
  documentLineIds: string[],
): Promise<Map<string, TrackingRowLike[]>> {
  if (documentLineIds.length === 0) return new Map();

  const rows = await tx
    .select({
      trackingId: documentLineTracking.trackingId,
      documentLineId: documentLineTracking.documentLineId,
      serialNumberId: documentLineTracking.serialNumberId,
      serialNo: documentLineTracking.serialNo,
      batchNo: documentLineTracking.batchNo,
      qty: documentLineTracking.qty,
    })
    .from(documentLineTracking)
    .where(
      and(
        eq(documentLineTracking.tenantId, tenantId),
        inArray(documentLineTracking.documentLineId, documentLineIds),
      ),
    )
    .orderBy(
      asc(documentLineTracking.documentLineId),
      asc(documentLineTracking.createdAt),
      asc(documentLineTracking.trackingId),
    );

  const byLine = new Map<string, TrackingRowLike[]>();
  for (const row of rows) {
    const current = byLine.get(row.documentLineId) ?? [];
    current.push(row);
    byLine.set(row.documentLineId, current);
  }

  return byLine;
}

async function loadActiveDocumentLines(
  tx: any,
  tenantId: string,
  documentId: string,
): Promise<any[]> {
  return await tx
    .select()
    .from(documentLine)
    .where(
      and(
        eq(documentLine.documentId, documentId),
        eq(documentLine.tenantId, tenantId),
        isNull(documentLine.archivedAt),
      ),
    )
    .orderBy(asc(documentLine.lineNo));
}

async function applyTrackingForMovementFromRows(
  tx: any,
  tenantId: string,
  movementId: string,
  line: Pick<DocumentPostingLineWithArticle, "documentLineId" | "articleId" | "lineType">,
  docMovementType: string,
  trackingRows: Array<{
    trackingId: string;
    documentLineId: string;
    serialNumberId: string | null;
    serialNo: string | null;
    batchNo: string | null;
    qty: string;
  }>,
) {
  if (trackingRows.length === 0) return;

  const tracking = trackingRows[0];
  if (tracking.batchNo) {
    await tx
      .update(inventoryMovement)
      .set({ batchNo: tracking.batchNo })
      .where(eq(inventoryMovement.inventoryMovementId, movementId));
    return;
  }

  const lifecycle = resolveSerialLifecycle(docMovementType, line.lineType);

  if (tracking.serialNo) {
    const [createdSerial] = await tx
      .insert(serialNumber)
      .values({
        tenantId,
        articleId: line.articleId!,
        serialNo: tracking.serialNo,
        status: lifecycle.status,
        createdMovementId: lifecycle.movementLink === "createdMovementId" ? movementId : null,
        consumedMovementId: lifecycle.movementLink === "consumedMovementId" ? movementId : null,
      })
      .returning({ serialNumberId: serialNumber.serialNumberId });

    if (createdSerial?.serialNumberId) {
      await tx
        .update(inventoryMovement)
        .set({ serialNumberId: createdSerial.serialNumberId })
        .where(eq(inventoryMovement.inventoryMovementId, movementId));
    }
    return;
  }

  if (tracking.serialNumberId) {
    const serialUpdate: Record<string, unknown> = {
      status: lifecycle.status,
    };

    if (lifecycle.movementLink === "createdMovementId") {
      serialUpdate.createdMovementId = movementId;
    } else if (lifecycle.movementLink === "consumedMovementId") {
      serialUpdate.consumedMovementId = movementId;
    }

    await tx
      .update(serialNumber)
      .set(serialUpdate)
      .where(
        and(
          eq(serialNumber.tenantId, tenantId),
          eq(serialNumber.serialNumberId, tracking.serialNumberId),
        ),
      );

    await tx
      .update(inventoryMovement)
      .set({ serialNumberId: tracking.serialNumberId })
      .where(eq(inventoryMovement.inventoryMovementId, movementId));
  }
}

async function getDocumentGroupAccountFallback(
  tx: any,
  tenantId: string,
  documentGroupId: string | null,
): Promise<DocumentGroupAccountFallback> {
  if (!documentGroupId) return null;

  const [docGroup] = await tx
    .select({
      defaultSalesAccountId: documentGroup.defaultSalesAccountId,
      defaultCostAccountId: documentGroup.defaultCostAccountId,
    })
    .from(documentGroup)
    .where(
      and(eq(documentGroup.documentGroupId, documentGroupId), eq(documentGroup.tenantId, tenantId)),
    )
    .limit(1);

  return docGroup ?? null;
}

async function resolveJournalGlAccount(
  tx: any,
  tenantId: string,
  postingContext: string,
  articleGroupId: string | null,
  taxCodeId: string | null,
  docGroup: DocumentGroupAccountFallback,
  movementType: string,
): Promise<string | null> {
  try {
    if (articleGroupId || taxCodeId) {
      const rules = await tx
        .select({ glAccountId: accountDeterminationRule.glAccountId })
        .from(accountDeterminationRule)
        .where(
          and(
            eq(accountDeterminationRule.tenantId, tenantId),
            eq(accountDeterminationRule.postingContext, postingContext),
            articleGroupId
              ? eq(accountDeterminationRule.articleGroupId, articleGroupId)
              : sql`${accountDeterminationRule.articleGroupId} IS NULL`,
            taxCodeId
              ? eq(accountDeterminationRule.taxCodeId, taxCodeId)
              : sql`${accountDeterminationRule.taxCodeId} IS NULL`,
          ),
        )
        .limit(1);
      if (rules[0]?.glAccountId) return rules[0].glAccountId;
    }

    const fallbackRules = await tx
      .select({ glAccountId: accountDeterminationRule.glAccountId })
      .from(accountDeterminationRule)
      .where(
        and(
          eq(accountDeterminationRule.tenantId, tenantId),
          eq(accountDeterminationRule.postingContext, postingContext),
          sql`${accountDeterminationRule.articleGroupId} IS NULL`,
          sql`${accountDeterminationRule.taxCodeId} IS NULL`,
        ),
      )
      .limit(1);
    if (fallbackRules[0]?.glAccountId) return fallbackRules[0].glAccountId;

    if (docGroup) {
      if (isOutboundFinancialMovement(movementType) && docGroup.defaultSalesAccountId) {
        return docGroup.defaultSalesAccountId;
      }
      if (!isOutboundFinancialMovement(movementType) && docGroup.defaultCostAccountId) {
        return docGroup.defaultCostAccountId;
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function postFinancialJournalEntries(
  tx: any,
  tenantId: string,
  doc: DocumentPostingDoc,
  movementType: string,
  lines: DocumentPostingLine[],
) {
  const journalContexts = JOURNAL_POSTING_CONTEXTS[movementType];
  if (!journalContexts) return;

  const docGroup = await getDocumentGroupAccountFallback(tx, tenantId, doc.documentGroupId);
  const articleIds = [
    ...new Set(lines.map((line) => line.articleId).filter((id): id is string => !!id)),
  ];
  const articleGroupRows = articleIds.length
    ? await tx
        .select({
          articleId: article.articleId,
          articleGroupId: article.articleGroupId,
        })
        .from(article)
        .where(and(eq(article.tenantId, tenantId), inArray(article.articleId, articleIds)))
    : [];
  const articleGroupById = new Map<string, string | null>(
    (articleGroupRows as Array<{ articleId: string; articleGroupId: string | null }>).map((row) => [
      row.articleId,
      row.articleGroupId ?? null,
    ]),
  );
  const accountCache = new Map<string, string | null>();
  const counterGlAccountId = await resolveJournalGlAccount(
    tx,
    tenantId,
    journalContexts.counterContext,
    null,
    null,
    docGroup,
    movementType,
  );

  const journalLines: Array<{
    glAccountId: string;
    debitAmount: string;
    creditAmount: string;
    costCenterId: string | null;
    taxCodeId: string | null;
  }> = [];

  for (const line of lines) {
    const amount = Number(line.lineTotalNet ?? "0");
    if (!amount) continue;

    const absAmount = Math.abs(amount);
    const articleGroupId = line.articleId ? (articleGroupById.get(line.articleId) ?? null) : null;
    const cacheKey = `${journalContexts.lineContext}|${articleGroupId ?? ""}|${line.taxCodeId ?? ""}|${movementType}`;
    let lineGlAccountId = accountCache.get(cacheKey) ?? null;
    if (!accountCache.has(cacheKey)) {
      lineGlAccountId = await resolveJournalGlAccount(
        tx,
        tenantId,
        journalContexts.lineContext,
        articleGroupId,
        line.taxCodeId ?? null,
        docGroup,
        movementType,
      );
      accountCache.set(cacheKey, lineGlAccountId);
    }

    if (!lineGlAccountId) continue;

    const isOutbound = isOutboundFinancialMovement(movementType);
    journalLines.push({
      glAccountId: lineGlAccountId,
      debitAmount: isOutbound ? "0" : String(absAmount),
      creditAmount: isOutbound ? String(absAmount) : "0",
      costCenterId: line.costCenterId ?? null,
      taxCodeId: line.taxCodeId ?? null,
    });

    if (counterGlAccountId) {
      journalLines.push({
        glAccountId: counterGlAccountId,
        debitAmount: isOutbound ? String(absAmount) : "0",
        creditAmount: isOutbound ? "0" : String(absAmount),
        costCenterId: null,
        taxCodeId: null,
      });
    }
  }

  if (journalLines.length === 0) return;

  const postingDate = doc.postingDate ?? doc.documentDate;
  const [entry] = await tx
    .insert(journalEntry)
    .values({
      tenantId,
      companyId: doc.companyId,
      postingDate,
      sourceDocumentId: doc.documentId,
      description: doc.documentNo,
    })
    .returning({ journalEntryId: journalEntry.journalEntryId });

  await tx.insert(journalLine).values(
    journalLines.map((jl) => ({
      tenantId,
      companyId: doc.companyId,
      journalEntryId: entry.journalEntryId,
      glAccountId: jl.glAccountId,
      debitAmount: jl.debitAmount,
      creditAmount: jl.creditAmount,
      costCenterId: jl.costCenterId,
      taxCodeId: jl.taxCodeId,
    })),
  );
}

async function postProductionDocumentLine(
  tx: any,
  tenantId: string,
  doc: DocumentPostingDoc,
  line: DocumentPostingLineWithArticle,
  movementType: string,
  now: Date,
  txId: string,
  trackingRows: TrackingRowLike[],
) {
  const warehouseId = line.warehouseId ?? doc.warehouseId;
  if (!warehouseId) return;

  const qty = Number(line.quantity);
  const isComponent = line.lineType === "bom_component";
  const signedQty = isComponent ? -qty : qty;

  await tx
    .insert(inventoryBalance)
    .values({
      tenantId,
      companyId: doc.companyId,
      warehouseId,
      articleId: line.articleId,
      onHandQty: String(signedQty),
      reservedQty: "0",
      availableQty: String(signedQty),
    })
    .onConflictDoUpdate({
      target: [inventoryBalance.tenantId, inventoryBalance.warehouseId, inventoryBalance.articleId],
      set: {
        onHandQty: sql`${inventoryBalance.onHandQty} + ${signedQty}`,
        availableQty: sql`${inventoryBalance.onHandQty} + ${signedQty} - ${inventoryBalance.reservedQty}`,
      },
    });

  const [movement] = await tx
    .insert(inventoryMovement)
    .values({
      tenantId,
      companyId: doc.companyId,
      warehouseId,
      articleId: line.articleId,
      movementType,
      qtyDelta: String(signedQty),
      movementDate: now,
      sourceDocumentId: doc.documentId,
      sourceDocumentLineId: line.documentLineId,
      transactionId: txId,
      referenceText: doc.documentNo,
    })
    .returning({ inventoryMovementId: inventoryMovement.inventoryMovementId });

  if (movement?.inventoryMovementId) {
    await applyTrackingForMovementFromRows(
      tx,
      tenantId,
      movement.inventoryMovementId,
      line,
      movementType,
      trackingRows,
    );
  }
}

async function postTransferDocumentLine(
  tx: any,
  tenantId: string,
  doc: DocumentPostingDoc,
  line: DocumentPostingLineWithArticle,
  movementType: string,
  now: Date,
  txId: string,
  trackingRows: TrackingRowLike[],
) {
  const sourceWh = doc.warehouseId;
  const targetWh = doc.targetWarehouseId;
  if (!sourceWh || !targetWh) return;

  const qty = Number(line.quantity);

  await tx
    .insert(inventoryBalance)
    .values({
      tenantId,
      companyId: doc.companyId,
      warehouseId: sourceWh,
      articleId: line.articleId,
      onHandQty: String(-qty),
      reservedQty: "0",
      availableQty: String(-qty),
    })
    .onConflictDoUpdate({
      target: [inventoryBalance.tenantId, inventoryBalance.warehouseId, inventoryBalance.articleId],
      set: {
        onHandQty: sql`${inventoryBalance.onHandQty} - ${qty}`,
        availableQty: sql`${inventoryBalance.onHandQty} - ${qty} - ${inventoryBalance.reservedQty}`,
      },
    });

  await tx
    .insert(inventoryBalance)
    .values({
      tenantId,
      companyId: doc.companyId,
      warehouseId: targetWh,
      articleId: line.articleId,
      onHandQty: String(qty),
      reservedQty: "0",
      availableQty: String(qty),
    })
    .onConflictDoUpdate({
      target: [inventoryBalance.tenantId, inventoryBalance.warehouseId, inventoryBalance.articleId],
      set: {
        onHandQty: sql`${inventoryBalance.onHandQty} + ${qty}`,
        availableQty: sql`${inventoryBalance.onHandQty} + ${qty} - ${inventoryBalance.reservedQty}`,
      },
    });

  await tx.insert(inventoryMovement).values({
    tenantId,
    companyId: doc.companyId,
    warehouseId: sourceWh,
    articleId: line.articleId,
    movementType,
    qtyDelta: String(-qty),
    movementDate: now,
    sourceDocumentId: doc.documentId,
    sourceDocumentLineId: line.documentLineId,
    transactionId: txId,
    referenceText: doc.documentNo,
  });

  const [targetMovement] = await tx
    .insert(inventoryMovement)
    .values({
      tenantId,
      companyId: doc.companyId,
      warehouseId: targetWh,
      articleId: line.articleId,
      movementType,
      qtyDelta: String(qty),
      movementDate: now,
      sourceDocumentId: doc.documentId,
      sourceDocumentLineId: line.documentLineId,
      transactionId: txId,
      referenceText: doc.documentNo,
    })
    .returning({ inventoryMovementId: inventoryMovement.inventoryMovementId });

  const [sourceMovement] = await tx
    .select({ inventoryMovementId: inventoryMovement.inventoryMovementId })
    .from(inventoryMovement)
    .where(
      and(
        eq(inventoryMovement.tenantId, tenantId),
        eq(inventoryMovement.companyId, doc.companyId),
        eq(inventoryMovement.transactionId, txId),
        eq(inventoryMovement.warehouseId, sourceWh),
        eq(inventoryMovement.articleId, line.articleId),
      ),
    )
    .orderBy(asc(inventoryMovement.createdAt))
    .limit(1);

  const resolvedTrackingRows =
    trackingRows.length > 0
      ? trackingRows
      : await loadLineTrackingRows(tx, tenantId, line.documentLineId);
  if (resolvedTrackingRows.length === 0) return;

  const tracking = resolvedTrackingRows[0];
  const serialUpdate: Record<string, unknown> = {};
  if (tracking.batchNo) {
    serialUpdate.batchNo = tracking.batchNo;
  } else if (tracking.serialNumberId) {
    serialUpdate.serialNumberId = tracking.serialNumberId;
  } else if (tracking.serialNo) {
    const [createdSerial] = await tx
      .insert(serialNumber)
      .values({
        tenantId,
        articleId: line.articleId,
        serialNo: tracking.serialNo,
        status: "in_stock",
      })
      .onConflictDoNothing()
      .returning({ serialNumberId: serialNumber.serialNumberId });

    if (createdSerial?.serialNumberId) {
      serialUpdate.serialNumberId = createdSerial.serialNumberId;
    } else {
      const [existingSerial] = await tx
        .select({ serialNumberId: serialNumber.serialNumberId })
        .from(serialNumber)
        .where(
          and(
            eq(serialNumber.tenantId, tenantId),
            eq(serialNumber.articleId, line.articleId),
            eq(serialNumber.serialNo, tracking.serialNo),
          ),
        )
        .limit(1);

      if (existingSerial?.serialNumberId) {
        serialUpdate.serialNumberId = existingSerial.serialNumberId;
      }
    }
  }

  if (Object.keys(serialUpdate).length > 0) {
    if (sourceMovement?.inventoryMovementId) {
      await tx
        .update(inventoryMovement)
        .set(serialUpdate)
        .where(eq(inventoryMovement.inventoryMovementId, sourceMovement.inventoryMovementId));
    }
    if (targetMovement?.inventoryMovementId) {
      await tx
        .update(inventoryMovement)
        .set(serialUpdate)
        .where(eq(inventoryMovement.inventoryMovementId, targetMovement.inventoryMovementId));
    }
  }
}

async function postStandardDocumentLine(
  tx: any,
  tenantId: string,
  doc: DocumentPostingDoc,
  line: DocumentPostingLineWithArticle,
  movementType: string,
  now: Date,
  txId: string,
  trackingRows: TrackingRowLike[],
) {
  const warehouseId = line.warehouseId ?? doc.warehouseId;
  if (!warehouseId) return;

  const qty = Number(line.quantity);
  let stocktakeOnHandBefore = 0;
  if (movementType === "V") {
    const [balanceBefore] = await tx
      .select({
        onHandQty: inventoryBalance.onHandQty,
      })
      .from(inventoryBalance)
      .where(
        and(
          eq(inventoryBalance.tenantId, tenantId),
          eq(inventoryBalance.warehouseId, warehouseId),
          eq(inventoryBalance.articleId, line.articleId),
        ),
      )
      .limit(1);

    stocktakeOnHandBefore = Number(balanceBefore?.onHandQty ?? 0);
  }

  const lineNetPrice = Number(line.netPrice ?? 0);
  const balanceUpdate = resolveInventoryBalanceSet(movementType, qty, lineNetPrice);
  const seedValues = resolveInventorySeedValues(movementType, qty);
  const inventorySeedValues =
    movementType === "r"
      ? {
          ...seedValues,
          gldPurchase: String(lineNetPrice),
          gldCost: String(lineNetPrice),
        }
      : seedValues;

  await tx
    .insert(inventoryBalance)
    .values({
      tenantId,
      companyId: doc.companyId,
      warehouseId,
      articleId: line.articleId,
      ...inventorySeedValues,
    })
    .onConflictDoUpdate({
      target: [inventoryBalance.tenantId, inventoryBalance.warehouseId, inventoryBalance.articleId],
      set: balanceUpdate,
    });

  const [movement] = await tx
    .insert(inventoryMovement)
    .values({
      tenantId,
      companyId: doc.companyId,
      warehouseId,
      articleId: line.articleId,
      movementType,
      qtyDelta: resolveInventoryMovementQtyDelta(movementType, qty, stocktakeOnHandBefore),
      absoluteQty: movementType === "V" ? String(qty) : null,
      movementDate: now,
      sourceDocumentId: doc.documentId,
      sourceDocumentLineId: line.documentLineId,
      transactionId: txId,
      referenceText: doc.documentNo,
    })
    .returning({ inventoryMovementId: inventoryMovement.inventoryMovementId });

  if (movement?.inventoryMovementId) {
    await applyTrackingForMovementFromRows(
      tx,
      tenantId,
      movement.inventoryMovementId,
      line,
      movementType,
      trackingRows,
    );
  }

  if (movementType === "r") {
    const balances = await tx
      .select({
        onHandQty: inventoryBalance.onHandQty,
        gldPurchase: inventoryBalance.gldPurchase,
      })
      .from(inventoryBalance)
      .where(
        and(
          eq(inventoryBalance.tenantId, tenantId),
          eq(inventoryBalance.warehouseId, warehouseId),
          eq(inventoryBalance.articleId, line.articleId),
        ),
      )
      .limit(1);

    const currentQty = Number(balances[0]?.onHandQty ?? 0);
    const newAvgCost = Number(balances[0]?.gldPurchase ?? 0);
    const lineQty = qty;
    const linePrice = lineNetPrice;
    const avgCostBefore =
      currentQty > lineQty
        ? (currentQty * newAvgCost - lineQty * linePrice) / (currentQty - lineQty)
        : newAvgCost;

    await tx
      .update(inventoryBalance)
      .set({ gldCost: String(newAvgCost) })
      .where(
        and(
          eq(inventoryBalance.tenantId, tenantId),
          eq(inventoryBalance.warehouseId, warehouseId),
          eq(inventoryBalance.articleId, line.articleId),
        ),
      );

    const fiscalPeriodId = await resolveFiscalPeriodId(tenantId, doc.companyId, doc.documentDate);

    await tx.insert(factPurchaseEvent).values({
      tenantId,
      companyId: doc.companyId,
      sourceDocumentId: doc.documentId,
      sourceDocumentLineId: line.documentLineId,
      supplierId: doc.customerId,
      articleId: line.articleId,
      eventType: "purchase",
      quantityDelta: String(lineQty),
      amountNetDelta: String(lineQty * linePrice),
      avgCostBefore: String(avgCostBefore),
      avgCostAfter: String(newAvgCost),
      fiscalPeriodId,
      bookingPeriod: doc.documentDate,
    });
  }

  if (movementType === "g") {
    const balances = await tx
      .select({
        gldPurchase: inventoryBalance.gldPurchase,
      })
      .from(inventoryBalance)
      .where(
        and(
          eq(inventoryBalance.tenantId, tenantId),
          eq(inventoryBalance.warehouseId, warehouseId),
          eq(inventoryBalance.articleId, line.articleId),
        ),
      )
      .limit(1);

    const avgCost = Number(balances[0]?.gldPurchase ?? 0);
    const lineQty = qty;
    const linePrice = lineNetPrice;
    const fiscalPeriodId = await resolveFiscalPeriodId(tenantId, doc.companyId, doc.documentDate);

    await tx.insert(factPurchaseEvent).values({
      tenantId,
      companyId: doc.companyId,
      sourceDocumentId: doc.documentId,
      sourceDocumentLineId: line.documentLineId,
      supplierId: doc.customerId,
      articleId: line.articleId,
      eventType: "correction",
      quantityDelta: String(-lineQty),
      amountNetDelta: String(-(lineQty * linePrice)),
      avgCostBefore: String(avgCost),
      avgCostAfter: String(avgCost),
      fiscalPeriodId,
      bookingPeriod: doc.documentDate,
    });
  }

  if (movementType === "R" || movementType === "L") {
    let cogsDelta: string | null = null;
    let fiscalPeriodId: string | null = null;

    if (movementType === "R") {
      const balance = await tx
        .select({ gldPurchase: inventoryBalance.gldPurchase })
        .from(inventoryBalance)
        .where(
          and(
            eq(inventoryBalance.tenantId, tenantId),
            eq(inventoryBalance.warehouseId, warehouseId),
            eq(inventoryBalance.articleId, line.articleId),
          ),
        )
        .limit(1);

      const gldPurchase = Number(balance[0]?.gldPurchase ?? 0);
      cogsDelta = String(gldPurchase * Math.abs(qty));
      fiscalPeriodId = await resolveFiscalPeriodId(tenantId, doc.companyId, doc.documentDate);
    }

    await tx.insert(factSalesEvent).values({
      tenantId,
      companyId: doc.companyId,
      sourceDocumentId: doc.documentId,
      sourceDocumentLineId: line.documentLineId,
      customerId: doc.customerId,
      articleId: line.articleId,
      eventType: movementType === "R" ? "invoice" : "delivery",
      quantityDelta: String(-qty),
      amountNetDelta: line.lineTotalNet ?? "0",
      bookingPeriod: doc.documentDate,
      transactionId: txId,
      cogsDelta,
      fiscalPeriodId,
    });
  }
}

async function postDocumentLine(
  tx: any,
  tenantId: string,
  doc: DocumentPostingDoc,
  line: DocumentPostingLine,
  movementType: string,
  now: Date,
  txId: string,
  trackingRows: TrackingRowLike[],
) {
  if (!line.articleId) return;
  if (line.lineType === "sales_bom_header") return;
  if (movementType === "N" || movementType === "p") return;

  if (movementType === "q") {
    await postProductionDocumentLine(
      tx,
      tenantId,
      doc,
      line as DocumentPostingLineWithArticle,
      movementType,
      now,
      txId,
      trackingRows,
    );
    return;
  }

  if (movementType === "U") {
    await postTransferDocumentLine(
      tx,
      tenantId,
      doc,
      line as DocumentPostingLineWithArticle,
      movementType,
      now,
      txId,
      trackingRows,
    );
    return;
  }

  await postStandardDocumentLine(
    tx,
    tenantId,
    doc,
    line as DocumentPostingLineWithArticle,
    movementType,
    now,
    txId,
    trackingRows,
  );
}

export class DocumentService {
  async createDocumentLine(
    tenantId: string,
    data: {
      documentId: string;
      lineNo: number;
      articleId?: string | null;
      articleTextSnapshot?: string | null;
      langText?: string | null;
      langTextSourceEntity?: string | null;
      langTextSourceId?: string | null;
      langTextSourceField?: string | null;
      langTextLinkedAt?: string | null;
      langTextOverriddenAt?: string | null;
      quantity: string | number;
      unit?: string | null;
      netPrice: string | number;
      discountPercentage?: string | number | null;
      taxCodeId?: string | null;
      taxAmount?: string | number | null;
      lineTotalNet?: string | number | null;
      warehouseId?: string | null;
      costCenterId?: string | null;
      movementType?: string | null;
      lineType?: string | null;
      bomGroupId?: string | null;
    },
  ): Promise<unknown[]> {
    return await db.transaction(async (tx) => {
      const [doc] = await tx
        .select()
        .from(document)
        .where(and(eq(document.documentId, data.documentId), eq(document.tenantId, tenantId)))
        .limit(1);

      if (!doc) throw new Error("Document not found");

      const baseLine = {
        tenantId,
        documentId: data.documentId,
        lineNo: Number(data.lineNo),
        articleId: data.articleId ?? null,
        articleTextSnapshot: data.articleTextSnapshot ?? null,
        langText: data.langText ?? null,
        langTextSourceEntity: data.langTextSourceEntity ?? null,
        langTextSourceId: data.langTextSourceId ?? null,
        langTextSourceField: data.langTextSourceField ?? null,
        langTextLinkedAt: toDateOrNull(data.langTextLinkedAt),
        langTextOverriddenAt: toDateOrNull(data.langTextOverriddenAt),
        quantity: String(data.quantity),
        unit: data.unit ?? null,
        netPrice: String(data.netPrice),
        discountPercentage:
          data.discountPercentage != null ? String(data.discountPercentage) : null,
        taxCodeId: data.taxCodeId ?? null,
        taxAmount: data.taxAmount != null ? String(data.taxAmount) : null,
        lineTotalNet: data.lineTotalNet != null ? String(data.lineTotalNet) : null,
        warehouseId: data.warehouseId ?? doc.warehouseId ?? null,
        costCenterId: data.costCenterId ?? null,
        movementType: data.movementType ?? doc.documentType,
        lineType: data.lineType ?? "article",
        bomGroupId: data.bomGroupId ?? null,
        transactionId: crypto.randomUUID(),
      };

      if (!baseLine.articleId || baseLine.lineType !== "article") {
        return await tx.insert(documentLine).values(baseLine).returning();
      }

      const [lineArticle] = await tx
        .select({
          bomType: article.bomType,
        })
        .from(article)
        .where(and(eq(article.articleId, baseLine.articleId), eq(article.tenantId, tenantId)))
        .limit(1);

      const shouldExpandSalesBom =
        lineArticle?.bomType === "sales" && ["N", "A", "L", "R", "G"].includes(doc.documentType);
      const shouldExpandProductionBom =
        lineArticle?.bomType === "production" && ["q", "p"].includes(doc.documentType);

      if (!shouldExpandSalesBom && !shouldExpandProductionBom) {
        return await tx.insert(documentLine).values(baseLine).returning();
      }

      const bomHeaderLineType = shouldExpandProductionBom
        ? "production_output"
        : "sales_bom_header";

      const bomBaseUnit = alias(unit, "bom_base_unit");
      const bomSalesUnit = alias(unit, "bom_sales_unit");

      const components = await tx
        .select({
          componentArticleId: articleBom.componentArticleId,
          quantity: articleBom.quantity,
          scrapPercentage: articleBom.scrapPercentage,
          name: article.name,
          baseUnitCode: bomBaseUnit.code,
          salesUnitCode: bomSalesUnit.code,
        })
        .from(articleBom)
        .innerJoin(article, eq(article.articleId, articleBom.componentArticleId))
        .leftJoin(bomBaseUnit, eq(bomBaseUnit.unitId, article.baseUnitId))
        .leftJoin(bomSalesUnit, eq(bomSalesUnit.unitId, article.salesUnitId))
        .where(
          and(
            eq(articleBom.tenantId, tenantId),
            eq(articleBom.headerArticleId, baseLine.articleId),
            eq(articleBom.archived, false),
          ),
        )
        .orderBy(asc(articleBom.sortOrder));

      if (components.length === 0) {
        return await tx.insert(documentLine).values(baseLine).returning();
      }

      await tx.execute(sql`
        UPDATE ${documentLine}
        SET line_no = line_no + ${components.length}
        WHERE tenant_id = ${tenantId}
          AND document_id = ${data.documentId}
          AND line_no > ${baseLine.lineNo}
      `);

      const [insertedHeader] = await tx
        .insert(documentLine)
        .values({ ...baseLine, lineType: bomHeaderLineType })
        .returning();

      const parentQty = Number(baseLine.quantity);
      const insertedComponents = await tx
        .insert(documentLine)
        .values(
          components.map((component, index) => {
            const componentQty = Number(component.quantity);
            const scrapFactor = 1 + Number(component.scrapPercentage ?? 0) / 100;
            return {
              tenantId,
              documentId: data.documentId,
              lineNo: baseLine.lineNo + index + 1,
              articleId: component.componentArticleId,
              articleTextSnapshot: component.name,
              langText: null,
              langTextSourceEntity: null,
              langTextSourceId: null,
              langTextSourceField: null,
              langTextLinkedAt: null,
              langTextOverriddenAt: null,
              quantity: String(parentQty * componentQty * scrapFactor),
              unit: component.salesUnitCode ?? component.baseUnitCode ?? null,
              netPrice: "0",
              discountPercentage: null,
              taxCodeId: null,
              taxAmount: null,
              lineTotalNet: "0",
              warehouseId: baseLine.warehouseId,
              costCenterId: baseLine.costCenterId,
              movementType: doc.documentType,
              lineType: "bom_component",
              bomGroupId: baseLine.bomGroupId,
              transactionId: crypto.randomUUID(),
            };
          }),
        )
        .returning();

      return [insertedHeader, ...insertedComponents];
    });
  }

  async postDocument(
    documentId: string,
    userId: string,
    tenantId: string,
  ): Promise<{ success: boolean; document: unknown }> {
    const result = await db.transaction(async (tx) => {
      const [doc] = await tx
        .select()
        .from(document)
        .where(and(eq(document.documentId, documentId), eq(document.tenantId, tenantId)))
        .limit(1)
        .for("update");

      if (!doc) throw new Error("Document not found");
      if (doc.status !== "draft") throw new Error("Document must be in draft status to post");

      const lines = (await loadActiveDocumentLines(
        tx,
        tenantId,
        documentId,
      )) as DocumentPostingLine[];
      const lineIds = lines.map((line) => line.documentLineId);
      const trackingByLine = await loadTrackingRowsByLineIds(tx, tenantId, lineIds);
      const articleIds = [
        ...new Set(lines.map((line) => line.articleId).filter((id): id is string => !!id)),
      ];
      const articleRows = articleIds.length
        ? await tx
            .select({
              articleId: article.articleId,
              trackingMode: article.trackingMode,
            })
            .from(article)
            .where(and(eq(article.tenantId, tenantId), inArray(article.articleId, articleIds)))
        : [];
      const articleTrackingModeById = new Map(
        articleRows.map((row) => [row.articleId, row.trackingMode ?? null]),
      );
      const [docGroup] = doc.documentGroupId
        ? await tx
            .select({
              requireSerialTracking: documentGroup.requireSerialTracking,
              requireBatchTracking: documentGroup.requireBatchTracking,
            })
            .from(documentGroup)
            .where(
              and(
                eq(documentGroup.documentGroupId, doc.documentGroupId),
                eq(documentGroup.tenantId, tenantId),
              ),
            )
            .limit(1)
        : [null];

      if (docGroup?.requireSerialTracking || docGroup?.requireBatchTracking) {
        for (const line of lines) {
          if (!line.articleId || line.lineType === "comment") continue;
          const trackingMode = articleTrackingModeById.get(line.articleId) ?? null;
          if (!trackingMode) continue;

          const trackingRows = trackingByLine.get(line.documentLineId) ?? [];
          const trackingQty = trackingRows.reduce((sum, row) => sum + Number(row.qty ?? 0), 0);
          const expectedQty = Number(line.quantity ?? 0);

          if (
            docGroup.requireSerialTracking &&
            trackingMode === "serial" &&
            trackingQty !== expectedQty
          ) {
            throw new Error(`Line ${line.documentLineId} requires serial tracking before posting`);
          }

          if (
            docGroup.requireBatchTracking &&
            trackingMode === "batch" &&
            trackingQty !== expectedQty
          ) {
            throw new Error(`Line ${line.documentLineId} requires batch tracking before posting`);
          }
        }
      }

      const movementType = doc.documentType;
      const now = new Date();
      const txId = crypto.randomUUID();

      for (const line of lines) {
        const trackingRows = trackingByLine.get(line.documentLineId) ?? [];
        await postDocumentLine(
          tx,
          tenantId,
          doc as DocumentPostingDoc,
          line as DocumentPostingLine,
          movementType,
          now,
          txId,
          trackingRows,
        );
      }

      await postFinancialJournalEntries(
        tx,
        tenantId,
        doc as DocumentPostingDoc,
        movementType,
        lines as DocumentPostingLine[],
      );

      await tx
        .update(documentLine)
        .set({
          langTextSourceEntity: null,
          langTextSourceId: null,
          langTextSourceField: null,
          langTextLinkedAt: null,
        })
        .where(and(eq(documentLine.documentId, documentId), eq(documentLine.tenantId, tenantId)));

      const [updated] = await tx
        .update(document)
        .set({
          status: "posted",
          postedAt: now,
          postedBy: userId,
          updatedAt: now,
          noteTextSourceEntity: null,
          noteTextSourceId: null,
          noteTextSourceField: null,
          noteTextLinkedAt: null,
          preTextSourceEntity: null,
          preTextSourceId: null,
          preTextSourceField: null,
          preTextLinkedAt: null,
          postTextSourceEntity: null,
          postTextSourceId: null,
          postTextSourceField: null,
          postTextLinkedAt: null,
          stornoTextSourceEntity: null,
          stornoTextSourceId: null,
          stornoTextSourceField: null,
          stornoTextLinkedAt: null,
        })
        .where(and(eq(document.documentId, documentId), eq(document.tenantId, tenantId)))
        .returning();

      return { success: true, document: updated };
    });

    void refreshStatisticsMVs(tenantId).catch((error) => {
      console.error("Failed to refresh statistics materialized views", error);
    });

    return result;
  }

  async stornoDocument(
    documentId: string,
    userId: string,
    tenantId: string,
  ): Promise<{ success: boolean; stornoDocumentId: string }> {
    const [doc] = await db
      .select()
      .from(document)
      .where(and(eq(document.documentId, documentId), eq(document.tenantId, tenantId)))
      .limit(1);

    if (!doc) throw new Error("Document not found");
    if (doc.status !== "posted") throw new Error("Only posted documents can be reversed");
    if (!["R", "r"].includes(doc.documentType)) {
      throw new Error("Storno is only allowed for invoices (R) and purchase invoices (r)");
    }
    if (doc.stornoDocumentId) throw new Error("This document has already been reversed");

    const [newDoc] = await db.transaction(async (tx) => {
      const reversalTypeMap: Record<string, string> = {
        R: "G",
        r: "g",
      };
      const reversalType = reversalTypeMap[doc.documentType] ?? doc.documentType;
      const now = new Date();
      const stornoReason = (doc.customAttributes as any)?.stornoReason ?? "Storno";
      const generatedStornoText = [
        `<p><strong>Storno</strong> ${now.toISOString()}</p>`,
        `<p>Benutzer: ${userId}</p>`,
        `<p>Grund: ${String(stornoReason)}</p>`,
        `<p>Beleg: ${doc.documentNo}</p>`,
      ].join("");
      const lines = await loadActiveDocumentLines(tx, tenantId, documentId);

      let documentNo = `STORNO-${doc.documentNo}`;
      if (doc.documentGroupId) {
        const [grp] = await tx
          .select()
          .from(documentGroup)
          .where(
            and(
              eq(documentGroup.documentGroupId, doc.documentGroupId),
              eq(documentGroup.tenantId, tenantId),
            ),
          )
          .limit(1);

        if (grp?.numberSequenceId) {
          const [seq] = await tx
            .select()
            .from(numberSequence)
            .where(eq(numberSequence.numberSequenceId, grp.numberSequenceId))
            .limit(1)
            .for("update");
          if (seq) {
            documentNo = generateDocumentNo(seq.prefix, seq.nextValue, seq.padding);
            await tx
              .update(numberSequence)
              .set({ nextValue: seq.nextValue + 1, updatedAt: now })
              .where(eq(numberSequence.numberSequenceId, seq.numberSequenceId));
          }
        }
      }

      const [createdDoc] = await tx
        .insert(document)
        .values({
          tenantId,
          companyId: doc.companyId,
          documentType: reversalType,
          documentDirection: doc.documentDirection,
          documentNo,
          status: "draft",
          customerId: doc.customerId,
          currencyId: doc.currencyId,
          documentDate: doc.documentDate,
          postingDate: doc.postingDate,
          parentDocumentId: documentId,
          documentGroupId: doc.documentGroupId,
          billingAddress: doc.billingAddress,
          deliveryAddress: doc.deliveryAddress,
          deliveryAddressId: doc.deliveryAddressId,
          noteText: doc.noteText,
          noteTextSourceEntity: doc.noteTextSourceEntity,
          noteTextSourceId: doc.noteTextSourceId,
          noteTextSourceField: doc.noteTextSourceField,
          noteTextLinkedAt: toDateOrNull(doc.noteTextLinkedAt),
          noteTextOverriddenAt: toDateOrNull(doc.noteTextOverriddenAt),
          preText: doc.preText,
          preTextSourceEntity: doc.preTextSourceEntity,
          preTextSourceId: doc.preTextSourceId,
          preTextSourceField: doc.preTextSourceField,
          preTextLinkedAt: toDateOrNull(doc.preTextLinkedAt),
          preTextOverriddenAt: toDateOrNull(doc.preTextOverriddenAt),
          postText: doc.postText,
          postTextSourceEntity: doc.postTextSourceEntity,
          postTextSourceId: doc.postTextSourceId,
          postTextSourceField: doc.postTextSourceField,
          postTextLinkedAt: toDateOrNull(doc.postTextLinkedAt),
          postTextOverriddenAt: toDateOrNull(doc.postTextOverriddenAt),
          stornoText: generatedStornoText,
          stornoTextSourceEntity: null,
          stornoTextSourceId: null,
          stornoTextSourceField: null,
          stornoTextLinkedAt: null,
          stornoTextOverriddenAt: null,
          paymentTermId: doc.paymentTermId,
          shippingMethodId: doc.shippingMethodId,
          documentTypeId: doc.documentTypeId,
          warehouseId: doc.warehouseId,
          targetWarehouseId: doc.targetWarehouseId,
          transactionId: doc.transactionId,
        })
        .returning();

      const insertedLinePairs: Array<{ sourceLineId: string; targetLineId: string }> = [];

      for (const line of lines) {
        const l = line as any;
        const [insertedLine] = await tx
          .insert(documentLine)
          .values({
            tenantId,
            documentId: createdDoc.documentId,
            lineNo: l.lineNo,
            articleId: l.articleId,
            articleTextSnapshot: l.articleTextSnapshot,
            langText: l.langText,
            langTextSourceEntity: l.langTextSourceEntity,
            langTextSourceId: l.langTextSourceId,
            langTextSourceField: l.langTextSourceField,
            langTextLinkedAt: toDateOrNull(l.langTextLinkedAt),
            langTextOverriddenAt: toDateOrNull(l.langTextOverriddenAt),
            quantity: l.quantity,
            unit: l.unit,
            netPrice: l.netPrice,
            discountPercentage: l.discountPercentage,
            taxCodeId: l.taxCodeId,
            taxAmount: l.taxAmount,
            lineTotalNet: l.lineTotalNet,
            warehouseId: l.warehouseId,
            costCenterId: l.costCenterId,
            movementType: reversalType,
            lineType: l.lineType,
            bomGroupId: l.bomGroupId ?? null,
            transactionId: doc.transactionId,
          })
          .returning({ documentLineId: documentLine.documentLineId });

        if (insertedLine?.documentLineId) {
          insertedLinePairs.push({
            sourceLineId: line.documentLineId,
            targetLineId: insertedLine.documentLineId,
          });
        }
      }

      await copyDocumentLineTrackingRowsBulk(tx, tenantId, insertedLinePairs);

      await tx
        .update(document)
        .set({
          stornoDocumentId: createdDoc.documentId,
          updatedAt: now,
        })
        .where(and(eq(document.documentId, documentId), eq(document.tenantId, tenantId)));

      return [createdDoc];
    });

    return { success: true, stornoDocumentId: newDoc.documentId };
  }

  async getConversionCandidates(
    documentId: string,
    tenantId: string,
  ): Promise<
    Array<{ documentGroupId: string; name: string; documentType: string; groupNumber: number }>
  > {
    const [doc] = await db
      .select()
      .from(document)
      .where(and(eq(document.documentId, documentId), eq(document.tenantId, tenantId)))
      .limit(1);

    if (!doc) throw new Error("Document not found");
    if (!doc.documentGroupId) throw new Error("No conversion target: document has no group");

    const [sourceGroup] = await db
      .select()
      .from(documentGroup)
      .where(
        and(
          eq(documentGroup.documentGroupId, doc.documentGroupId),
          eq(documentGroup.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!sourceGroup) throw new Error("Source group not found");

    if (sourceGroup.nextGroupId) {
      const [targetGroup] = await db
        .select()
        .from(documentGroup)
        .where(
          and(
            eq(documentGroup.documentGroupId, sourceGroup.nextGroupId),
            eq(documentGroup.tenantId, tenantId),
          ),
        )
        .limit(1);
      if (!targetGroup) throw new Error("Configured next group not found");
      return [
        {
          documentGroupId: targetGroup.documentGroupId,
          name: targetGroup.name,
          documentType: targetGroup.documentType,
          groupNumber: targetGroup.groupNumber,
        },
      ];
    }

    const nextType = NEXT_TYPE[sourceGroup.documentType];
    if (!nextType) throw new Error("Keine weitere Wandlung möglich");

    const candidates = await db
      .select()
      .from(documentGroup)
      .where(
        and(
          eq(documentGroup.tenantId, tenantId),
          eq(documentGroup.documentType, nextType),
          eq(documentGroup.archived, false),
        ),
      );

    if (candidates.length === 0) throw new Error("Keine Zielgruppe gefunden");

    return candidates.map((g) => ({
      documentGroupId: g.documentGroupId,
      name: g.name,
      documentType: g.documentType,
      groupNumber: g.groupNumber,
    }));
  }

  async getDuplicateCandidates(
    documentId: string,
    tenantId: string,
  ): Promise<
    Array<{ documentGroupId: string; name: string; documentType: string; groupNumber: number }>
  > {
    const [doc] = await db
      .select()
      .from(document)
      .where(and(eq(document.documentId, documentId), eq(document.tenantId, tenantId)))
      .limit(1);

    if (!doc) throw new Error("Document not found");

    const [sourceGroup] = doc.documentGroupId
      ? await db
          .select()
          .from(documentGroup)
          .where(
            and(
              eq(documentGroup.documentGroupId, doc.documentGroupId),
              eq(documentGroup.tenantId, tenantId),
            ),
          )
          .limit(1)
      : [null];

    const sourceType = sourceGroup?.documentType ?? doc.documentType;
    const allowedTypes = resolveDuplicateTargetTypes(sourceType);
    if (allowedTypes.length === 0)
      throw new Error("No duplicate target: unable to resolve source document type");

    const candidates = await db
      .select()
      .from(documentGroup)
      .where(
        and(
          eq(documentGroup.tenantId, tenantId),
          inArray(documentGroup.documentType, allowedTypes),
          eq(documentGroup.archived, false),
        ),
      );

    return candidates
      .sort((a, b) => {
        const typeDelta =
          (TYPE_SEQUENCE[a.documentType] ?? 99) - (TYPE_SEQUENCE[b.documentType] ?? 99);
        if (typeDelta !== 0) return typeDelta;
        return a.groupNumber - b.groupNumber;
      })
      .map((g) => ({
        documentGroupId: g.documentGroupId,
        name: g.name,
        documentType: g.documentType,
        groupNumber: g.groupNumber,
      }));
  }

  async convertDocument(
    documentId: string,
    userId: string,
    tenantId: string,
    targetGroupId: string,
  ): Promise<{ success: boolean; newDocumentId: string }> {
    const [doc] = await db
      .select()
      .from(document)
      .where(and(eq(document.documentId, documentId), eq(document.tenantId, tenantId)))
      .limit(1);

    if (!doc) throw new Error("Document not found");
    if (doc.status === "cancelled" || doc.cancelledAt) {
      throw new Error("Cancelled documents cannot be converted");
    }

    const [targetGroup] = await db
      .select()
      .from(documentGroup)
      .where(
        and(eq(documentGroup.documentGroupId, targetGroupId), eq(documentGroup.tenantId, tenantId)),
      )
      .limit(1);

    if (!targetGroup) throw new Error("Target document group not found");

    return await db.transaction(async (tx) => {
      const lines = await loadActiveDocumentLines(tx, tenantId, documentId);
      const sourceLineById = new Map(lines.map((line) => [line.documentLineId, line]));
      let documentNo = `DRAFT-${Date.now()}`;
      const now = new Date();

      if (targetGroup.numberSequenceId) {
        const [seq] = await tx
          .select()
          .from(numberSequence)
          .where(eq(numberSequence.numberSequenceId, targetGroup.numberSequenceId))
          .limit(1)
          .for("update");

        if (seq) {
          documentNo = generateDocumentNo(seq.prefix, seq.nextValue, seq.padding);
          await tx
            .update(numberSequence)
            .set({ nextValue: seq.nextValue + 1, updatedAt: new Date() })
            .where(eq(numberSequence.numberSequenceId, seq.numberSequenceId));
        }
      }

      const [newDoc] = await tx
        .insert(document)
        .values({
          tenantId,
          companyId: doc.companyId,
          documentType: targetGroup.documentType,
          documentDirection: targetGroup.direction ?? doc.documentDirection,
          documentNo,
          status: "draft",
          customerId: doc.customerId,
          currencyId: doc.currencyId,
          documentDate: doc.documentDate,
          postingDate: doc.postingDate,
          parentDocumentId: documentId,
          documentGroupId: targetGroup.documentGroupId,
          billingAddress: doc.billingAddress,
          deliveryAddress: doc.deliveryAddress,
          deliveryAddressId: doc.deliveryAddressId,
          noteText: doc.noteText,
          noteTextSourceEntity: doc.noteTextSourceEntity,
          noteTextSourceId: doc.noteTextSourceId,
          noteTextSourceField: doc.noteTextSourceField,
          noteTextLinkedAt: toDateOrNull(doc.noteTextLinkedAt),
          noteTextOverriddenAt: toDateOrNull(doc.noteTextOverriddenAt),
          preText: doc.preText,
          preTextSourceEntity: doc.preTextSourceEntity,
          preTextSourceId: doc.preTextSourceId,
          preTextSourceField: doc.preTextSourceField,
          preTextLinkedAt: toDateOrNull(doc.preTextLinkedAt),
          preTextOverriddenAt: toDateOrNull(doc.preTextOverriddenAt),
          postText: doc.postText,
          postTextSourceEntity: doc.postTextSourceEntity,
          postTextSourceId: doc.postTextSourceId,
          postTextSourceField: doc.postTextSourceField,
          postTextLinkedAt: toDateOrNull(doc.postTextLinkedAt),
          postTextOverriddenAt: toDateOrNull(doc.postTextOverriddenAt),
          stornoText: doc.stornoText,
          stornoTextSourceEntity: doc.stornoTextSourceEntity,
          stornoTextSourceId: doc.stornoTextSourceId,
          stornoTextSourceField: doc.stornoTextSourceField,
          stornoTextLinkedAt: toDateOrNull(doc.stornoTextLinkedAt),
          stornoTextOverriddenAt: toDateOrNull(doc.stornoTextOverriddenAt),
          customAttributes: doc.customAttributes,
          paymentTermId: doc.paymentTermId,
          shippingMethodId: doc.shippingMethodId,
          documentTypeId: doc.documentTypeId,
          warehouseId: targetGroup.defaultWarehouseId ?? doc.warehouseId,
          targetWarehouseId: doc.targetWarehouseId,
          transactionId: doc.transactionId,
        })
        .returning();

      const allocationRows = lines.length
        ? await tx
            .select({
              sourceDocumentLineId: documentLineAllocation.sourceDocumentLineId,
              allocatedQty: documentLineAllocation.allocatedQty,
            })
            .from(documentLineAllocation)
            .where(
              and(
                eq(documentLineAllocation.tenantId, tenantId),
                inArray(
                  documentLineAllocation.sourceDocumentLineId,
                  lines.map((l) => l.documentLineId),
                ),
              ),
            )
        : [];

      const allocationTotals = new Map<string, number>();
      for (const row of allocationRows) {
        const current = allocationTotals.get(row.sourceDocumentLineId) ?? 0;
        allocationTotals.set(row.sourceDocumentLineId, current + parseQty(row.allocatedQty));
      }

      const insertedLines: Array<{ sourceLineId: string; targetLineId: string }> = [];

      for (const line of lines) {
        const sourceQty = parseQty(line.quantity);
        const allocatedQty = allocationTotals.get(line.documentLineId) ?? 0;
        const remainingQty = Math.max(sourceQty - allocatedQty, 0);
        const shouldCopyAsIs = line.lineType === "comment";

        if (!shouldCopyAsIs && remainingQty <= 0) continue;

        const [insertedLine] = await tx
          .insert(documentLine)
          .values({
            tenantId,
            documentId: newDoc.documentId,
            lineNo: line.lineNo,
            articleId: line.articleId,
            articleTextSnapshot: line.articleTextSnapshot,
            langText: line.langText,
            langTextSourceEntity: line.langTextSourceEntity,
            langTextSourceId: line.langTextSourceId,
            langTextSourceField: line.langTextSourceField,
            langTextLinkedAt: toDateOrNull(line.langTextLinkedAt),
            langTextOverriddenAt: toDateOrNull(line.langTextOverriddenAt),
            quantity: shouldCopyAsIs ? line.quantity : String(remainingQty),
            unit: line.unit,
            netPrice: line.netPrice,
            discountPercentage: line.discountPercentage,
            taxCodeId: line.taxCodeId,
            lineTotalNet: line.lineTotalNet,
            warehouseId: line.warehouseId,
            costCenterId: line.costCenterId,
            movementType: targetGroup.documentType,
            lineType: line.lineType,
            bomGroupId: line.bomGroupId ?? null,
            transactionId: doc.transactionId,
          })
          .returning({ documentLineId: documentLine.documentLineId });

        if (insertedLine?.documentLineId) {
          insertedLines.push({
            sourceLineId: line.documentLineId,
            targetLineId: insertedLine.documentLineId,
          });
        }
      }

      const allocationInserts: Array<{
        tenantId: string;
        sourceDocumentLineId: string;
        targetDocumentLineId: string;
        allocatedQty: string;
      }> = [];

      for (const pair of insertedLines) {
        const sourceLine = sourceLineById.get(pair.sourceLineId);
        if (!sourceLine || sourceLine.lineType === "comment") continue;
        const sourceQty = parseQty(sourceLine.quantity);
        const allocatedQty = allocationTotals.get(sourceLine.documentLineId) ?? 0;
        const remainingQty = Math.max(sourceQty - allocatedQty, 0);
        allocationInserts.push({
          tenantId,
          sourceDocumentLineId: sourceLine.documentLineId,
          targetDocumentLineId: pair.targetLineId,
          allocatedQty: String(remainingQty),
        });
      }

      if (allocationInserts.length > 0) {
        await tx.insert(documentLineAllocation).values(allocationInserts);
      }

      await copyDocumentLineTrackingRowsBulk(tx, tenantId, insertedLines);

      await tx
        .update(document)
        .set({ status: "archived", archivedAt: now, updatedAt: now })
        .where(and(eq(document.documentId, documentId), eq(document.tenantId, tenantId)));

      if (insertedLines.length === 0) {
        throw new Error("No remaining lines to convert");
      }

      return { success: true, newDocumentId: newDoc.documentId };
    });
  }

  async getDocumentTree(tenantId: string, companyId?: string): Promise<TreeSection[]> {
    const conditions = [eq(documentGroup.tenantId, tenantId)];
    if (companyId) conditions.push(eq(documentGroup.companyId, companyId));

    const groups = await db
      .select()
      .from(documentGroup)
      .where(and(...conditions));

    // direction → documentType → groups[]
    const byDirection = new Map<string, Map<string, typeof groups>>();

    for (const g of groups) {
      const dir =
        g.direction && g.direction.length > 0
          ? g.direction
          : (DIRECTION_FROM_TYPE[g.documentType] ?? "OTHER");
      if (!byDirection.has(dir)) byDirection.set(dir, new Map());
      const byType = byDirection.get(dir)!;
      if (!byType.has(g.documentType)) byType.set(g.documentType, []);
      byType.get(g.documentType)!.push(g);
    }

    const buildTypes = (byType: Map<string, typeof groups>): TypeNode[] => {
      return [...byType.entries()]
        .sort(([ta], [tb]) => (TYPE_SEQUENCE[ta] ?? 99) - (TYPE_SEQUENCE[tb] ?? 99))
        .flatMap(([docType, typeGroups]) => {
          const sortedGroups = [...typeGroups]
            .filter((g) => g.groupNumber >= 0)
            .sort((a, b) => a.groupNumber - b.groupNumber);
          const mainGroup = sortedGroups.find((g) => g.groupNumber === 0);
          if (!mainGroup) return [];

          return [
            {
              documentType: docType,
              typeLabel: TYPE_LABELS[docType] ?? docType,
              mainGroup: {
                documentGroupId: mainGroup.documentGroupId,
                name: mainGroup.name,
                documentType: mainGroup.documentType,
                groupNumber: mainGroup.groupNumber,
              },
              groups: sortedGroups
                .filter((g) => g.groupNumber > 0)
                .map((g) => ({
                  documentGroupId: g.documentGroupId,
                  name: g.name,
                  documentType: g.documentType,
                  groupNumber: g.groupNumber,
                })),
            },
          ];
        });
    };

    const sections: TreeSection[] = [];
    const dirOrder = ["OUTBOUND", "INBOUND", "ADJUSTMENT", "PRODUCTION"];

    for (const dir of dirOrder) {
      const byType = byDirection.get(dir);
      if (!byType || byType.size === 0) continue;
      sections.push({ direction: dir, label: directionLabel(dir), types: buildTypes(byType) });
      byDirection.delete(dir);
    }

    for (const [dir, byType] of byDirection) {
      if (byType.size === 0) continue;
      sections.push({ direction: dir, label: directionLabel(dir), types: buildTypes(byType) });
    }

    return sections;
  }

  async getDocumentAuditTrail(documentId: string, tenantId: string): Promise<DocumentAuditTrail> {
    const [seed] = await db
      .select()
      .from(document)
      .where(and(eq(document.documentId, documentId), eq(document.tenantId, tenantId)))
      .limit(1);

    if (!seed) throw new Error("Document not found");

    const rowsById = new Map<string, typeof seed>();
    const knownIds = new Set<string>([seed.documentId]);
    const knownTransactionIds = new Set<string>([seed.transactionId]);
    let frontierExpanded = true;

    while (frontierExpanded) {
      frontierExpanded = false;
      const rows = await db
        .select()
        .from(document)
        .where(
          and(
            eq(document.tenantId, tenantId),
            or(
              inArray(document.transactionId, Array.from(knownTransactionIds)),
              inArray(document.parentDocumentId, Array.from(knownIds)),
              inArray(document.stornoDocumentId, Array.from(knownIds)),
            ),
          ),
        );

      for (const row of rows) {
        if (!rowsById.has(row.documentId)) {
          rowsById.set(row.documentId, row);
          frontierExpanded = true;
        }
        if (!knownIds.has(row.documentId)) {
          knownIds.add(row.documentId);
          frontierExpanded = true;
        }
        if (!knownTransactionIds.has(row.transactionId)) {
          knownTransactionIds.add(row.transactionId);
          frontierExpanded = true;
        }
      }
    }

    const nodesRaw = [...rowsById.values()].sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      if (aTime !== bTime) return aTime - bTime;
      return a.documentNo.localeCompare(b.documentNo) || a.documentId.localeCompare(b.documentId);
    });
    const index = new Map(
      nodesRaw.map((row) => [
        row.documentId,
        {
          documentId: row.documentId,
          parentDocumentId: row.parentDocumentId ?? null,
          stornoDocumentId: row.stornoDocumentId ?? null,
        },
      ]),
    );

    const nodes: DocumentAuditNode[] = nodesRaw.map((row) => {
      const context = deriveDocumentAuditContext(row, index, seed.documentId);
      return {
        documentId: row.documentId,
        documentNo: row.documentNo,
        documentType: row.documentType,
        documentDirection: row.documentDirection,
        status: row.status,
        documentGroupId: row.documentGroupId ?? null,
        transactionId: row.transactionId,
        parentDocumentId: row.parentDocumentId ?? null,
        stornoDocumentId: row.stornoDocumentId ?? null,
        documentDate: row.documentDate,
        postedAt: row.postedAt ? row.postedAt.toISOString() : null,
        cancelledAt: row.cancelledAt ? row.cancelledAt.toISOString() : null,
        archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
        createdAt: row.createdAt ? row.createdAt.toISOString() : new Date(0).toISOString(),
        updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
        ...context,
      };
    });

    const links: DocumentAuditLink[] = [];
    const seenLinks = new Set<string>();
    for (const node of nodes) {
      if (node.parentDocumentId && knownIds.has(node.parentDocumentId)) {
        const key = `${node.parentDocumentId}->${node.documentId}:conversion`;
        if (!seenLinks.has(key)) {
          seenLinks.add(key);
          links.push({
            fromDocumentId: node.parentDocumentId,
            toDocumentId: node.documentId,
            relationType: "conversion",
          });
        }
      }
      if (node.stornoDocumentId && knownIds.has(node.stornoDocumentId)) {
        const key = `${node.documentId}->${node.stornoDocumentId}:storno`;
        if (!seenLinks.has(key)) {
          seenLinks.add(key);
          links.push({
            fromDocumentId: node.documentId,
            toDocumentId: node.stornoDocumentId,
            relationType: "storno",
          });
        }
      }
    }

    const productionFacts = await this.getProductionFactTrace(documentId, tenantId);

    return {
      currentDocumentId: seed.documentId,
      transactionId: seed.transactionId,
      nodes,
      links,
      productionFacts,
    };
  }

  async getProductionFactTrace(
    documentId: string,
    tenantId: string,
  ): Promise<ProductionFactTraceRow[]> {
    const [doc] = await db
      .select()
      .from(document)
      .where(and(eq(document.documentId, documentId), eq(document.tenantId, tenantId)))
      .limit(1);

    if (!doc) throw new Error("Document not found");
    if (doc.documentType !== "q") return [];

    const [lines, movements] = await Promise.all([
      db
        .select()
        .from(documentLine)
        .where(and(eq(documentLine.documentId, documentId), eq(documentLine.tenantId, tenantId)))
        .orderBy(asc(documentLine.lineNo)),
      db
        .select()
        .from(inventoryMovement)
        .where(
          and(
            eq(inventoryMovement.sourceDocumentId, documentId),
            eq(inventoryMovement.tenantId, tenantId),
            eq(inventoryMovement.referenceText, doc.documentNo),
          ),
        )
        .orderBy(asc(inventoryMovement.createdAt), asc(inventoryMovement.inventoryMovementId)),
    ]);

    const movementByLineId = new Map<string, (typeof movements)[number]>();
    for (const movement of movements) {
      if (!movement.sourceDocumentLineId) continue;
      if (!movementByLineId.has(movement.sourceDocumentLineId)) {
        movementByLineId.set(movement.sourceDocumentLineId, movement);
      }
    }

    return lines
      .filter((line) => line.articleId && line.lineType !== "comment")
      .map((line) => {
        const isInput = line.lineType === "bom_component";
        const movement = movementByLineId.get(line.documentLineId) ?? null;
        const expectedQty = Number(line.quantity ?? 0);
        const expectedMovementQty = isInput ? -expectedQty : expectedQty;
        const movementQty = Number(movement?.qtyDelta ?? expectedMovementQty);
        const varianceQty = movementQty - expectedMovementQty;

        return {
          documentLineId: line.documentLineId,
          sourceDocumentLineId: line.documentLineId,
          lineNo: Number(line.lineNo ?? 0),
          lineType: line.lineType,
          articleId: line.articleId ?? null,
          articleTextSnapshot: line.articleTextSnapshot ?? null,
          warehouseId: line.warehouseId ?? doc.warehouseId ?? null,
          side: isInput ? "input" : "output",
          expectedQty: String(expectedMovementQty),
          movementQty: String(movementQty),
          varianceQty: String(varianceQty),
          inventoryMovementId: movement?.inventoryMovementId ?? null,
          referenceText: movement?.referenceText ?? doc.documentNo,
        };
      });
  }

  async resolveArticlePricing(
    articleId: string,
    customerId: string | null,
    documentDate: string,
    tenantId: string,
  ): Promise<{ unitPrice: string; taxCodeId: string | null }> {
    const [art] = await db
      .select()
      .from(article)
      .where(and(eq(article.articleId, articleId), eq(article.tenantId, tenantId)))
      .limit(1);

    if (!art) throw new Error("Article not found");

    if (customerId) {
      const activeLists = await db
        .select({ priceListId: priceList.priceListId })
        .from(priceList)
        .where(and(eq(priceList.tenantId, tenantId), eq(priceList.archived, false)));

      if (activeLists.length > 0) {
        const priceListIds = activeLists.map((p) => p.priceListId);
        const [item] = await db
          .select()
          .from(priceListItem)
          .where(
            and(
              eq(priceListItem.tenantId, tenantId),
              eq(priceListItem.articleId, articleId),
              inArray(priceListItem.priceListId, priceListIds),
            ),
          )
          .limit(1);

        if (item) {
          return { unitPrice: item.price, taxCodeId: art.taxClassId ?? null };
        }
      }
    }

    return { unitPrice: "0", taxCodeId: art.taxClassId ?? null };
  }

  async applyDeltaEffect(
    documentLineId: string,
    qtyDelta: number,
    userId: string,
    tenantId: string,
  ): Promise<{ success: boolean }> {
    return await db.transaction(async (tx) => {
      const [line] = await tx
        .select()
        .from(documentLine)
        .where(
          and(eq(documentLine.documentLineId, documentLineId), eq(documentLine.tenantId, tenantId)),
        )
        .limit(1);

      if (!line) throw new Error("Document line not found");

      const [doc] = await tx
        .select()
        .from(document)
        .where(and(eq(document.documentId, line.documentId), eq(document.tenantId, tenantId)))
        .limit(1);

      if (!doc) throw new Error("Parent document not found");

      const warehouseId = line.warehouseId ?? doc.warehouseId;
      if (!warehouseId || !line.articleId) return { success: true };

      const movementType = (line.movementType ?? doc.documentType) as string;
      const now = new Date();

      const isNegative = ["L", "R", "g", "E"].includes(movementType);
      const effectiveQty = isNegative ? -qtyDelta : qtyDelta;

      await tx
        .insert(inventoryBalance)
        .values({
          tenantId,
          companyId: doc.companyId,
          warehouseId,
          articleId: line.articleId,
          onHandQty: String(effectiveQty),
          reservedQty: "0",
          availableQty: String(effectiveQty),
        })
        .onConflictDoUpdate({
          target: [
            inventoryBalance.tenantId,
            inventoryBalance.warehouseId,
            inventoryBalance.articleId,
          ],
          set: {
            onHandQty: sql`${inventoryBalance.onHandQty} + ${effectiveQty}`,
            availableQty: sql`${inventoryBalance.onHandQty} + ${effectiveQty} - ${inventoryBalance.reservedQty}`,
          },
        });

      await tx.insert(inventoryMovement).values({
        tenantId,
        companyId: doc.companyId,
        warehouseId,
        articleId: line.articleId,
        movementType,
        qtyDelta: String(effectiveQty),
        movementDate: now,
        sourceDocumentId: doc.documentId,
        sourceDocumentLineId: documentLineId,
        referenceText: `delta:${doc.documentNo}`,
      });

      return { success: true };
    });
  }

  async saveDocumentDraft(
    tenantId: string,
    _userId: string,
    data: SaveDocumentDraftInput,
  ): Promise<{ success: boolean; documentId: string; documentNo: string }> {
    return await db.transaction(async (tx) => {
      const now = new Date();
      const existingDocId = data.documentId ?? null;
      const providedLines = data.lines ?? [];

      let docRecord: {
        documentId: string;
        documentNo: string;
        companyId: string;
        documentGroupId: string | null;
        documentType: string;
        documentDirection: string;
        transactionId: string;
        status: string;
        parentDocumentId: string | null;
      } | null = null;

      if (existingDocId) {
        const [lockedDoc] = await tx
          .select()
          .from(document)
          .where(and(eq(document.documentId, existingDocId), eq(document.tenantId, tenantId)))
          .limit(1)
          .for("update");

        if (!lockedDoc) throw new Error("Document not found");
        if (lockedDoc.status !== "draft")
          throw new Error("Document must be in draft status to save");

        docRecord = lockedDoc;

        const archivedLineIds = providedLines
          .filter((line) => line.archived)
          .map((line) => line.documentLineId)
          .filter((lineId): lineId is string => !!lineId);

        const activeLinePayload = providedLines.filter((line) => !line.archived);
        const activePayloadLineIds = activeLinePayload
          .map((line) => line.documentLineId)
          .filter((lineId): lineId is string => !!lineId);

        const existingLines = await tx
          .select({
            documentLineId: documentLine.documentLineId,
            lineNo: documentLine.lineNo,
            articleId: documentLine.articleId,
            lineType: documentLine.lineType,
          })
          .from(documentLine)
          .where(
            and(
              eq(documentLine.documentId, existingDocId),
              eq(documentLine.tenantId, tenantId),
              isNull(documentLine.archivedAt),
            ),
          );

        const existingLineIds = existingLines.map((line) => line.documentLineId);
        const linesToArchive = new Set<string>(
          [...existingLineIds, ...archivedLineIds].filter(Boolean),
        );
        for (const lineId of activePayloadLineIds) {
          linesToArchive.delete(lineId);
        }

        if (linesToArchive.size > 0) {
          await tx
            .update(documentLine)
            .set({ archivedAt: now })
            .where(
              and(
                eq(documentLine.tenantId, tenantId),
                eq(documentLine.documentId, existingDocId),
                inArray(documentLine.documentLineId, [...linesToArchive]),
              ),
            );
        }

        const existingLineById = new Map(existingLines.map((line) => [line.documentLineId, line]));

        const updateValues: Array<{
          documentLineId: string;
          lineNo: number;
          articleId: string | null;
          articleTextSnapshot: string | null;
          langText: string | null;
          langTextSourceEntity: string | null;
          langTextSourceId: string | null;
          langTextSourceField: string | null;
          langTextLinkedAt: Date | null;
          langTextOverriddenAt: Date | null;
          quantity: string;
          unit: string | null;
          netPrice: string;
          discountPercentage: string | null;
          taxCodeId: string | null;
          taxAmount: string | null;
          lineTotalNet: string | null;
          warehouseId: string | null;
          costCenterId: string | null;
          movementType: string | null;
          lineType: string;
          bomGroupId: string | null;
        }> = [];

        const insertValues: Array<{
          tenantId: string;
          documentId: string;
          lineNo: number;
          articleId: string | null;
          articleTextSnapshot: string | null;
          langText: string | null;
          langTextSourceEntity: string | null;
          langTextSourceId: string | null;
          langTextSourceField: string | null;
          langTextLinkedAt: Date | null;
          langTextOverriddenAt: Date | null;
          quantity: string;
          unit: string | null;
          netPrice: string;
          discountPercentage: string | null;
          taxCodeId: string | null;
          taxAmount: string | null;
          lineTotalNet: string | null;
          warehouseId: string | null;
          costCenterId: string | null;
          movementType: string | null;
          lineType: string;
          bomGroupId: string | null;
          transactionId: string;
        }> = [];

        for (const line of activeLinePayload) {
          const normalized = {
            lineNo: Number(line.lineNo),
            articleId: line.articleId ?? null,
            articleTextSnapshot: line.articleTextSnapshot ?? null,
            langText: line.langText ?? null,
            langTextSourceEntity: line.langTextSourceEntity ?? null,
            langTextSourceId: line.langTextSourceId ?? null,
            langTextSourceField: line.langTextSourceField ?? null,
            langTextLinkedAt: toDateOrNull(line.langTextLinkedAt),
            langTextOverriddenAt: toDateOrNull(line.langTextOverriddenAt),
            quantity: String(line.quantity),
            unit: line.unit ?? null,
            netPrice: String(line.netPrice),
            discountPercentage:
              line.discountPercentage != null ? String(line.discountPercentage) : null,
            taxCodeId: line.taxCodeId ?? null,
            taxAmount: line.taxAmount != null ? String(line.taxAmount) : null,
            lineTotalNet: line.lineTotalNet != null ? String(line.lineTotalNet) : null,
            warehouseId: line.warehouseId ?? null,
            costCenterId: line.costCenterId ?? null,
            movementType: line.movementType ?? docRecord.documentType,
            lineType: line.lineType ?? "article",
            bomGroupId: line.bomGroupId ?? null,
          };

          if (line.documentLineId && existingLineById.has(line.documentLineId)) {
            updateValues.push({ documentLineId: line.documentLineId, ...normalized });
          } else {
            insertValues.push({
              tenantId,
              documentId: existingDocId,
              transactionId: docRecord.transactionId,
              ...normalized,
            });
          }
        }

        for (const row of updateValues) {
          await tx
            .update(documentLine)
            .set({
              lineNo: row.lineNo,
              articleId: row.articleId,
              articleTextSnapshot: row.articleTextSnapshot,
              langText: row.langText,
              langTextSourceEntity: row.langTextSourceEntity,
              langTextSourceId: row.langTextSourceId,
              langTextSourceField: row.langTextSourceField,
              langTextLinkedAt: toDateOrNull(row.langTextLinkedAt),
              langTextOverriddenAt: toDateOrNull(row.langTextOverriddenAt),
              quantity: row.quantity,
              unit: row.unit,
              netPrice: row.netPrice,
              discountPercentage: row.discountPercentage,
              taxCodeId: row.taxCodeId,
              taxAmount: row.taxAmount,
              lineTotalNet: row.lineTotalNet,
              warehouseId: row.warehouseId,
              costCenterId: row.costCenterId,
              movementType: row.movementType,
              lineType: row.lineType,
              bomGroupId: row.bomGroupId,
              archivedAt: null,
            })
            .where(
              and(
                eq(documentLine.tenantId, tenantId),
                eq(documentLine.documentLineId, row.documentLineId),
              ),
            );
        }

        if (insertValues.length > 0) {
          await tx.insert(documentLine).values(insertValues);
        }

        const [updatedDoc] = await tx
          .update(document)
          .set({
            documentGroupId: data.documentGroupId ?? lockedDoc.documentGroupId,
            documentType: data.documentType ?? lockedDoc.documentType,
            documentDirection: data.documentDirection ?? lockedDoc.documentDirection,
            documentDate: data.documentDate ?? lockedDoc.documentDate,
            customerId: data.customerId ?? null,
            billingAddress: data.billingAddress ?? null,
            deliveryAddress: data.deliveryAddress ?? null,
            deliveryAddressId: data.deliveryAddressId ?? null,
            noteText: data.noteText ?? lockedDoc.noteText ?? null,
            noteTextSourceEntity:
              data.noteTextSourceEntity ?? lockedDoc.noteTextSourceEntity ?? null,
            noteTextSourceId: data.noteTextSourceId ?? lockedDoc.noteTextSourceId ?? null,
            noteTextSourceField: data.noteTextSourceField ?? lockedDoc.noteTextSourceField ?? null,
            noteTextLinkedAt: toDateOrNull(data.noteTextLinkedAt ?? lockedDoc.noteTextLinkedAt),
            noteTextOverriddenAt: toDateOrNull(
              data.noteTextOverriddenAt ?? lockedDoc.noteTextOverriddenAt,
            ),
            preText: data.preText ?? lockedDoc.preText ?? null,
            preTextSourceEntity: data.preTextSourceEntity ?? lockedDoc.preTextSourceEntity ?? null,
            preTextSourceId: data.preTextSourceId ?? lockedDoc.preTextSourceId ?? null,
            preTextSourceField: data.preTextSourceField ?? lockedDoc.preTextSourceField ?? null,
            preTextLinkedAt: toDateOrNull(data.preTextLinkedAt ?? lockedDoc.preTextLinkedAt),
            preTextOverriddenAt: toDateOrNull(
              data.preTextOverriddenAt ?? lockedDoc.preTextOverriddenAt,
            ),
            postText: data.postText ?? lockedDoc.postText ?? null,
            postTextSourceEntity:
              data.postTextSourceEntity ?? lockedDoc.postTextSourceEntity ?? null,
            postTextSourceId: data.postTextSourceId ?? lockedDoc.postTextSourceId ?? null,
            postTextSourceField: data.postTextSourceField ?? lockedDoc.postTextSourceField ?? null,
            postTextLinkedAt: toDateOrNull(data.postTextLinkedAt ?? lockedDoc.postTextLinkedAt),
            postTextOverriddenAt: toDateOrNull(
              data.postTextOverriddenAt ?? lockedDoc.postTextOverriddenAt,
            ),
            stornoText: data.stornoText ?? lockedDoc.stornoText ?? null,
            stornoTextSourceEntity:
              data.stornoTextSourceEntity ?? lockedDoc.stornoTextSourceEntity ?? null,
            stornoTextSourceId: data.stornoTextSourceId ?? lockedDoc.stornoTextSourceId ?? null,
            stornoTextSourceField:
              data.stornoTextSourceField ?? lockedDoc.stornoTextSourceField ?? null,
            stornoTextLinkedAt: toDateOrNull(
              data.stornoTextLinkedAt ?? lockedDoc.stornoTextLinkedAt,
            ),
            stornoTextOverriddenAt: toDateOrNull(
              data.stornoTextOverriddenAt ?? lockedDoc.stornoTextOverriddenAt,
            ),
            customAttributes: data.customAttributes ?? null,
            currencyId: await resolveCurrencyCode(tx, data.currencyId ?? null),
            warehouseId: data.warehouseId ?? lockedDoc.warehouseId,
            paymentTermId: data.paymentTermId ?? null,
            shippingMethodId: data.shippingMethodId ?? null,
            updatedAt: now,
          })
          .where(and(eq(document.documentId, existingDocId), eq(document.tenantId, tenantId)))
          .returning({ documentId: document.documentId, documentNo: document.documentNo });

        if (!updatedDoc) throw new Error("Document update failed");

        return {
          success: true,
          documentId: updatedDoc.documentId,
          documentNo: updatedDoc.documentNo,
        };
      }

      const [group] = await tx
        .select()
        .from(documentGroup)
        .where(
          and(
            eq(documentGroup.documentGroupId, data.documentGroupId ?? ""),
            eq(documentGroup.tenantId, tenantId),
          ),
        )
        .limit(1);

      if (!group) throw new Error("Document group not found");

      let companyId = group.companyId;
      let resolvedWarehouseId = data.warehouseId ?? group.defaultWarehouseId ?? null;
      let resolvedCurrencyId: string | null = null;

      if (!companyId) {
        const [co] = await tx
          .select({
            companyId: company.companyId,
            defaultWarehouseId: company.defaultWarehouseId,
            currencyId: company.currencyId,
          })
          .from(company)
          .where(eq(company.tenantId, tenantId))
          .limit(1);
        if (!co) throw new Error("No company found for tenant");
        companyId = co.companyId;
        resolvedCurrencyId = co.currencyId;
        if (!resolvedWarehouseId) resolvedWarehouseId = co.defaultWarehouseId ?? null;
      } else {
        const [co] = await tx
          .select({
            defaultWarehouseId: company.defaultWarehouseId,
            currencyId: company.currencyId,
          })
          .from(company)
          .where(eq(company.companyId, companyId))
          .limit(1);
        if (co) {
          resolvedCurrencyId = co.currencyId;
          if (!resolvedWarehouseId) resolvedWarehouseId = co.defaultWarehouseId ?? null;
        }
      }

      let documentNo = `DRAFT-${Date.now()}`;
      if (group.numberSequenceId) {
        const [seq] = await tx
          .select()
          .from(numberSequence)
          .where(eq(numberSequence.numberSequenceId, group.numberSequenceId))
          .limit(1)
          .for("update");

        if (seq) {
          documentNo = generateDocumentNo(seq.prefix, seq.nextValue, seq.padding);
          await tx
            .update(numberSequence)
            .set({ nextValue: seq.nextValue + 1, updatedAt: now })
            .where(eq(numberSequence.numberSequenceId, seq.numberSequenceId));
        }
      }

      const [newDoc] = await tx
        .insert(document)
        .values({
          tenantId,
          companyId,
          documentType: data.documentType ?? group.documentType,
          documentDirection: data.documentDirection ?? group.direction ?? "OUTBOUND",
          documentGroupId: group.documentGroupId,
          documentNo,
          status: "draft",
          documentDate: data.documentDate ?? new Date().toISOString().slice(0, 10),
          customerId: data.customerId ?? null,
          billingAddress: data.billingAddress ?? null,
          deliveryAddress: data.deliveryAddress ?? null,
          deliveryAddressId: data.deliveryAddressId ?? null,
          noteText: data.noteText ?? null,
          noteTextSourceEntity: data.noteTextSourceEntity ?? null,
          noteTextSourceId: data.noteTextSourceId ?? null,
          noteTextSourceField: data.noteTextSourceField ?? null,
          noteTextLinkedAt: toDateOrNull(data.noteTextLinkedAt),
          noteTextOverriddenAt: toDateOrNull(data.noteTextOverriddenAt),
          preText: data.preText ?? null,
          preTextSourceEntity: data.preTextSourceEntity ?? null,
          preTextSourceId: data.preTextSourceId ?? null,
          preTextSourceField: data.preTextSourceField ?? null,
          preTextLinkedAt: toDateOrNull(data.preTextLinkedAt),
          preTextOverriddenAt: toDateOrNull(data.preTextOverriddenAt),
          postText: data.postText ?? null,
          postTextSourceEntity: data.postTextSourceEntity ?? null,
          postTextSourceId: data.postTextSourceId ?? null,
          postTextSourceField: data.postTextSourceField ?? null,
          postTextLinkedAt: toDateOrNull(data.postTextLinkedAt),
          postTextOverriddenAt: toDateOrNull(data.postTextOverriddenAt),
          stornoText: data.stornoText ?? null,
          stornoTextSourceEntity: data.stornoTextSourceEntity ?? null,
          stornoTextSourceId: data.stornoTextSourceId ?? null,
          stornoTextSourceField: data.stornoTextSourceField ?? null,
          stornoTextLinkedAt: toDateOrNull(data.stornoTextLinkedAt),
          stornoTextOverriddenAt: toDateOrNull(data.stornoTextOverriddenAt),
          customAttributes: data.customAttributes ?? null,
          currencyId: await resolveCurrencyCode(tx, data.currencyId ?? resolvedCurrencyId ?? null),
          warehouseId: resolvedWarehouseId,
          paymentTermId: data.paymentTermId ?? group.defaultPaymentTermId ?? null,
          shippingMethodId: data.shippingMethodId ?? group.defaultShippingMethodId ?? null,
          transactionId: crypto.randomUUID(),
        })
        .returning({
          documentId: document.documentId,
          documentNo: document.documentNo,
          transactionId: document.transactionId,
        });

      if (!newDoc) throw new Error("Document creation failed");

      const insertValues = providedLines
        .filter((line) => !line.archived)
        .map((line) => ({
          tenantId,
          documentId: newDoc.documentId,
          lineNo: Number(line.lineNo),
          articleId: line.articleId ?? null,
          articleTextSnapshot: line.articleTextSnapshot ?? null,
          langText: line.langText ?? null,
          langTextSourceEntity: line.langTextSourceEntity ?? null,
          langTextSourceId: line.langTextSourceId ?? null,
          langTextSourceField: line.langTextSourceField ?? null,
          langTextLinkedAt: toDateOrNull(line.langTextLinkedAt),
          langTextOverriddenAt: toDateOrNull(line.langTextOverriddenAt),
          quantity: String(line.quantity),
          unit: line.unit ?? null,
          netPrice: String(line.netPrice),
          discountPercentage:
            line.discountPercentage != null ? String(line.discountPercentage) : null,
          taxCodeId: line.taxCodeId ?? null,
          taxAmount: line.taxAmount != null ? String(line.taxAmount) : null,
          lineTotalNet: line.lineTotalNet != null ? String(line.lineTotalNet) : null,
          warehouseId: line.warehouseId ?? resolvedWarehouseId,
          costCenterId: line.costCenterId ?? null,
          movementType: line.movementType ?? group.documentType,
          lineType: line.lineType ?? "article",
          bomGroupId: line.bomGroupId ?? null,
          transactionId: newDoc.transactionId,
        }));

      if (insertValues.length > 0) {
        await tx.insert(documentLine).values(insertValues);
      }

      return { success: true, documentId: newDoc.documentId, documentNo: newDoc.documentNo };
    });
  }

  async createDocument(
    tenantId: string,
    data: {
      documentGroupId: string;
      documentType: string;
      documentDirection: string;
      documentDate: string;
      status: string;
      customerId?: string | null;
      billingAddress?: unknown;
      deliveryAddress?: unknown;
      deliveryAddressId?: string | null;
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
      customAttributes?: unknown;
      currencyId?: string | null;
      warehouseId?: string | null;
      paymentTermId?: string | null;
      shippingMethodId?: string | null;
    },
  ): Promise<{ documentId: string; documentNo: string }> {
    const [grp] = await db
      .select()
      .from(documentGroup)
      .where(
        and(
          eq(documentGroup.documentGroupId, data.documentGroupId),
          eq(documentGroup.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!grp) throw new Error("Document group not found");

    let companyId = grp.companyId;
    let resolvedWarehouseId = data.warehouseId ?? grp.defaultWarehouseId ?? null;

    if (!companyId) {
      const [co] = await db
        .select({ companyId: company.companyId, defaultWarehouseId: company.defaultWarehouseId })
        .from(company)
        .where(eq(company.tenantId, tenantId))
        .limit(1);
      if (!co) throw new Error("No company found for tenant");
      companyId = co.companyId;
      if (!resolvedWarehouseId) resolvedWarehouseId = co.defaultWarehouseId ?? null;
    } else if (!resolvedWarehouseId) {
      const [co] = await db
        .select({ defaultWarehouseId: company.defaultWarehouseId })
        .from(company)
        .where(eq(company.companyId, companyId))
        .limit(1);
      if (co) resolvedWarehouseId = co.defaultWarehouseId ?? null;
    }

    return await db.transaction(async (tx) => {
      let documentNo = `DRAFT-${Date.now()}`;
      const resolvedCurrencyId = await resolveCurrencyCode(tx, data.currencyId);

      if (grp.numberSequenceId) {
        const [seq] = await tx
          .select()
          .from(numberSequence)
          .where(eq(numberSequence.numberSequenceId, grp.numberSequenceId))
          .limit(1)
          .for("update");

        if (seq) {
          documentNo = generateDocumentNo(seq.prefix, seq.nextValue, seq.padding);
          await tx
            .update(numberSequence)
            .set({ nextValue: seq.nextValue + 1, updatedAt: new Date() })
            .where(eq(numberSequence.numberSequenceId, seq.numberSequenceId));
        }
      }

      const [newDoc] = await tx
        .insert(document)
        .values({
          tenantId,
          companyId,
          documentType: data.documentType,
          documentDirection: data.documentDirection,
          documentGroupId: data.documentGroupId,
          documentNo,
          status: data.status,
          documentDate: data.documentDate,
          customerId: data.customerId ?? null,
          billingAddress: data.billingAddress ?? null,
          deliveryAddress: data.deliveryAddress ?? null,
          deliveryAddressId: data.deliveryAddressId ?? null,
          noteText: data.noteText ?? null,
          noteTextSourceEntity: data.noteTextSourceEntity ?? null,
          noteTextSourceId: data.noteTextSourceId ?? null,
          noteTextSourceField: data.noteTextSourceField ?? null,
          noteTextLinkedAt: toDateOrNull(data.noteTextLinkedAt),
          noteTextOverriddenAt: toDateOrNull(data.noteTextOverriddenAt),
          preText: data.preText ?? null,
          preTextSourceEntity: data.preTextSourceEntity ?? null,
          preTextSourceId: data.preTextSourceId ?? null,
          preTextSourceField: data.preTextSourceField ?? null,
          preTextLinkedAt: toDateOrNull(data.preTextLinkedAt),
          preTextOverriddenAt: toDateOrNull(data.preTextOverriddenAt),
          postText: data.postText ?? null,
          postTextSourceEntity: data.postTextSourceEntity ?? null,
          postTextSourceId: data.postTextSourceId ?? null,
          postTextSourceField: data.postTextSourceField ?? null,
          postTextLinkedAt: toDateOrNull(data.postTextLinkedAt),
          postTextOverriddenAt: toDateOrNull(data.postTextOverriddenAt),
          stornoText: data.stornoText ?? null,
          stornoTextSourceEntity: data.stornoTextSourceEntity ?? null,
          stornoTextSourceId: data.stornoTextSourceId ?? null,
          stornoTextSourceField: data.stornoTextSourceField ?? null,
          stornoTextLinkedAt: toDateOrNull(data.stornoTextLinkedAt),
          stornoTextOverriddenAt: toDateOrNull(data.stornoTextOverriddenAt),
          customAttributes: data.customAttributes ?? null,
          currencyId: resolvedCurrencyId,
          warehouseId: resolvedWarehouseId,
          paymentTermId: data.paymentTermId ?? null,
          shippingMethodId: data.shippingMethodId ?? null,
          transactionId: crypto.randomUUID(),
        })
        .returning();

      return { documentId: newDoc.documentId, documentNo: newDoc.documentNo };
    });
  }

  async duplicateDocument(
    documentId: string,
    userId: string,
    tenantId: string,
    targetGroupId: string,
  ): Promise<{ documentId: string; documentNo: string }> {
    const [src] = await db
      .select()
      .from(document)
      .where(and(eq(document.documentId, documentId), eq(document.tenantId, tenantId)))
      .limit(1);
    if (!src) throw new Error("Document not found");

    const [targetGroup] = await db
      .select()
      .from(documentGroup)
      .where(
        and(
          eq(documentGroup.documentGroupId, targetGroupId),
          eq(documentGroup.tenantId, tenantId),
          eq(documentGroup.archived, false),
        ),
      )
      .limit(1);

    if (!targetGroup) throw new Error("Target document group not found");

    const sourceGroup = src.documentGroupId
      ? await db
          .select()
          .from(documentGroup)
          .where(
            and(
              eq(documentGroup.documentGroupId, src.documentGroupId),
              eq(documentGroup.tenantId, tenantId),
            ),
          )
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : null;

    const sourceType = sourceGroup?.documentType ?? src.documentType;
    const allowedTypes = resolveDuplicateTargetTypes(sourceType);
    if (allowedTypes.length === 0) throw new Error("No duplicate target groups found");
    if (!allowedTypes.includes(targetGroup.documentType)) {
      throw new Error("Target document group not allowed for this document type");
    }

    const sourceDirection =
      sourceGroup?.direction ??
      DIRECTION_FROM_TYPE[src.documentType] ??
      targetGroup.direction ??
      src.documentDirection;
    const targetDirection = targetGroup.direction ?? sourceDirection;

    return await db.transaction(async (tx) => {
      const lines = await loadActiveDocumentLines(tx, tenantId, documentId);
      let newDocumentNo = `COPY-${Date.now()}`;
      if (targetGroup.numberSequenceId) {
        const [seq] = await tx
          .select()
          .from(numberSequence)
          .where(eq(numberSequence.numberSequenceId, targetGroup.numberSequenceId))
          .limit(1)
          .for("update");
        if (seq) {
          newDocumentNo = generateDocumentNo(seq.prefix, seq.nextValue, seq.padding);
          await tx
            .update(numberSequence)
            .set({ nextValue: seq.nextValue + 1, updatedAt: new Date() })
            .where(eq(numberSequence.numberSequenceId, seq.numberSequenceId));
        }
      }

      const [newDoc] = await tx
        .insert(document)
        .values({
          tenantId: src.tenantId,
          companyId: src.companyId,
          documentType: targetGroup.documentType,
          documentDirection: targetDirection,
          documentGroupId: targetGroup.documentGroupId,
          documentNo: newDocumentNo,
          status: "draft",
          documentDate: src.documentDate,
          customerId: src.customerId,
          billingAddress: src.billingAddress,
          deliveryAddress: src.deliveryAddress,
          deliveryAddressId: src.deliveryAddressId,
          noteText: src.noteText,
          noteTextSourceEntity: src.noteTextSourceEntity,
          noteTextSourceId: src.noteTextSourceId,
          noteTextSourceField: src.noteTextSourceField,
          noteTextLinkedAt: toDateOrNull(src.noteTextLinkedAt),
          noteTextOverriddenAt: toDateOrNull(src.noteTextOverriddenAt),
          preText: src.preText,
          preTextSourceEntity: src.preTextSourceEntity,
          preTextSourceId: src.preTextSourceId,
          preTextSourceField: src.preTextSourceField,
          preTextLinkedAt: toDateOrNull(src.preTextLinkedAt),
          preTextOverriddenAt: toDateOrNull(src.preTextOverriddenAt),
          postText: src.postText,
          postTextSourceEntity: src.postTextSourceEntity,
          postTextSourceId: src.postTextSourceId,
          postTextSourceField: src.postTextSourceField,
          postTextLinkedAt: toDateOrNull(src.postTextLinkedAt),
          postTextOverriddenAt: toDateOrNull(src.postTextOverriddenAt),
          stornoText: src.stornoText,
          stornoTextSourceEntity: src.stornoTextSourceEntity,
          stornoTextSourceId: src.stornoTextSourceId,
          stornoTextSourceField: src.stornoTextSourceField,
          stornoTextLinkedAt: toDateOrNull(src.stornoTextLinkedAt),
          stornoTextOverriddenAt: toDateOrNull(src.stornoTextOverriddenAt),
          customAttributes: src.customAttributes,
          currencyId: src.currencyId,
          warehouseId: src.warehouseId,
          paymentTermId: src.paymentTermId,
          shippingMethodId: src.shippingMethodId,
          parentDocumentId: src.documentId,
          transactionId: crypto.randomUUID(),
        })
        .returning();

      const insertedLinePairs: Array<{ sourceLineId: string; targetLineId: string }> = [];

      if (lines.length > 0) {
        await tx.insert(documentLine).values(
          lines.map((l) => ({
            tenantId: l.tenantId,
            documentId: newDoc.documentId,
            lineNo: l.lineNo,
            lineType: l.lineType,
            bomGroupId: l.bomGroupId ?? null,
            articleId: l.articleId,
            articleTextSnapshot: l.articleTextSnapshot,
            langText: l.langText,
            langTextSourceEntity: l.langTextSourceEntity,
            langTextSourceId: l.langTextSourceId,
            langTextSourceField: l.langTextSourceField,
            langTextLinkedAt: toDateOrNull(l.langTextLinkedAt),
            langTextOverriddenAt: toDateOrNull(l.langTextOverriddenAt),
            quantity: l.quantity,
            unit: l.unit,
            netPrice: l.netPrice,
            discountPercentage: l.discountPercentage,
            taxCodeId: l.taxCodeId,
            taxAmount: l.taxAmount,
            lineTotalNet: l.lineTotalNet,
            warehouseId: l.warehouseId,
            costCenterId: l.costCenterId,
            movementType: targetGroup.documentType,
          })),
        );

        const insertedRows = await tx
          .select({
            documentLineId: documentLine.documentLineId,
            lineNo: documentLine.lineNo,
            articleId: documentLine.articleId,
          })
          .from(documentLine)
          .where(
            and(
              eq(documentLine.tenantId, tenantId),
              eq(documentLine.documentId, newDoc.documentId),
            ),
          );

        const insertedLineByKey = new Map(
          insertedRows.map((row) => [String(row.lineNo), row.documentLineId]),
        );

        for (const line of lines) {
          const targetLineId = insertedLineByKey.get(String(line.lineNo));
          if (!targetLineId) continue;
          insertedLinePairs.push({
            sourceLineId: line.documentLineId,
            targetLineId,
          });
        }

        await copyDocumentLineTrackingRowsBulk(tx, tenantId, insertedLinePairs);
      }

      return { documentId: newDoc.documentId, documentNo: newDoc.documentNo };
    });
  }

  async deletePostedDocument(
    documentId: string,
    tenantId: string,
  ): Promise<{ deleted: boolean; archived: boolean; cancelled: boolean; fkViolation?: boolean }> {
    const [doc] = await db
      .select()
      .from(document)
      .where(and(eq(document.documentId, documentId), eq(document.tenantId, tenantId)))
      .limit(1);

    if (!doc) throw new Error("Document not found");
    if (doc.status === "cancelled") throw new Error("Document has already been cancelled");
    if (["R", "r"].includes(doc.documentType)) {
      throw new Error("Invoice documents must be reversed via storno");
    }

    const lines = await db
      .select()
      .from(documentLine)
      .where(and(eq(documentLine.documentId, documentId), eq(documentLine.tenantId, tenantId)));
    const lineIds = lines.map((line) => line.documentLineId);

    if (doc.status === "draft") {
      await db.transaction(async (tx) => {
        if (lineIds.length > 0) {
          await tx
            .delete(documentLineAllocation)
            .where(
              and(
                eq(documentLineAllocation.tenantId, tenantId),
                or(
                  inArray(documentLineAllocation.sourceDocumentLineId, lineIds),
                  inArray(documentLineAllocation.targetDocumentLineId, lineIds),
                ),
              ),
            );
        }

        if (doc.parentDocumentId) {
          const [parent] = await tx
            .select()
            .from(document)
            .where(
              and(eq(document.documentId, doc.parentDocumentId), eq(document.tenantId, tenantId)),
            )
            .limit(1);

          if (parent?.archivedAt) {
            await tx
              .update(document)
              .set({ status: "draft", archivedAt: null, updatedAt: new Date() })
              .where(
                and(eq(document.documentId, parent.documentId), eq(document.tenantId, tenantId)),
              );
          }
        }

        await tx
          .update(document)
          .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
          .where(and(eq(document.documentId, documentId), eq(document.tenantId, tenantId)));
      });
      return { deleted: false, archived: false, cancelled: true };
    }

    await db.transaction(async (tx) => {
      const movements = await tx
        .select()
        .from(inventoryMovement)
        .where(
          and(
            eq(inventoryMovement.tenantId, tenantId),
            eq(inventoryMovement.sourceDocumentId, documentId),
          ),
        )
        .orderBy(asc(inventoryMovement.createdAt), asc(inventoryMovement.inventoryMovementId));

      for (const movement of movements) {
        const qtyDelta = parseQty(movement.qtyDelta ?? movement.absoluteQty ?? 0);
        const qty =
          movement.absoluteQty != null ? parseQty(movement.absoluteQty) : Math.abs(qtyDelta);
        const warehouseId = movement.warehouseId;
        if (!warehouseId || !movement.articleId) continue;

        const applyBalance = async (set: Record<string, unknown>) => {
          await tx
            .update(inventoryBalance)
            .set(set)
            .where(
              and(
                eq(inventoryBalance.tenantId, tenantId),
                eq(inventoryBalance.warehouseId, warehouseId),
                eq(inventoryBalance.articleId, movement.articleId),
              ),
            );
        };

        switch (movement.movementType) {
          case "A":
            await applyBalance({
              reservedQty: sql`${inventoryBalance.reservedQty} - ${qty}`,
              availableQty: sql`${inventoryBalance.onHandQty} - (${inventoryBalance.reservedQty} - ${qty})`,
            });
            break;
          case "L":
            await applyBalance({
              onHandQty: sql`${inventoryBalance.onHandQty} + ${qty}`,
              reservedQty: sql`${inventoryBalance.reservedQty} + ${qty}`,
              availableQty: sql`${inventoryBalance.onHandQty} + ${qty} - (${inventoryBalance.reservedQty} + ${qty})`,
            });
            break;
          case "R":
            await applyBalance({
              onHandQty: sql`${inventoryBalance.onHandQty} + ${qty}`,
              availableQty: sql`${inventoryBalance.onHandQty} + ${qty} - ${inventoryBalance.reservedQty}`,
            });
            break;
          case "G":
            await applyBalance({
              onHandQty: sql`${inventoryBalance.onHandQty} - ${qty}`,
              availableQty: sql`${inventoryBalance.onHandQty} - ${qty} - ${inventoryBalance.reservedQty}`,
            });
            break;
          case "b":
            await applyBalance({
              expectedPurchaseQty: sql`${inventoryBalance.expectedPurchaseQty} - ${qty}`,
              availableQty: sql`${inventoryBalance.onHandQty} - ${inventoryBalance.reservedQty} + (${inventoryBalance.expectedPurchaseQty} - ${qty})`,
            });
            break;
          case "l":
            await applyBalance({
              onHandQty: sql`${inventoryBalance.onHandQty} - ${qty}`,
              expectedPurchaseQty: sql`${inventoryBalance.expectedPurchaseQty} + ${qty}`,
              availableQty: sql`${inventoryBalance.onHandQty} - ${qty} - ${inventoryBalance.reservedQty} + (${inventoryBalance.expectedPurchaseQty} + ${qty})`,
            });
            break;
          case "r":
            await applyBalance({
              onHandQty: sql`${inventoryBalance.onHandQty} - ${qty}`,
              availableQty: sql`${inventoryBalance.onHandQty} - ${qty} - ${inventoryBalance.reservedQty}`,
            });
            break;
          case "g":
            await applyBalance({
              onHandQty: sql`${inventoryBalance.onHandQty} + ${qty}`,
              availableQty: sql`${inventoryBalance.onHandQty} + ${qty} - ${inventoryBalance.reservedQty}`,
            });
            break;
          case "Z":
          case "q":
            await applyBalance({
              onHandQty: sql`${inventoryBalance.onHandQty} - ${qtyDelta}`,
              availableQty: sql`${inventoryBalance.onHandQty} - ${qtyDelta} - ${inventoryBalance.reservedQty}`,
            });
            break;
          case "E":
            await applyBalance({
              onHandQty: sql`${inventoryBalance.onHandQty} + ${qty}`,
              availableQty: sql`${inventoryBalance.onHandQty} + ${qty} - ${inventoryBalance.reservedQty}`,
            });
            break;
          case "U":
            await applyBalance({
              onHandQty: sql`${inventoryBalance.onHandQty} - ${qtyDelta}`,
              availableQty: sql`${inventoryBalance.onHandQty} - ${qtyDelta} - ${inventoryBalance.reservedQty}`,
            });
            break;
          case "V":
            await applyBalance({
              onHandQty: sql`${inventoryBalance.onHandQty} - ${qtyDelta}`,
              availableQty: sql`${inventoryBalance.onHandQty} - ${qtyDelta} - ${inventoryBalance.reservedQty}`,
            });
            break;
          default:
            await applyBalance({
              onHandQty: sql`${inventoryBalance.onHandQty} - ${qtyDelta}`,
              availableQty: sql`${inventoryBalance.onHandQty} - ${qtyDelta} - ${inventoryBalance.reservedQty}`,
            });
            break;
        }

        if (movement.serialNumberId) {
          await tx
            .update(serialNumber)
            .set({
              status: "in_stock",
              createdMovementId: sql`
                CASE WHEN created_movement_id = ${movement.inventoryMovementId} THEN NULL ELSE created_movement_id END
              `,
              consumedMovementId: sql`
                CASE WHEN consumed_movement_id = ${movement.inventoryMovementId} THEN NULL ELSE consumed_movement_id END
              `,
            })
            .where(
              and(
                eq(serialNumber.tenantId, tenantId),
                eq(serialNumber.serialNumberId, movement.serialNumberId),
              ),
            );
        }

        await tx.insert(inventoryMovement).values({
          tenantId,
          companyId: doc.companyId,
          warehouseId,
          articleId: movement.articleId,
          movementType: movement.movementType,
          qtyDelta: String(-qtyDelta),
          movementDate: new Date(),
          sourceDocumentId: documentId,
          sourceDocumentLineId: movement.sourceDocumentLineId,
          transactionId: crypto.randomUUID(),
          referenceText: `DELETE:${doc.documentNo}`,
          serialNumberId: movement.serialNumberId,
          batchNo: movement.batchNo,
        });
      }

      if (lineIds.length > 0) {
        await tx
          .delete(documentLineAllocation)
          .where(
            and(
              eq(documentLineAllocation.tenantId, tenantId),
              or(
                inArray(documentLineAllocation.sourceDocumentLineId, lineIds),
                inArray(documentLineAllocation.targetDocumentLineId, lineIds),
              ),
            ),
          );
      }

      if (doc.parentDocumentId) {
        const [parent] = await tx
          .select()
          .from(document)
          .where(
            and(eq(document.documentId, doc.parentDocumentId), eq(document.tenantId, tenantId)),
          )
          .limit(1);

        if (parent?.archivedAt) {
          await tx
            .update(document)
            .set({ status: "draft", archivedAt: null, updatedAt: new Date() })
            .where(
              and(eq(document.documentId, parent.documentId), eq(document.tenantId, tenantId)),
            );
        }
      }

      await tx
        .update(document)
        .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
        .where(and(eq(document.documentId, documentId), eq(document.tenantId, tenantId)));
    });

    try {
      await refreshStatisticsMVs(tenantId);
    } catch (error) {
      console.error("Failed to refresh statistics materialized views after delete", error);
    }

    return { deleted: false, archived: false, cancelled: true };
  }

  async deleteDocument(
    documentId: string,
    tenantId: string,
  ): Promise<{ deleted: boolean; archived: boolean; cancelled?: boolean; fkViolation?: boolean }> {
    try {
      return await this.deletePostedDocument(documentId, tenantId);
    } catch (err: any) {
      if (err.code === "23503") return { deleted: false, archived: false, fkViolation: true };
      throw err;
    }
  }
}
