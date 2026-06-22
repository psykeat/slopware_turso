import "@tanstack/react-start/server-only";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, normalize } from "node:path";

import { and, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";

import { db } from "../index";
import {
  address,
  article,
  articleCategory,
  articleImage,
  articleOption,
  articleOptionValue,
  articleVariant,
  articleVariantOptionValue,
  category,
  commerceSyncDeadLetter,
  commerceSyncRun,
  commerceSyncRunStep,
  documentGroup,
  externalSyncMapping,
  inventoryItem,
  inventoryLevel,
  priceList,
  priceListItem,
  salesChannel,
  taxCode,
  taxRule,
} from "../schema/app.schema";
import { DocumentService, type DraftDocumentLineInput } from "./document-service";
import { decryptSecret } from "./secret-crypto";

/**
 * Resolve the on-disk storage root, matching the convention used by the image
 * upload route (`/api/articles/$articleId/images`) and the storage preview route.
 */
function storageRoot(): string {
  return process.env.STORAGE_PATH || join(homedir(), "slopware/storage");
}

/** Read a media binary by its `article_image.storageKey`, guarding against path traversal. */
async function readStorageBinary(storageKey: string): Promise<Buffer> {
  const relative = normalize(storageKey.replace(/^storage\//, ""));
  if (relative.startsWith("..") || relative.startsWith("/")) {
    throw new Error(`Invalid media storage key: ${storageKey}`);
  }
  return readFile(join(storageRoot(), relative));
}

export type CommerceSyncEntity = "address" | "article" | "category" | "media_asset" | "document";
export type CommerceSyncDirection = "push" | "pull" | "bidirectional";
export type CommerceSyncMode = "single" | "full";

export interface CommerceSyncPlan {
  salesChannelId: string;
  direction: CommerceSyncDirection;
  mode: CommerceSyncMode;
  entities: CommerceSyncEntity[];
  dryRun?: boolean;
  batchSize?: number;
  /**
   * Delta sync is the default: items whose freshly-built payload is byte-for-byte
   * identical to the last successfully-synced snapshot in `external_sync_mapping`
   * are skipped. Set to `true` to push every candidate regardless (the previous
   * full-table-scan behaviour) — e.g. to recover from a drifted shop.
   */
  forceFullSync?: boolean;
}

export interface SyncItem {
  internalId: string;
  entity: CommerceSyncEntity;
  payload: Record<string, unknown>;
  salutationKey?: string;
  taxRate?: string | null;
  optionGroups?: OptionGroupPayload[];
  mediaBinary?: MediaBinaryRef;
}

/**
 * Reference to a media asset's binary on local storage, plus the metadata the
 * Shopware upload endpoint needs. `needsUpload` is decided by the service via a
 * checksum diff against the last successful sync, so unchanged binaries are not
 * re-uploaded on every run.
 */
export interface MediaBinaryRef {
  storageKey: string;
  mimeType: string;
  fileName: string;
  extension: string;
  needsUpload: boolean;
}

export interface CommerceSyncAdapter {
  pushBatch(input: {
    salesChannel: SalesChannelConfig;
    items: SyncItem[];
  }): Promise<ShopSyncBatchResult>;
  /**
   * Pull orders placed in the shop. Optional: only platforms that support order
   * import implement it. `since` enables the incremental pull (orders changed
   * after the last successful pull run).
   */
  pullOrders?(input: { salesChannel: SalesChannelConfig; since?: Date }): Promise<ShopwareOrder[]>;
}

/** A single line of a pulled shop order, already flattened from the Shopware payload. */
export interface ShopwareOrderLine {
  /** Shopware line item type: `product`, `promotion`, `credit`, `custom`, … */
  type: string | null;
  /** Shopware product id (== our `stableShopwareId` for pushed products), if any. */
  referencedId: string | null;
  /** Product number snapshot — equals the variant SKU for products we pushed. */
  productNumber: string | null;
  label: string | null;
  quantity: number;
  /** Shopware unit price — gross or net depending on the order's `taxStatus`. */
  unitPrice: number;
  /** Tax rate (percent) Shopware calculated for the line, if present. */
  taxRate: number | null;
}

/** A pulled shop order, flattened from the Shopware `order` entity + associations. */
export interface ShopwareOrder {
  orderId: string;
  orderNumber: string;
  /** ISO timestamp of when the order was placed. */
  orderDateTime: string;
  /** `gross` (B2C), `net` (B2B) or `tax-free`. Decides how line prices are interpreted. */
  taxStatus: string | null;
  currencyIso: string | null;
  customer: {
    customerId: string | null;
    customerNumber: string | null;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    company: string | null;
    vatId: string | null;
  } | null;
  billingAddress: {
    firstName: string | null;
    lastName: string | null;
    company: string | null;
    street: string | null;
    zipcode: string | null;
    city: string | null;
    countryIso: string | null;
    phoneNumber: string | null;
  } | null;
  /** Latest payment transaction state (`paid`, `open`, `refunded`, …). */
  paymentState: string | null;
  /** Latest delivery state (`open`, `shipped`, …). */
  shippingState: string | null;
  lines: ShopwareOrderLine[];
}

export interface SalesChannelConfig {
  salesChannelId: string;
  platform: "shopware6" | "shopify" | "woocommerce" | "prestashop";
  apiUrl: string;
  credentials: unknown;
}

export interface ShopSyncBatchResult {
  accepted: number;
  externalIds: Array<{ internalId: string; externalId: string; payloadSnapshot?: unknown }>;
  rejected: Array<{ internalId: string; error: string }>;
}

interface ShopwareReferences {
  currencyId: string;
  taxId: string;
  taxRateMap: Map<string, string>;
  customerGroupId: string;
  paymentMethodId: string;
  salesChannelId: string;
  salutationId: string;
  salutationsByKey: Map<string, string>;
  countriesByIso: Map<string, string>;
}

interface AddressRow {
  addressId: string;
  addressNo: string;
  isCustomer: boolean;
  isSupplier: boolean;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  addressLine1: string;
  addressLine2: string | null;
  postalCode: string;
  city: string;
  countryCode: string;
  vatId: string | null;
  email: string | null;
  phoneLandline: string | null;
  phoneMobile: string | null;
  salutation: string | null;
}

interface ArticleRow {
  articleId: string;
  articleNo: string;
  name: string;
  description: string | null;
  kurzbeschreibung: string | null;
  langtext: string | null;
  taxRate: string | null;
}

interface VariantRow {
  variantId: string;
  articleId: string;
  sku: string;
  ean: string | null;
  price: string | null;
  weight: string | null;
  isActive: boolean;
  availableStock: number;
  optionValues?: Array<{ groupName: string; groupId: string; valueId: string; value: string }>;
  priceListPrices?: PriceListPrice[];
}

interface PriceListPrice {
  priceListName: string;
  isNet: boolean;
  currencyId: string;
  price: number;
}

interface OptionGroupPayload {
  groupId: string;
  groupName: string;
  shopwareGroupId: string;
  values: Array<{ valueId: string; value: string; shopwareOptionId: string }>;
}

interface MediaRow {
  articleImageId: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
  checksum: string | null;
  altText: string | null;
}

/** Link between an article and an article image, used to build the product gallery + cover. */
interface ArticleMediaLink {
  articleImageId: string;
  role: string;
  sortOrder: number;
}

/** Lookup tables resolving a Shopware order line to an internal variant id. */
interface VariantResolution {
  /** SKU (== Shopware productNumber) → variantId. Primary, covers all push shapes. */
  bySku: Map<string, string>;
  /** stableShopwareId("article-variant", variantId) → variantId (multi-variant children). */
  byHash: Map<string, string>;
  /** stableShopwareId("article", articleId) → variantId for single-variant products. */
  byArticleHash: Map<string, string>;
}

class ShopwareHttpError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "ShopwareHttpError";
  }
}

async function withRetry<T>(
  fn: () => Promise<T>,
  {
    maxAttempts = 3,
    initialDelayMs = 1000,
  }: { maxAttempts?: number; initialDelayMs?: number } = {},
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const retryable =
        error instanceof ShopwareHttpError && (error.statusCode === 429 || error.statusCode >= 500);
      if (attempt >= maxAttempts || !retryable) throw error;
      await new Promise<void>((resolve) =>
        setTimeout(resolve, initialDelayMs * 2 ** (attempt - 1)),
      );
    }
  }
}

function stableShopwareId(namespace: string, id: string): string {
  return createHash("sha256").update(`${namespace}:${id}`).digest("hex").slice(0, 32);
}

function compactRecord(record: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(record).filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    ),
  );
}

function toDecimalNumber(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Derive the net unit price from a Shopware order line, honouring the order's
 * `taxStatus`: `gross` lines carry a gross unit price (B2C storefronts), while
 * `net` and `tax-free` lines already carry net.
 */
export function deriveUnitNet(
  unitPrice: number,
  taxStatus: string | null,
  taxRatePercent: number,
): number {
  if (taxStatus === "gross") {
    return roundMoney(unitPrice / (1 + taxRatePercent / 100));
  }
  return roundMoney(unitPrice);
}

/** Net line total + tax amount for a document line built from a shop order line. */
export function computeOrderLineFinancials(
  netPrice: number,
  quantity: number,
  taxRatePercent: number,
): { lineTotalNet: number; taxAmount: number } {
  const lineTotalNet = roundMoney(netPrice * quantity);
  const taxAmount = roundMoney((lineTotalNet * taxRatePercent) / 100);
  return { lineTotalNet, taxAmount };
}

/**
 * Canonicalize a payload for the delta diff: sort object keys recursively AND sort
 * array elements by their own canonical form. The Shopware payload arrays
 * (`children`, `categories`, `media`, `options`, `price`, `configuratorSettings`,
 * `vatIds`) are all set-like — order carries no meaning (positions are explicit
 * fields, not array indices) — but they are built from DB queries without a stable
 * `ORDER BY`, so heap order could otherwise flip between runs and make an unchanged
 * entity look changed. Comparing both sides with the same canonicalization keeps the
 * diff order-independent without affecting what is actually pushed.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    const items = value.map(canonicalize);
    return items
      .map((item) => ({ item, key: JSON.stringify(item) }))
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
      .map((entry) => entry.item);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, canonicalize((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

/**
 * Canonical JSON used for the delta-sync payload diff. Normalizes object key order
 * (the baseline is read back from a `jsonb` column, which does not preserve
 * insertion order) and set-like array order (see {@link canonicalize}).
 */
function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function validateShopwareCustomerPayload(payload: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const req = (label: string, value: unknown) => {
    if (!value && value !== 0) errors.push(`missing: ${label}`);
  };
  req("id", payload.id);
  req("customerNumber", payload.customerNumber);
  req("email", payload.email);
  req("firstName", payload.firstName);
  req("lastName", payload.lastName);
  req("groupId", payload.groupId);
  req("salesChannelId", payload.salesChannelId);
  req("defaultPaymentMethodId", payload.defaultPaymentMethodId);
  req("salutationId", payload.salutationId);
  const addr =
    payload.defaultBillingAddress && typeof payload.defaultBillingAddress === "object"
      ? (payload.defaultBillingAddress as Record<string, unknown>)
      : null;
  if (!addr) {
    errors.push("missing: defaultBillingAddress");
  } else {
    req("defaultBillingAddress.firstName", addr.firstName);
    req("defaultBillingAddress.lastName", addr.lastName);
    req("defaultBillingAddress.street", addr.street);
    req("defaultBillingAddress.zipcode", addr.zipcode);
    req("defaultBillingAddress.city", addr.city);
    req("defaultBillingAddress.countryId", addr.countryId);
    req("defaultBillingAddress.salutationId", addr.salutationId);
  }
  return errors;
}

function validateShopwareProductPayload(payload: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (!payload.id) errors.push("missing: id");
  if (!payload.productNumber) errors.push("missing: productNumber");
  if (!payload.name) errors.push("missing: name");
  if (!payload.taxId) errors.push("missing: taxId");
  if (typeof payload.stock !== "number") errors.push("missing: stock (must be number)");
  const prices = Array.isArray(payload.price) ? (payload.price as unknown[]) : [];
  if (prices.length === 0) {
    errors.push("missing: price (must be non-empty array)");
  } else {
    const p = prices[0] as Record<string, unknown>;
    if (!p.currencyId) errors.push("missing: price[0].currencyId");
    if (typeof p.gross !== "number") errors.push("missing: price[0].gross (must be number)");
  }
  return errors;
}

export function mapAddressToShopwareCustomer(row: AddressRow) {
  const externalId = stableShopwareId("address", row.addressId);
  const displayName =
    row.companyName ??
    [row.firstName, row.lastName].filter(Boolean).join(" ").trim() ??
    row.addressNo;
  const syntheticEmail = `slopware-${row.addressNo.replace(/[^a-zA-Z0-9._-]/g, "-")}@example.invalid`;

  return {
    internalId: row.addressId,
    externalId,
    salutationKey: mapSalutationKey(row.salutation),
    payload: compactRecord({
      id: externalId,
      customerNumber: row.addressNo,
      email: row.email || syntheticEmail,
      firstName: row.firstName ?? row.companyName ?? row.addressNo,
      lastName: row.lastName ?? "-",
      company: row.companyName,
      vatIds: row.vatId ? [row.vatId] : undefined,
      customFields: compactRecord({
        slopwareAddressId: row.addressId,
        slopwareAddressNo: row.addressNo,
        slopwareCountryCode: row.countryCode,
        slopwareDisplayName: displayName,
        slopwareIsSupplier: row.isSupplier,
        slopwarePhoneLandline: row.phoneLandline,
        slopwarePhoneMobile: row.phoneMobile,
      }),
      defaultBillingAddress: compactRecord({
        id: stableShopwareId("address-billing", row.addressId),
        firstName: row.firstName ?? row.companyName ?? row.addressNo,
        lastName: row.lastName ?? "-",
        company: row.companyName,
        street: [row.addressLine1, row.addressLine2].filter(Boolean).join(" "),
        zipcode: row.postalCode,
        city: row.city,
        phoneNumber: row.phoneLandline ?? row.phoneMobile,
        country: { iso: row.countryCode },
      }),
    }),
  };
}

function buildPriceFromPriceList(
  plp: PriceListPrice,
  taxRatePercent: number,
): { currencyId: string; gross: number; net: number; linked: false } {
  if (plp.isNet) {
    const net = plp.price;
    const gross = Math.round(net * (1 + taxRatePercent / 100) * 100) / 100;
    return { currencyId: plp.currencyId, gross, net, linked: false };
  }
  const gross = plp.price;
  const net = Math.round((gross / (1 + taxRatePercent / 100)) * 100) / 100;
  return { currencyId: plp.currencyId, gross, net, linked: false };
}

function buildVariantPrice(
  variant: VariantRow | undefined,
  taxRate: string | null | undefined,
): Array<{ currencyId: string; gross: number; net: number; linked: boolean }> {
  const plPrices = variant?.priceListPrices;
  if (plPrices && plPrices.length > 0) {
    const taxRatePercent = toDecimalNumber(taxRate ?? null) ?? 0;
    return plPrices.map((plp) => buildPriceFromPriceList(plp, taxRatePercent));
  }
  const fallback = toDecimalNumber(variant?.price ?? null) ?? 0;
  return [{ currencyId: "EUR", gross: fallback, net: fallback, linked: true }];
}

function mapSalutationKey(salutation: string | null): string {
  if (!salutation) return "not_specified";
  const lower = salutation.toLowerCase().trim();
  if (lower === "herr" || lower === "mr" || lower === "mr.") return "mr";
  if (lower === "frau" || lower === "mrs" || lower === "mrs." || lower === "ms" || lower === "ms.")
    return "mrs";
  return "not_specified";
}

export function mapArticleToShopwareProduct(
  row: ArticleRow,
  variants: VariantRow[],
  categoryIds?: string[],
  mediaLinks?: ArticleMediaLink[],
) {
  const activeVariants = variants.filter((variant) => variant.isActive);
  const externalId = stableShopwareId("article", row.articleId);
  const categories =
    categoryIds && categoryIds.length > 0
      ? categoryIds.map((cid) => ({ id: stableShopwareId("category", cid) }))
      : undefined;
  const { media, coverId } = buildProductMedia(externalId, mediaLinks);
  const basePayload = compactRecord({
    id: externalId,
    productNumber: row.articleNo,
    name: row.name,
    description: row.langtext ?? row.description ?? row.kurzbeschreibung,
    metaDescription: row.kurzbeschreibung,
    active: true,
    categories,
    media,
    coverId,
    customFields: {
      slopwareArticleId: row.articleId,
      slopwareArticleNo: row.articleNo,
    },
  });

  if (activeVariants.length <= 1) {
    const variant = activeVariants[0];
    const stock = variant?.availableStock ?? 0;
    return {
      internalId: row.articleId,
      externalId,
      taxRate: row.taxRate,
      payload: compactRecord({
        ...basePayload,
        productNumber: variant?.sku ?? row.articleNo,
        ean: variant?.ean,
        weight: toDecimalNumber(variant?.weight ?? null),
        stock: Math.max(0, Math.round(stock)),
        price: buildVariantPrice(variant, row.taxRate),
      }),
      variantExternalIds: variant
        ? [
            {
              internalId: variant.variantId,
              externalId: stableShopwareId("article-variant", variant.variantId),
            },
          ]
        : [],
      optionGroups: [] as OptionGroupPayload[],
    };
  }

  const optionGroups = collectOptionGroups(activeVariants);

  const configuratorSettings = optionGroups.flatMap((group) =>
    group.values.map((v) => ({
      id: stableShopwareId("configurator-setting", `${externalId}:${v.shopwareOptionId}`),
      optionId: v.shopwareOptionId,
    })),
  );

  const totalStock = activeVariants.reduce((sum, v) => sum + v.availableStock, 0);
  return {
    internalId: row.articleId,
    externalId,
    taxRate: row.taxRate,
    payload: {
      ...basePayload,
      stock: Math.max(0, Math.round(totalStock)),
      ...(configuratorSettings.length > 0 ? { configuratorSettings } : {}),
      children: activeVariants.map((variant) => {
        const variantOptions = (variant.optionValues ?? []).map((ov) => ({
          id: stableShopwareId("option-value", ov.valueId),
        }));
        return compactRecord({
          id: stableShopwareId("article-variant", variant.variantId),
          productNumber: variant.sku,
          ean: variant.ean,
          active: variant.isActive,
          weight: toDecimalNumber(variant.weight),
          stock: Math.max(0, Math.round(variant.availableStock)),
          price: buildVariantPrice(variant, row.taxRate),
          ...(variantOptions.length > 0 ? { options: variantOptions } : {}),
          customFields: {
            slopwareVariantId: variant.variantId,
            slopwareSku: variant.sku,
          },
        });
      }),
    },
    variantExternalIds: activeVariants.map((variant) => ({
      internalId: variant.variantId,
      externalId: stableShopwareId("article-variant", variant.variantId),
    })),
    optionGroups,
  };
}

function collectOptionGroups(variants: VariantRow[]): OptionGroupPayload[] {
  const groupMap = new Map<string, OptionGroupPayload>();
  for (const variant of variants) {
    for (const ov of variant.optionValues ?? []) {
      let group = groupMap.get(ov.groupId);
      if (!group) {
        group = {
          groupId: ov.groupId,
          groupName: ov.groupName,
          shopwareGroupId: stableShopwareId("option-group", ov.groupId),
          values: [],
        };
        groupMap.set(ov.groupId, group);
      }
      if (!group.values.some((v) => v.valueId === ov.valueId)) {
        group.values.push({
          valueId: ov.valueId,
          value: ov.value,
          shopwareOptionId: stableShopwareId("option-value", ov.valueId),
        });
      }
    }
  }
  return [...groupMap.values()];
}

/**
 * Build the Shopware `product_media` gallery + `coverId` from article→media links.
 * Links are deduped per article image (lowest sort order wins), `product_media` ids
 * are deterministic per (product, article image), and the cover is the link with
 * role `cover` or — failing that — the first by sort order.
 */
function buildProductMedia(
  productExternalId: string,
  mediaLinks?: ArticleMediaLink[],
): { media?: Array<Record<string, unknown>>; coverId?: string } {
  if (!mediaLinks || mediaLinks.length === 0) return {};

  const byAsset = new Map<string, ArticleMediaLink>();
  for (const link of mediaLinks) {
    const existing = byAsset.get(link.articleImageId);
    if (!existing || link.sortOrder < existing.sortOrder) byAsset.set(link.articleImageId, link);
  }
  const ordered = [...byAsset.values()].sort((a, b) => a.sortOrder - b.sortOrder);
  if (ordered.length === 0) return {};

  const productMediaId = (assetId: string) =>
    stableShopwareId("product-media", `${productExternalId}:${assetId}`);

  const media = ordered.map((link, index) => ({
    id: productMediaId(link.articleImageId),
    mediaId: stableShopwareId("media", link.articleImageId),
    position: link.sortOrder ?? index,
  }));

  const cover = ordered.find((link) => link.role === "cover") ?? ordered[0];
  return { media, coverId: productMediaId(cover.articleImageId) };
}

export function mapArticleImageToShopwareMedia(row: MediaRow) {
  const externalId = stableShopwareId("media", row.articleImageId);
  const dotIdx = row.fileName.lastIndexOf(".");
  const baseName = dotIdx > 0 ? row.fileName.slice(0, dotIdx) : row.fileName;
  const extension = dotIdx > 0 ? row.fileName.slice(dotIdx + 1).toLowerCase() : "";
  return {
    internalId: row.articleImageId,
    externalId,
    payload: compactRecord({
      id: externalId,
      title: baseName,
      alt: row.altText ?? undefined,
      customFields: {
        slopwareArticleImageId: row.articleImageId,
        slopwareChecksum: row.checksum ?? undefined,
      },
    }),
    binary: {
      storageKey: row.storageKey,
      mimeType: row.mimeType,
      fileName: baseName,
      extension,
    },
    checksum: row.checksum,
  };
}

function validateShopwareMediaPayload(
  payload: Record<string, unknown>,
  binary?: MediaBinaryRef,
): string[] {
  const errors: string[] = [];
  if (!payload.id) errors.push("missing: id");
  if (!binary?.storageKey) errors.push("missing: storageKey");
  if (!binary?.extension)
    errors.push("missing: file extension (cannot determine Shopware upload type)");
  return errors;
}

interface CategoryRow {
  categoryId: string;
  parentCategoryId: string | null;
  name: string;
  slug: string | null;
  description: string | null;
  sortOrder: number;
}

export function mapCategoryToShopwareCategory(row: CategoryRow) {
  const externalId = stableShopwareId("category", row.categoryId);
  return {
    internalId: row.categoryId,
    externalId,
    payload: compactRecord({
      id: externalId,
      parentId: row.parentCategoryId
        ? stableShopwareId("category", row.parentCategoryId)
        : undefined,
      name: row.name,
      description: row.description,
      active: true,
      visible: true,
      type: "page",
      displayNestedProducts: true,
      customFields: {
        slopwareCategoryId: row.categoryId,
      },
    }),
  };
}

function topologicalSortCategories(rows: CategoryRow[]): CategoryRow[] {
  const byId = new Map(rows.map((r) => [r.categoryId, r]));
  const sorted: CategoryRow[] = [];
  const visited = new Set<string>();

  function visit(row: CategoryRow) {
    if (visited.has(row.categoryId)) return;
    visited.add(row.categoryId);
    if (row.parentCategoryId && byId.has(row.parentCategoryId)) {
      visit(byId.get(row.parentCategoryId)!);
    }
    sorted.push(row);
  }

  for (const row of rows) visit(row);
  return sorted;
}

function validateShopwareCategoryPayload(payload: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (!payload.id) errors.push("missing: id");
  if (!payload.name) errors.push("missing: name");
  return errors;
}

export class Shopware6Adapter implements CommerceSyncAdapter {
  async pushBatch(input: {
    salesChannel: SalesChannelConfig;
    items: SyncItem[];
  }): Promise<ShopSyncBatchResult> {
    const token = await withRetry(() => this.fetchToken(input.salesChannel));
    const references = await withRetry(() => this.resolveReferences(input.salesChannel, token));

    // The delta-sync diff compares against the raw mapped payload, so persist that
    // (not the reference-resolved `prepared` payload) as the mapping snapshot.
    const rawPayloadById = new Map(input.items.map((item) => [item.internalId, item.payload]));
    const snapshotFor = (internalId: string, prepared: Record<string, unknown>) =>
      rawPayloadById.get(internalId) ?? prepared;

    const accepted: Array<{ internalId: string; externalId: string; payloadSnapshot?: unknown }> =
      [];
    const rejected: Array<{ internalId: string; error: string }> = [];
    const customerItems: Array<{ internalId: string; prepared: Record<string, unknown> }> = [];
    const productItems: Array<{ internalId: string; prepared: Record<string, unknown> }> = [];
    const categoryItems: Array<{ internalId: string; prepared: Record<string, unknown> }> = [];
    const mediaItems: Array<{
      internalId: string;
      prepared: Record<string, unknown>;
      binary?: MediaBinaryRef;
    }> = [];
    const allOptionGroups: OptionGroupPayload[] = [];

    for (const item of input.items) {
      try {
        if (item.entity === "media_asset") {
          const errors = validateShopwareMediaPayload(item.payload, item.mediaBinary);
          if (errors.length > 0) {
            rejected.push({ internalId: item.internalId, error: errors.join("; ") });
          } else {
            mediaItems.push({
              internalId: item.internalId,
              prepared: item.payload,
              binary: item.mediaBinary,
            });
          }
        } else if (item.entity === "address") {
          const prepared = this.prepareCustomerPayload(
            item.payload,
            references,
            item.salutationKey,
          );
          const errors = validateShopwareCustomerPayload(prepared);
          if (errors.length > 0) {
            rejected.push({ internalId: item.internalId, error: errors.join("; ") });
          } else {
            customerItems.push({ internalId: item.internalId, prepared });
          }
        } else if (item.entity === "category") {
          const errors = validateShopwareCategoryPayload(item.payload);
          if (errors.length > 0) {
            rejected.push({ internalId: item.internalId, error: errors.join("; ") });
          } else {
            categoryItems.push({ internalId: item.internalId, prepared: item.payload });
          }
        } else {
          const prepared = this.prepareProductPayload(item.payload, references, item.taxRate);
          const errors = validateShopwareProductPayload(prepared);
          if (errors.length > 0) {
            rejected.push({ internalId: item.internalId, error: errors.join("; ") });
          } else {
            productItems.push({ internalId: item.internalId, prepared });
          }
          if (item.optionGroups) {
            for (const og of item.optionGroups) {
              if (!allOptionGroups.some((g) => g.groupId === og.groupId)) {
                allOptionGroups.push(og);
              }
            }
          }
        }
      } catch (error) {
        rejected.push({
          internalId: item.internalId,
          error: error instanceof Error ? error.message : "Unknown preparation error",
        });
      }
    }

    if (
      customerItems.length === 0 &&
      productItems.length === 0 &&
      categoryItems.length === 0 &&
      mediaItems.length === 0
    ) {
      return { accepted: 0, externalIds: [], rejected };
    }

    // Media must exist (entity + binary) before products can reference it, so push
    // it first. Binaries are only uploaded when the service flagged a checksum change.
    const failedMediaIds = new Set<string>();
    if (mediaItems.length > 0) {
      await withRetry(() =>
        this.callSyncApi(input.salesChannel, token, {
          "slopware-media-upsert": {
            entity: "media",
            action: "upsert",
            payload: mediaItems.map((m) => m.prepared),
          },
        }),
      );

      for (const m of mediaItems) {
        if (!m.binary?.needsUpload) continue;
        const mediaId = typeof m.prepared.id === "string" ? m.prepared.id : null;
        if (!mediaId) continue;
        try {
          const bytes = await readStorageBinary(m.binary.storageKey);
          await withRetry(() =>
            this.uploadMediaBinary(input.salesChannel, token, mediaId, m.binary!, bytes),
          );
        } catch (error) {
          failedMediaIds.add(m.internalId);
          rejected.push({
            internalId: m.internalId,
            error: error instanceof Error ? error.message : "Media binary upload failed",
          });
        }
      }
    }

    if (categoryItems.length > 0) {
      await withRetry(() =>
        this.callSyncApi(input.salesChannel, token, {
          "slopware-category-upsert": {
            entity: "category",
            action: "upsert",
            payload: categoryItems.map((c) => c.prepared),
          },
        }),
      );
    }

    if (allOptionGroups.length > 0) {
      await withRetry(() =>
        this.callSyncApi(
          input.salesChannel,
          token,
          this.buildPropertyGroupOperations(allOptionGroups),
        ),
      );
    }

    const operations: Record<
      string,
      { entity: string; action: string; payload: Record<string, unknown>[] }
    > = {};
    if (customerItems.length > 0) {
      operations["slopware-customer-upsert"] = {
        entity: "customer",
        action: "upsert",
        payload: customerItems.map((c) => c.prepared),
      };
    }
    if (productItems.length > 0) {
      operations["slopware-product-upsert"] = {
        entity: "product",
        action: "upsert",
        payload: productItems.map((p) => p.prepared),
      };
    }

    if (customerItems.length > 0 || productItems.length > 0) {
      await withRetry(() => this.callSyncApi(input.salesChannel, token, operations));
    }

    for (const item of mediaItems) {
      if (failedMediaIds.has(item.internalId)) continue;
      accepted.push({
        internalId: item.internalId,
        externalId: typeof item.prepared.id === "string" ? item.prepared.id : item.internalId,
        payloadSnapshot: snapshotFor(item.internalId, item.prepared),
      });
    }
    for (const item of categoryItems) {
      accepted.push({
        internalId: item.internalId,
        externalId: typeof item.prepared.id === "string" ? item.prepared.id : item.internalId,
        payloadSnapshot: snapshotFor(item.internalId, item.prepared),
      });
    }
    for (const item of customerItems) {
      accepted.push({
        internalId: item.internalId,
        externalId: typeof item.prepared.id === "string" ? item.prepared.id : item.internalId,
        payloadSnapshot: snapshotFor(item.internalId, item.prepared),
      });
    }
    for (const item of productItems) {
      accepted.push({
        internalId: item.internalId,
        externalId: typeof item.prepared.id === "string" ? item.prepared.id : item.internalId,
        payloadSnapshot: snapshotFor(item.internalId, item.prepared),
      });
    }

    return { accepted: accepted.length, externalIds: accepted, rejected };
  }

  async pullOrders(input: {
    salesChannel: SalesChannelConfig;
    since?: Date;
  }): Promise<ShopwareOrder[]> {
    const token = await withRetry(() => this.fetchToken(input.salesChannel));
    const limit = 100;
    const baseCriteria: Record<string, unknown> = {
      limit,
      sort: [{ field: "orderDateTime", order: "ASC" }],
      associations: {
        lineItems: {},
        orderCustomer: {},
        currency: {},
        billingAddress: { associations: { country: {} } },
        transactions: { associations: { stateMachineState: {} } },
        deliveries: { associations: { stateMachineState: {} } },
      },
    };
    if (input.since) {
      baseCriteria.filter = [
        {
          type: "range",
          field: "orderDateTime",
          parameters: { gte: input.since.toISOString() },
        },
      ];
    }

    const orders: ShopwareOrder[] = [];
    for (let page = 1; ; page++) {
      const rows = await withRetry(() =>
        this.searchOrders(input.salesChannel, token, { ...baseCriteria, page }),
      );
      orders.push(...rows.map((row) => normalizeShopwareOrder(row)));
      if (rows.length < limit) break;
    }
    return orders;
  }

  /**
   * Search the Shopware `order` entity with `Accept: application/json`, which returns
   * entities with their associations nested inline (instead of the JSON:API
   * `data`/`included` split used by {@link searchMany}).
   */
  private async searchOrders(
    salesChannelConfig: SalesChannelConfig,
    token: string,
    criteria: Record<string, unknown>,
  ): Promise<Array<Record<string, unknown>>> {
    const response = await fetch(
      `${salesChannelConfig.apiUrl.replace(/\/$/, "")}/api/search/order`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(criteria),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new ShopwareHttpError(
        `Shopware order search failed (${response.status}): ${body}`,
        response.status,
      );
    }

    const payload = (await response.json()) as { data?: unknown };
    return Array.isArray(payload.data)
      ? payload.data.flatMap((row) =>
          row && typeof row === "object" ? [row as Record<string, unknown>] : [],
        )
      : [];
  }

  private prepareCustomerPayload(
    payload: Record<string, unknown>,
    references: ShopwareReferences,
    salutationKey?: string,
  ): Record<string, unknown> {
    const billingAddress =
      payload.defaultBillingAddress && typeof payload.defaultBillingAddress === "object"
        ? { ...(payload.defaultBillingAddress as Record<string, unknown>) }
        : {};
    const customFields =
      payload.customFields && typeof payload.customFields === "object"
        ? (payload.customFields as Record<string, unknown>)
        : {};
    const countryCode =
      typeof customFields.slopwareCountryCode === "string"
        ? customFields.slopwareCountryCode.toUpperCase()
        : undefined;
    const countryId = countryCode ? references.countriesByIso.get(countryCode) : undefined;
    if (!countryId) {
      throw new Error(
        `Shopware country mapping missing for ISO code "${countryCode ?? "unknown"}"`,
      );
    }
    const salutationId =
      (salutationKey ? references.salutationsByKey.get(salutationKey) : undefined) ??
      references.salutationId;
    delete billingAddress.country;
    return {
      ...payload,
      groupId: references.customerGroupId,
      salesChannelId: references.salesChannelId,
      defaultPaymentMethodId: references.paymentMethodId,
      salutationId,
      defaultBillingAddress: {
        ...billingAddress,
        salutationId,
        countryId,
      },
    };
  }

  private prepareProductPayload(
    payload: Record<string, unknown>,
    references: ShopwareReferences,
    taxRate?: string | null,
  ): Record<string, unknown> {
    const resolvedTaxId = taxRate
      ? (references.taxRateMap.get(taxRate) ?? references.taxId)
      : references.taxId;

    const children = Array.isArray(payload.children)
      ? (payload.children as Record<string, unknown>[])
      : [];
    const preparedChildren = children.map((child) => ({
      ...child,
      taxId: resolvedTaxId,
      stock: typeof child.stock === "number" ? child.stock : 0,
      price: normalizeShopwarePrice(child.price ?? payload.price, references.currencyId),
    }));

    return {
      ...payload,
      taxId: resolvedTaxId,
      stock: typeof payload.stock === "number" ? payload.stock : 0,
      price: normalizeShopwarePrice(payload.price, references.currencyId),
      ...(preparedChildren.length > 0 ? { children: preparedChildren } : {}),
    };
  }

  private buildPropertyGroupOperations(
    optionGroups: OptionGroupPayload[],
  ): Record<string, { entity: string; action: string; payload: Record<string, unknown>[] }> {
    const operations: Record<
      string,
      { entity: string; action: string; payload: Record<string, unknown>[] }
    > = {};
    operations["slopware-property-group-upsert"] = {
      entity: "property_group",
      action: "upsert",
      payload: optionGroups.map((g) => ({
        id: g.shopwareGroupId,
        name: g.groupName,
        sortingType: "alphanumeric",
        displayType: "select",
        options: g.values.map((v) => ({
          id: v.shopwareOptionId,
          name: v.value,
        })),
      })),
    };
    return operations;
  }

  private async callSyncApi(
    salesChannelConfig: SalesChannelConfig,
    token: string,
    operations: Record<string, unknown>,
  ): Promise<void> {
    const response = await fetch(
      `${salesChannelConfig.apiUrl.replace(/\/$/, "")}/api/_action/sync`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(operations),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new ShopwareHttpError(
        `Shopware sync failed (${response.status}): ${body}`,
        response.status,
      );
    }
  }

  private async uploadMediaBinary(
    salesChannelConfig: SalesChannelConfig,
    token: string,
    mediaId: string,
    binary: MediaBinaryRef,
    bytes: Buffer,
  ): Promise<void> {
    const params = new URLSearchParams({ extension: binary.extension, fileName: binary.fileName });
    const response = await fetch(
      `${salesChannelConfig.apiUrl.replace(/\/$/, "")}/api/_action/media/${mediaId}/upload?${params.toString()}`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": binary.mimeType,
        },
        body: new Uint8Array(bytes),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new ShopwareHttpError(
        `Shopware media upload failed for ${mediaId} (${response.status}): ${body}`,
        response.status,
      );
    }
  }

  private async resolveReferences(
    salesChannelConfig: SalesChannelConfig,
    token: string,
  ): Promise<ShopwareReferences> {
    const [
      currency,
      taxes,
      customerGroup,
      paymentMethod,
      shopwareSalesChannel,
      salutations,
      countries,
    ] = await Promise.all([
      this.searchFirst(salesChannelConfig, token, "currency", {
        filter: [{ type: "equals", field: "isoCode", value: "EUR" }],
      }),
      this.searchMany(salesChannelConfig, token, "tax", { limit: 500 }),
      this.searchFirst(salesChannelConfig, token, "customer-group", { limit: 1 }),
      this.searchFirst(salesChannelConfig, token, "payment-method", {
        filter: [{ type: "equals", field: "active", value: true }],
      }),
      this.searchFirst(salesChannelConfig, token, "sales-channel", {
        filter: [{ type: "equals", field: "active", value: true }],
      }),
      this.searchMany(salesChannelConfig, token, "salutation", { limit: 100 }),
      this.searchMany(salesChannelConfig, token, "country", { limit: 500 }),
    ]);

    const taxRateMap = new Map<string, string>();
    let defaultTaxId: string | undefined;
    for (const t of taxes) {
      const rate = t.attributes.taxRate;
      if (typeof rate === "number") {
        taxRateMap.set(String(rate), t.id);
      }
      if (!defaultTaxId) defaultTaxId = t.id;
    }

    const salutationsByKey = new Map<string, string>();
    let defaultSalutationId: string | undefined;
    for (const s of salutations) {
      const key = s.attributes.salutationKey;
      if (typeof key === "string") salutationsByKey.set(key, s.id);
      if (!defaultSalutationId) defaultSalutationId = s.id;
    }

    const countriesByIso = new Map<string, string>();
    for (const country of countries) {
      const iso = country.attributes.iso;
      if (typeof iso === "string") countriesByIso.set(iso.toUpperCase(), country.id);
    }

    if (!defaultTaxId) throw new Error("Shopware reference missing: tax");
    if (!defaultSalutationId) throw new Error("Shopware reference missing: salutation");

    return {
      currencyId: requireShopwareId(currency, "currency EUR"),
      taxId: defaultTaxId,
      taxRateMap,
      customerGroupId: requireShopwareId(customerGroup, "customer group"),
      paymentMethodId: requireShopwareId(paymentMethod, "payment method"),
      salesChannelId: requireShopwareId(shopwareSalesChannel, "sales channel"),
      salutationId: defaultSalutationId,
      salutationsByKey,
      countriesByIso,
    };
  }

  private async searchFirst(
    salesChannelConfig: SalesChannelConfig,
    token: string,
    entity: string,
    criteria: Record<string, unknown>,
  ) {
    const rows = await this.searchMany(salesChannelConfig, token, entity, {
      limit: 1,
      ...criteria,
    });
    return rows[0] ?? null;
  }

  private async searchMany(
    salesChannelConfig: SalesChannelConfig,
    token: string,
    entity: string,
    criteria: Record<string, unknown>,
  ): Promise<Array<{ id: string; attributes: Record<string, unknown> }>> {
    const response = await fetch(
      `${salesChannelConfig.apiUrl.replace(/\/$/, "")}/api/search/${entity}`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(criteria),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new ShopwareHttpError(
        `Shopware reference lookup failed for ${entity} (${response.status}): ${body}`,
        response.status,
      );
    }

    const payload = (await response.json()) as {
      data?: Array<{ id?: unknown; attributes?: unknown }>;
    };
    return (payload.data ?? []).flatMap((row) =>
      typeof row.id === "string" && row.attributes && typeof row.attributes === "object"
        ? [{ id: row.id, attributes: row.attributes as Record<string, unknown> }]
        : [],
    );
  }

  private async fetchToken(salesChannelConfig: SalesChannelConfig): Promise<string> {
    const credentials = parseShopwareCredentials(salesChannelConfig.credentials);
    const response = await fetch(
      `${salesChannelConfig.apiUrl.replace(/\/$/, "")}/api/oauth/token`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          grant_type: "client_credentials",
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new ShopwareHttpError(
        `Shopware OAuth failed (${response.status}): ${body}`,
        response.status,
      );
    }

    const tokenResponse = (await response.json()) as { access_token?: unknown };
    if (typeof tokenResponse.access_token !== "string") {
      throw new Error("Shopware OAuth response did not include access_token");
    }
    return tokenResponse.access_token;
  }
}

function requireShopwareId(
  row: { id: string; attributes: Record<string, unknown> } | null,
  label: string,
): string {
  if (!row) throw new Error(`Shopware reference missing: ${label}`);
  return row.id;
}

function normalizeShopwarePrice(value: unknown, fallbackCurrencyId: string) {
  if (!Array.isArray(value) || value.length === 0) {
    return [{ currencyId: fallbackCurrencyId, gross: 0, net: 0, linked: true }];
  }
  return value.map((entry) => {
    const p = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
    const gross = typeof p.gross === "number" ? p.gross : 0;
    const net = typeof p.net === "number" ? p.net : gross;
    return {
      currencyId: typeof p.currencyId === "string" ? p.currencyId : fallbackCurrencyId,
      gross,
      net,
      linked: p.linked !== false,
    };
  });
}

function parseShopwareCredentials(credentials: unknown) {
  if (!credentials || typeof credentials !== "object") {
    throw new Error("Shopware credentials are missing");
  }
  const record = credentials as Record<string, unknown>;
  const clientId = record.clientId ?? record.client_id;
  const clientSecret = record.clientSecret ?? record.client_secret;
  if (typeof clientId !== "string" || typeof clientSecret !== "string") {
    throw new Error("Shopware credentials require clientId/clientSecret");
  }
  // The secret is stored encrypted at rest; decryptSecret returns legacy
  // plaintext values unchanged.
  return { clientId, clientSecret: decryptSecret(clientSecret) };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Flatten a raw Shopware `order` entity (with nested associations) into {@link ShopwareOrder}. */
export function normalizeShopwareOrder(raw: Record<string, unknown>): ShopwareOrder {
  const price = asRecord(raw.price);
  const oc = asRecord(raw.orderCustomer);
  const ba = asRecord(raw.billingAddress);
  const baCountry = ba ? asRecord(ba.country) : null;
  const currency = asRecord(raw.currency);

  const transactions = Array.isArray(raw.transactions) ? raw.transactions : [];
  const latestTx =
    transactions
      .map(asRecord)
      .filter((t): t is Record<string, unknown> => t !== null)
      .sort((a, b) =>
        (asString(b.createdAt) ?? "").localeCompare(asString(a.createdAt) ?? ""),
      )[0] ?? null;
  const paymentState = latestTx
    ? asString(asRecord(latestTx.stateMachineState)?.technicalName)
    : null;

  const deliveries = Array.isArray(raw.deliveries) ? raw.deliveries : [];
  const firstDelivery =
    deliveries.map(asRecord).find((d): d is Record<string, unknown> => d !== null) ?? null;
  const shippingState = firstDelivery
    ? asString(asRecord(firstDelivery.stateMachineState)?.technicalName)
    : null;

  const ocVatIds = oc && Array.isArray(oc.vatIds) ? oc.vatIds : [];

  const lineItemsRaw = Array.isArray(raw.lineItems) ? raw.lineItems : [];
  const lines: ShopwareOrderLine[] = lineItemsRaw
    .map(asRecord)
    .filter((li): li is Record<string, unknown> => li !== null)
    .map((li) => {
      const liPrice = asRecord(li.price);
      const calcTaxes =
        liPrice && Array.isArray(liPrice.calculatedTaxes) ? liPrice.calculatedTaxes : [];
      const firstTax =
        calcTaxes.map(asRecord).find((t): t is Record<string, unknown> => t !== null) ?? null;
      const payload = asRecord(li.payload);
      return {
        type: asString(li.type),
        referencedId: asString(li.referencedId) ?? asString(li.productId),
        productNumber: payload ? asString(payload.productNumber) : null,
        label: asString(li.label),
        quantity: asNumber(li.quantity) ?? 0,
        unitPrice: asNumber(li.unitPrice) ?? (liPrice ? (asNumber(liPrice.unitPrice) ?? 0) : 0),
        taxRate: firstTax ? asNumber(firstTax.taxRate) : null,
      };
    });

  return {
    orderId: asString(raw.id) ?? "",
    orderNumber: asString(raw.orderNumber) ?? "",
    orderDateTime: asString(raw.orderDateTime) ?? new Date().toISOString(),
    taxStatus: asString(raw.taxStatus) ?? (price ? asString(price.taxStatus) : null),
    currencyIso: currency ? asString(currency.isoCode) : null,
    customer: oc
      ? {
          customerId: asString(oc.customerId),
          customerNumber: asString(oc.customerNumber),
          email: asString(oc.email),
          firstName: asString(oc.firstName),
          lastName: asString(oc.lastName),
          company: asString(oc.company),
          vatId: ocVatIds.length > 0 ? asString(ocVatIds[0]) : null,
        }
      : null,
    billingAddress: ba
      ? {
          firstName: asString(ba.firstName),
          lastName: asString(ba.lastName),
          company: asString(ba.company),
          street: asString(ba.street),
          zipcode: asString(ba.zipcode),
          city: asString(ba.city),
          countryIso: baCountry ? asString(baCountry.iso) : null,
          phoneNumber: asString(ba.phoneNumber),
        }
      : null,
    paymentState,
    shippingState,
    lines,
  };
}

const DLQ_MAX_ATTEMPTS = 5;

function dlqNextRetryMs(attemptCount: number): number {
  // 1 min, 2 min, 4 min, 8 min (capped at 8 min after that)
  return 60_000 * Math.min(2 ** (attemptCount - 1), 8);
}

export class CommerceSyncService {
  constructor(
    private readonly tenantId: string,
    private readonly userId: string | null,
    private readonly adapterFactory: (
      salesChannel: SalesChannelConfig,
    ) => CommerceSyncAdapter = () => new Shopware6Adapter(),
  ) {}

  async start(plan: CommerceSyncPlan) {
    if (plan.direction === "pull") {
      return this.runOrderImport(plan);
    }
    if (plan.direction !== "push") {
      throw new Error(`Unsupported commerce sync direction: ${plan.direction}`);
    }

    const channel = await this.getSalesChannel(plan.salesChannelId);
    const entities = normalizeEntities(plan.entities, plan.mode);
    const batchSize = plan.batchSize ?? 100;
    const forceFullSync = plan.forceFullSync ?? false;
    const [run] = await db
      .insert(commerceSyncRun)
      .values({
        tenantId: this.tenantId,
        salesChannelId: channel.salesChannelId,
        direction: plan.direction,
        mode: plan.mode,
        status: "running",
        requestedEntities: entities,
        dryRun: Boolean(plan.dryRun),
        startedAt: new Date(),
        createdByUserId: this.userId,
      })
      .returning();

    let total = 0;
    let succeeded = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const [entityIndex, entity] of entities.entries()) {
      const allItems =
        entity === "address"
          ? await this.buildAddressItems()
          : entity === "category"
            ? await this.buildCategoryItems()
            : entity === "media_asset"
              ? await this.buildMediaItems(channel.salesChannelId)
              : await this.buildArticleItems();

      // Delta sync: drop items unchanged since the last successful push. Force-full
      // bypasses the diff to re-push everything.
      const { items, skipped: unchanged } = forceFullSync
        ? { items: allItems, skipped: 0 }
        : await this.filterUnchangedItems(channel, entity, allItems);

      if (items.length === 0) {
        await this.recordStep({
          runId: run.runId,
          channel,
          entity,
          sequence: entityIndex,
          status: "skipped",
          phase: "push",
          plannedItems: 0,
          succeededItems: 0,
          failedItems: 0,
          payloadSummary: { items: 0, candidates: allItems.length, unchanged },
        });
        continue;
      }

      const batches = splitIntoBatches(items, batchSize);

      for (const [batchIndex, batchItems] of batches.entries()) {
        total += batchItems.length;
        const step = await this.recordStep({
          runId: run.runId,
          channel,
          entity,
          sequence: entityIndex,
          batchNo: batchIndex,
          status: "running",
          phase: "push",
          plannedItems: batchItems.length,
          succeededItems: 0,
          failedItems: 0,
          payloadSummary:
            batchIndex === 0
              ? { entity, items: batchItems.length, unchanged }
              : { entity, items: batchItems.length },
        });

        if (plan.dryRun) {
          succeeded += batchItems.length;
          await this.finishStep(step.stepId, "success", batchItems.length, 0);
          continue;
        }

        try {
          const result = await this.adapterFactory(channel).pushBatch({
            salesChannel: channel,
            items: batchItems,
          });

          await this.persistMappings(channel, entity, result.externalIds);

          if (result.rejected.length > 0) {
            await this.writeToDlq({
              runId: run.runId,
              channel,
              entity,
              failed: result.rejected,
            });
          }

          succeeded += result.accepted;
          failed += result.rejected.length;
          if (result.rejected.length > 0) {
            errors.push(
              `${entity} batch ${batchIndex}: ${result.rejected.length} item(s) rejected — ${result.rejected[0].error}`,
            );
          }
          await this.finishStep(
            step.stepId,
            result.rejected.length === result.accepted + result.rejected.length
              ? "error"
              : "success",
            result.accepted,
            result.rejected.length,
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown commerce sync error";
          failed += batchItems.length;
          errors.push(`${entity}: ${message}`);
          await this.writeToDlq({
            runId: run.runId,
            channel,
            entity,
            failed: batchItems.map((item) => ({ internalId: item.internalId, error: message })),
          });
          await this.finishStep(step.stepId, "error", 0, batchItems.length, message);
        }
      }
    }

    const status = failed === 0 ? "success" : succeeded > 0 ? "partial_error" : "error";
    const [updated] = await db
      .update(commerceSyncRun)
      .set({
        status,
        totalItems: total,
        succeededItems: succeeded,
        failedItems: failed,
        errorSummary: errors.length > 0 ? errors.join("\n") : null,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(commerceSyncRun.runId, run.runId))
      .returning();

    return { run: updated, steps: await this.listSteps(run.runId) };
  }

  async get(runId: string) {
    const [run] = await db
      .select()
      .from(commerceSyncRun)
      .where(and(eq(commerceSyncRun.tenantId, this.tenantId), eq(commerceSyncRun.runId, runId)))
      .limit(1);
    if (!run) return null;
    return { run, steps: await this.listSteps(runId) };
  }

  async listRuns(filter?: { salesChannelId?: string; status?: string; limit?: number }) {
    const conditions = [eq(commerceSyncRun.tenantId, this.tenantId)];
    if (filter?.salesChannelId)
      conditions.push(eq(commerceSyncRun.salesChannelId, filter.salesChannelId));
    if (filter?.status)
      conditions.push(
        eq(
          commerceSyncRun.status,
          filter.status as (typeof commerceSyncRun.status.enumValues)[number],
        ),
      );

    const rows = await db
      .select()
      .from(commerceSyncRun)
      .where(and(...conditions))
      .orderBy(desc(commerceSyncRun.createdAt))
      .limit(Math.min(filter?.limit ?? 100, 500));

    const runs = rows.map((row) => ({
      ...row,
      requestedEntities: Array.isArray(row.requestedEntities)
        ? (row.requestedEntities as string[])
        : [],
    }));

    return { runs };
  }

  async cancel(runId: string) {
    const [run] = await db
      .update(commerceSyncRun)
      .set({ status: "cancel_requested", cancelRequestedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(commerceSyncRun.tenantId, this.tenantId), eq(commerceSyncRun.runId, runId)))
      .returning();
    return run ?? null;
  }

  async listDeadLetter(salesChannelId?: string, status?: "pending" | "resolved" | "abandoned") {
    const conditions = [eq(commerceSyncDeadLetter.tenantId, this.tenantId)];
    if (salesChannelId) conditions.push(eq(commerceSyncDeadLetter.salesChannelId, salesChannelId));
    if (status) conditions.push(eq(commerceSyncDeadLetter.status, status));

    const items = await db
      .select()
      .from(commerceSyncDeadLetter)
      .where(and(...conditions))
      .orderBy(commerceSyncDeadLetter.lastAttemptedAt);

    return { items };
  }

  async retryDeadLetter(salesChannelId: string) {
    const channel = await this.getSalesChannel(salesChannelId);
    const now = new Date();

    const pendingItems = await db
      .select()
      .from(commerceSyncDeadLetter)
      .where(
        and(
          eq(commerceSyncDeadLetter.tenantId, this.tenantId),
          eq(commerceSyncDeadLetter.salesChannelId, salesChannelId),
          eq(commerceSyncDeadLetter.status, "pending"),
          or(
            isNull(commerceSyncDeadLetter.nextRetryAt),
            lte(commerceSyncDeadLetter.nextRetryAt, now),
          ),
        ),
      );

    if (pendingItems.length === 0) {
      return { attempted: 0, resolved: 0, stillFailed: 0, abandoned: 0 };
    }

    const byEntity = new Map<CommerceSyncEntity, typeof pendingItems>();
    for (const item of pendingItems) {
      const entity = item.entityType as CommerceSyncEntity;
      const group = byEntity.get(entity) ?? [];
      group.push(item);
      byEntity.set(entity, group);
    }

    let resolved = 0;
    let stillFailed = 0;
    let abandoned = 0;

    for (const [entity, dlqItems] of byEntity.entries()) {
      const internalIds = dlqItems.map((i) => i.internalId);
      const syncItems =
        entity === "address"
          ? await this.buildAddressItemsForIds(internalIds)
          : entity === "category"
            ? await this.buildCategoryItemsForIds(internalIds)
            : entity === "media_asset"
              ? await this.buildMediaItemsForIds(internalIds, channel.salesChannelId)
              : await this.buildArticleItemsForIds(internalIds);

      // Items no longer in DB (archived/deleted): resolve as no longer active
      const foundIds = new Set(syncItems.map((i) => i.internalId));
      for (const dlqItem of dlqItems) {
        if (!foundIds.has(dlqItem.internalId)) {
          await db
            .update(commerceSyncDeadLetter)
            .set({ status: "resolved", resolvedAt: now, updatedAt: now })
            .where(eq(commerceSyncDeadLetter.itemId, dlqItem.itemId));
          resolved++;
        }
      }

      if (syncItems.length === 0) continue;

      let result: ShopSyncBatchResult;
      try {
        result = await this.adapterFactory(channel).pushBatch({
          salesChannel: channel,
          items: syncItems,
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        result = {
          accepted: 0,
          externalIds: [],
          rejected: syncItems.map((i) => ({ internalId: i.internalId, error: msg })),
        };
      }

      for (const { internalId, externalId, payloadSnapshot } of result.externalIds) {
        const dlqItem = dlqItems.find((i) => i.internalId === internalId);
        if (!dlqItem) continue;
        await db
          .update(commerceSyncDeadLetter)
          .set({ status: "resolved", resolvedAt: now, updatedAt: now })
          .where(eq(commerceSyncDeadLetter.itemId, dlqItem.itemId));
        await this.persistMappings(channel, entity, [{ internalId, externalId, payloadSnapshot }]);
        resolved++;
      }

      for (const { internalId, error } of result.rejected) {
        const dlqItem = dlqItems.find((i) => i.internalId === internalId);
        if (!dlqItem) continue;
        const newAttemptCount = dlqItem.attemptCount + 1;
        const newStatus: "pending" | "abandoned" =
          newAttemptCount >= DLQ_MAX_ATTEMPTS ? "abandoned" : "pending";
        await db
          .update(commerceSyncDeadLetter)
          .set({
            errorMessage: error,
            attemptCount: newAttemptCount,
            lastAttemptedAt: now,
            nextRetryAt:
              newStatus === "pending"
                ? new Date(now.getTime() + dlqNextRetryMs(newAttemptCount))
                : null,
            status: newStatus,
            updatedAt: now,
          })
          .where(eq(commerceSyncDeadLetter.itemId, dlqItem.itemId));
        if (newStatus === "abandoned") abandoned++;
        else stillFailed++;
      }
    }

    return { attempted: pendingItems.length, resolved, stillFailed, abandoned };
  }

  // ---- Order import (pull) -------------------------------------------------

  /**
   * Pull shop orders and import them as draft sales orders (document type "A").
   * Incremental by default: only orders placed at/after the last successful pull
   * run are fetched, and already-imported orders are additionally skipped via
   * `external_sync_mapping`. Orders that fail to import are deliberately NOT
   * mapped, so the next run retries them naturally — the pull path writes no
   * dead-letter rows (the DLQ retry machinery is push-oriented).
   */
  private async runOrderImport(plan: CommerceSyncPlan) {
    const channel = await this.getSalesChannel(plan.salesChannelId);
    const forceFullSync = plan.forceFullSync ?? false;

    const [run] = await db
      .insert(commerceSyncRun)
      .values({
        tenantId: this.tenantId,
        salesChannelId: channel.salesChannelId,
        direction: "pull",
        mode: plan.mode,
        status: "running",
        requestedEntities: ["document"],
        dryRun: Boolean(plan.dryRun),
        startedAt: new Date(),
        createdByUserId: this.userId,
      })
      .returning();

    let total = 0;
    let succeeded = 0;
    let failed = 0;
    let skipped = 0;
    const errors: string[] = [];

    const step = await this.recordStep({
      runId: run.runId,
      channel,
      entity: "document",
      sequence: 0,
      status: "running",
      phase: "pull",
      plannedItems: 0,
      succeededItems: 0,
      failedItems: 0,
      payloadSummary: { entity: "document" },
    });

    try {
      const adapter = this.adapterFactory(channel);
      if (!adapter.pullOrders) {
        throw new Error(`Order import is not supported for platform: ${channel.platform}`);
      }

      const since = forceFullSync
        ? undefined
        : await this.lastSuccessfulPullAt(channel.salesChannelId);
      const orders = await adapter.pullOrders({ salesChannel: channel, since });

      const orderGroupId = orders.length > 0 ? await this.resolveOrderDocumentGroupId() : null;
      const resolution = orders.length > 0 ? await this.buildVariantResolution() : null;
      const alreadyImported = await this.loadImportedOrderIds(
        channel.salesChannelId,
        orders.map((o) => o.orderId),
      );

      for (const order of orders) {
        if (alreadyImported.has(order.orderId)) {
          skipped++;
          continue;
        }
        total++;
        if (plan.dryRun) {
          succeeded++;
          continue;
        }
        try {
          if (!orderGroupId) throw new Error('No order document group (type "A") found');
          await this.importOrder(channel, order, orderGroupId, resolution!);
          succeeded++;
        } catch (error) {
          failed++;
          const message = error instanceof Error ? error.message : "Unknown order import error";
          errors.push(`order ${order.orderNumber || order.orderId}: ${message}`);
        }
      }

      await db
        .update(commerceSyncRunStep)
        .set({
          status: failed === 0 ? "success" : "error",
          plannedItems: total,
          succeededItems: succeeded,
          failedItems: failed,
          payloadSummary: {
            entity: "document",
            pulled: orders.length,
            imported: succeeded,
            skipped,
            failed,
          },
          errorSummary: errors.length > 0 ? errors.join("\n") : null,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(commerceSyncRunStep.stepId, step.stepId));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown order import error";
      errors.push(message);
      if (failed === 0) failed = 1;
      await this.finishStep(step.stepId, "error", succeeded, failed, message);
    }

    const status = failed === 0 ? "success" : succeeded > 0 ? "partial_error" : "error";
    const [updated] = await db
      .update(commerceSyncRun)
      .set({
        status,
        totalItems: total,
        succeededItems: succeeded,
        failedItems: failed,
        errorSummary: errors.length > 0 ? errors.join("\n") : null,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(commerceSyncRun.runId, run.runId))
      .returning();

    return { run: updated, steps: await this.listSteps(run.runId) };
  }

  /** Timestamp (startedAt) of the most recent non-failed pull run for the delta gate. */
  private async lastSuccessfulPullAt(salesChannelId: string): Promise<Date | undefined> {
    const [row] = await db
      .select({ startedAt: commerceSyncRun.startedAt })
      .from(commerceSyncRun)
      .where(
        and(
          eq(commerceSyncRun.tenantId, this.tenantId),
          eq(commerceSyncRun.salesChannelId, salesChannelId),
          eq(commerceSyncRun.direction, "pull"),
          inArray(commerceSyncRun.status, ["success", "partial_error"]),
        ),
      )
      .orderBy(desc(commerceSyncRun.startedAt))
      .limit(1);
    return row?.startedAt ?? undefined;
  }

  /** The order document group (type "A", lowest group number). */
  private async resolveOrderDocumentGroupId(): Promise<string | null> {
    const [grp] = await db
      .select({ documentGroupId: documentGroup.documentGroupId })
      .from(documentGroup)
      .where(
        and(
          eq(documentGroup.tenantId, this.tenantId),
          eq(documentGroup.documentType, "A"),
          eq(documentGroup.archived, false),
        ),
      )
      .orderBy(documentGroup.groupNumber)
      .limit(1);
    return grp?.documentGroupId ?? null;
  }

  /** External order ids already imported for this channel (idempotency gate). */
  private async loadImportedOrderIds(
    salesChannelId: string,
    orderIds: string[],
  ): Promise<Set<string>> {
    if (orderIds.length === 0) return new Set();
    const rows = await db
      .select({ externalId: externalSyncMapping.externalId })
      .from(externalSyncMapping)
      .where(
        and(
          eq(externalSyncMapping.tenantId, this.tenantId),
          eq(externalSyncMapping.salesChannelId, salesChannelId),
          eq(externalSyncMapping.entityType, "document"),
          inArray(externalSyncMapping.externalId, orderIds),
        ),
      );
    return new Set(rows.map((r) => r.externalId));
  }

  private async buildVariantResolution(): Promise<VariantResolution> {
    const rows = await db
      .select({
        variantId: articleVariant.variantId,
        articleId: articleVariant.articleId,
        sku: articleVariant.sku,
      })
      .from(articleVariant)
      .where(and(eq(articleVariant.tenantId, this.tenantId), eq(articleVariant.isActive, true)));

    const bySku = new Map<string, string>();
    const byHash = new Map<string, string>();
    const variantsPerArticle = new Map<string, string[]>();
    for (const r of rows) {
      if (r.sku) bySku.set(r.sku, r.variantId);
      byHash.set(stableShopwareId("article-variant", r.variantId), r.variantId);
      const arr = variantsPerArticle.get(r.articleId) ?? [];
      arr.push(r.variantId);
      variantsPerArticle.set(r.articleId, arr);
    }
    const byArticleHash = new Map<string, string>();
    for (const [articleId, variantIds] of variantsPerArticle) {
      if (variantIds.length === 1) {
        byArticleHash.set(stableShopwareId("article", articleId), variantIds[0]);
      }
    }
    return { bySku, byHash, byArticleHash };
  }

  private resolveVariantId(line: ShopwareOrderLine, resolution: VariantResolution): string | null {
    if (line.productNumber) {
      const bySku = resolution.bySku.get(line.productNumber);
      if (bySku) return bySku;
    }
    if (line.referencedId) {
      return (
        resolution.byHash.get(line.referencedId) ??
        resolution.byArticleHash.get(line.referencedId) ??
        null
      );
    }
    return null;
  }

  /** Resolve the internal customer address for an order, auto-creating one if needed. */
  private async resolveOrderCustomer(
    channel: SalesChannelConfig,
    order: ShopwareOrder,
  ): Promise<string> {
    const customer = order.customer;

    if (customer?.customerId) {
      const [mapped] = await db
        .select({ internalId: externalSyncMapping.internalId })
        .from(externalSyncMapping)
        .where(
          and(
            eq(externalSyncMapping.tenantId, this.tenantId),
            eq(externalSyncMapping.salesChannelId, channel.salesChannelId),
            eq(externalSyncMapping.entityType, "address"),
            eq(externalSyncMapping.externalId, customer.customerId),
          ),
        )
        .limit(1);
      if (mapped) {
        const [exists] = await db
          .select({ addressId: address.addressId })
          .from(address)
          .where(
            and(
              eq(address.tenantId, this.tenantId),
              eq(address.addressId, mapped.internalId),
              isNull(address.archivedAt),
            ),
          )
          .limit(1);
        if (exists) return exists.addressId;
      }
    }

    if (customer?.customerNumber) {
      const [byNo] = await db
        .select({ addressId: address.addressId })
        .from(address)
        .where(
          and(
            eq(address.tenantId, this.tenantId),
            eq(address.addressNo, customer.customerNumber),
            isNull(address.archivedAt),
          ),
        )
        .limit(1);
      if (byNo) {
        await this.upsertCustomerMapping(channel, customer.customerId, byNo.addressId);
        return byNo.addressId;
      }
    }

    if (customer?.email) {
      const [byEmail] = await db
        .select({ addressId: address.addressId })
        .from(address)
        .where(
          and(
            eq(address.tenantId, this.tenantId),
            eq(address.email, customer.email),
            isNull(address.archivedAt),
          ),
        )
        .limit(1);
      if (byEmail) {
        await this.upsertCustomerMapping(channel, customer.customerId, byEmail.addressId);
        return byEmail.addressId;
      }
    }

    return this.createCustomerFromOrder(channel, order);
  }

  private async createCustomerFromOrder(
    channel: SalesChannelConfig,
    order: ShopwareOrder,
  ): Promise<string> {
    const customer = order.customer;
    const ba = order.billingAddress;
    const addressNo =
      customer?.customerNumber?.trim() || `SHOP-${order.orderNumber || order.orderId.slice(0, 8)}`;
    const countryCode = (ba?.countryIso ?? "DE").slice(0, 2).toUpperCase();

    const [created] = await db
      .insert(address)
      .values({
        tenantId: this.tenantId,
        addressNo,
        isCustomer: true,
        shopActive: true,
        companyName: customer?.company ?? ba?.company ?? null,
        firstName: customer?.firstName ?? ba?.firstName ?? null,
        lastName: customer?.lastName ?? ba?.lastName ?? null,
        addressLine1: ba?.street ?? "-",
        postalCode: ba?.zipcode ?? "-",
        city: ba?.city ?? "-",
        countryCode,
        email: customer?.email ?? null,
        vatId: customer?.vatId ?? null,
        phoneLandline: ba?.phoneNumber ?? null,
        customAttributes: {
          source: "shopware",
          salesChannelId: channel.salesChannelId,
          shopwareCustomerId: customer?.customerId ?? null,
        },
      })
      .onConflictDoNothing({ target: [address.tenantId, address.addressNo] })
      .returning({ addressId: address.addressId });

    let addressId = created?.addressId;
    if (!addressId) {
      const [existing] = await db
        .select({ addressId: address.addressId })
        .from(address)
        .where(and(eq(address.tenantId, this.tenantId), eq(address.addressNo, addressNo)))
        .limit(1);
      if (!existing) throw new Error(`Failed to create or resolve customer address "${addressNo}"`);
      addressId = existing.addressId;
    }

    await this.upsertCustomerMapping(channel, customer?.customerId ?? null, addressId);
    return addressId;
  }

  private async upsertCustomerMapping(
    channel: SalesChannelConfig,
    externalCustomerId: string | null,
    addressId: string,
  ): Promise<void> {
    if (!externalCustomerId) return;
    const now = new Date();
    await db
      .insert(externalSyncMapping)
      .values({
        tenantId: this.tenantId,
        salesChannelId: channel.salesChannelId,
        sourceSystem: "sales_channel",
        entityType: "address",
        internalId: addressId,
        externalId: externalCustomerId,
        syncDirection: "pull",
        lastSyncAt: now,
        syncStatus: "success",
      })
      .onConflictDoUpdate({
        target: [
          externalSyncMapping.tenantId,
          externalSyncMapping.salesChannelId,
          externalSyncMapping.entityType,
          externalSyncMapping.internalId,
        ],
        set: { externalId: externalCustomerId, lastSyncAt: now, syncStatus: "success" },
      });
  }

  /** Map a single Shopware order to a draft sales order document + lines. */
  private async importOrder(
    channel: SalesChannelConfig,
    order: ShopwareOrder,
    orderGroupId: string,
    resolution: VariantResolution,
  ): Promise<void> {
    const customerId = await this.resolveOrderCustomer(channel, order);
    const documentDate = order.orderDateTime.slice(0, 10);
    const billingCountryCode = order.billingAddress?.countryIso?.slice(0, 2).toUpperCase() ?? null;
    const docService = new DocumentService();

    const lines: DraftDocumentLineInput[] = [];
    let lineNo = 0;
    for (const line of order.lines) {
      lineNo++;
      const quantity = line.quantity || 0;

      if (line.type === "product") {
        const variantId = this.resolveVariantId(line, resolution);
        if (variantId) {
          const pricing = await docService.resolveVariantPricing(
            variantId,
            customerId,
            documentDate,
            { billingCountryCode },
          );
          const rate = toDecimalNumber(pricing.taxRate ?? null) ?? line.taxRate ?? 0;
          const netPrice = deriveUnitNet(line.unitPrice, order.taxStatus, rate);
          const { lineTotalNet, taxAmount } = computeOrderLineFinancials(netPrice, quantity, rate);
          lines.push({
            lineNo,
            variantId,
            quantity,
            netPrice,
            lineType: "article",
            articleTextSnapshot: line.label,
            taxCodeId: pricing.taxCodeId,
            taxRuleId: pricing.taxRuleId,
            taxCountryCodeUsed: pricing.taxCountryCodeUsed,
            taxRateSnapshot: rate,
            taxAmount,
            lineTotalNet,
          });
          continue;
        }
        // Unresolved product: keep as a comment line so the order still imports.
        lines.push({
          lineNo,
          variantId: null,
          quantity,
          netPrice: 0,
          lineType: "comment",
          articleTextSnapshot: `[unmapped] ${
            line.label ?? line.productNumber ?? line.referencedId ?? "product"
          }`,
        });
        continue;
      }

      // Non-product lines (shipping, promotion, …): the document_line check
      // constraint only allows a fixed set of line types, so these are stored as
      // `comment` lines but still carry their amount so the document total matches
      // Shopware. Tax rate comes from the line if Shopware sent one.
      const rate = line.taxRate ?? 0;
      const qty = quantity || 1;
      const netPrice = deriveUnitNet(line.unitPrice, order.taxStatus, rate);
      const { lineTotalNet, taxAmount } = computeOrderLineFinancials(netPrice, qty, rate);
      const labelPrefix = line.type && line.type !== "comment" ? `[${line.type}] ` : "";
      lines.push({
        lineNo,
        variantId: null,
        quantity: qty,
        netPrice,
        lineType: "comment",
        articleTextSnapshot: `${labelPrefix}${line.label ?? line.type ?? "Position"}`,
        taxRateSnapshot: rate,
        taxAmount,
        lineTotalNet,
      });
    }

    const customAttributes = {
      source: "shopware",
      salesChannelId: channel.salesChannelId,
      shopwareOrderId: order.orderId,
      shopwareOrderNumber: order.orderNumber,
      paymentState: order.paymentState,
      shippingState: order.shippingState,
    };
    const billingSnapshot = order.billingAddress ? { ...order.billingAddress } : null;
    const header = {
      documentGroupId: orderGroupId,
      documentType: "A",
      documentDirection: "OUTBOUND",
      documentDate,
      customerId,
      currencyId: order.currencyIso ?? null,
      billingAddress: billingSnapshot,
      customAttributes,
    };

    const created = await docService.createDocument({ ...header, status: "draft" });
    await docService.saveDocumentDraft(this.userId ?? "", {
      ...header,
      documentId: created.documentId,
      lines,
    });

    const now = new Date();
    await db
      .insert(externalSyncMapping)
      .values({
        tenantId: this.tenantId,
        salesChannelId: channel.salesChannelId,
        sourceSystem: "sales_channel",
        entityType: "document",
        internalId: created.documentId,
        externalId: order.orderId,
        externalVersion: order.orderNumber,
        syncDirection: "pull",
        payloadSnapshot: {
          shopwareOrderNumber: order.orderNumber,
          paymentState: order.paymentState,
          shippingState: order.shippingState,
        },
        lastSyncAt: now,
        syncStatus: "success",
      })
      .onConflictDoUpdate({
        target: [
          externalSyncMapping.tenantId,
          externalSyncMapping.salesChannelId,
          externalSyncMapping.entityType,
          externalSyncMapping.internalId,
        ],
        set: { externalId: order.orderId, lastSyncAt: now, syncStatus: "success" },
      });
  }

  private async getSalesChannel(salesChannelId: string): Promise<SalesChannelConfig> {
    const [row] = await db
      .select()
      .from(salesChannel)
      .where(
        and(
          eq(salesChannel.tenantId, this.tenantId),
          eq(salesChannel.salesChannelId, salesChannelId),
          eq(salesChannel.isActive, true),
        ),
      )
      .limit(1);
    if (!row) throw new Error("Sales channel not found");
    if (row.platform !== "shopware6")
      throw new Error(`Unsupported commerce platform: ${row.platform}`);
    return {
      salesChannelId: row.salesChannelId,
      platform: row.platform,
      apiUrl: row.apiUrl,
      credentials: row.credentials,
    };
  }

  private static readonly addressSelect = {
    addressId: address.addressId,
    addressNo: address.addressNo,
    isCustomer: address.isCustomer,
    isSupplier: address.isSupplier,
    companyName: address.companyName,
    firstName: address.firstName,
    lastName: address.lastName,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    postalCode: address.postalCode,
    city: address.city,
    countryCode: address.countryCode,
    vatId: address.vatId,
    email: address.email,
    phoneLandline: address.phoneLandline,
    phoneMobile: address.phoneMobile,
    salutation: address.salutation,
  } as const;

  private static mapAddressRows(rows: AddressRow[]): SyncItem[] {
    return rows.map((row) => {
      const mapped = mapAddressToShopwareCustomer(row);
      return {
        internalId: mapped.internalId,
        entity: "address" as const,
        payload: mapped.payload,
        salutationKey: mapped.salutationKey,
      };
    });
  }

  private async buildAddressItems(): Promise<SyncItem[]> {
    const rows = await db
      .select(CommerceSyncService.addressSelect)
      .from(address)
      .where(
        and(
          eq(address.tenantId, this.tenantId),
          eq(address.shopActive, true),
          isNull(address.archivedAt),
        ),
      );

    return CommerceSyncService.mapAddressRows(rows);
  }

  private async buildAddressItemsForIds(internalIds: string[]): Promise<SyncItem[]> {
    if (internalIds.length === 0) return [];
    const rows = await db
      .select(CommerceSyncService.addressSelect)
      .from(address)
      .where(
        and(
          eq(address.tenantId, this.tenantId),
          inArray(address.addressId, internalIds),
          isNull(address.archivedAt),
        ),
      );

    return CommerceSyncService.mapAddressRows(rows);
  }

  private async loadArticleTaxRates(): Promise<Map<string, string>> {
    const rules = await db
      .select({
        articleTaxClassId: taxRule.articleTaxClassId,
        rate: taxCode.taxRate,
      })
      .from(taxRule)
      .innerJoin(taxCode, eq(taxRule.taxCodeId, taxCode.taxCodeId))
      .where(
        and(
          eq(taxRule.tenantId, this.tenantId),
          lte(taxRule.validFrom, sql`CURRENT_DATE`),
          or(isNull(taxRule.validTo), sql`${taxRule.validTo} >= CURRENT_DATE`),
        ),
      );
    const map = new Map<string, string>();
    for (const r of rules) {
      if (r.articleTaxClassId && !map.has(r.articleTaxClassId)) {
        map.set(r.articleTaxClassId, r.rate);
      }
    }
    return map;
  }

  private async buildArticleItems(): Promise<SyncItem[]> {
    const [articles, taxRates] = await Promise.all([
      db
        .select({
          articleId: article.articleId,
          articleNo: article.articleNo,
          name: article.name,
          description: article.description,
          kurzbeschreibung: article.kurzbeschreibung,
          langtext: article.langtext,
          taxClassId: article.taxClassId,
        })
        .from(article)
        .where(and(eq(article.tenantId, this.tenantId), isNull(article.archivedAt))),
      this.loadArticleTaxRates(),
    ]);

    const enriched: ArticleRow[] = articles.map((a) => ({
      ...a,
      langtext: a.langtext ?? null,
      taxRate: a.taxClassId ? (taxRates.get(a.taxClassId) ?? null) : null,
    }));

    return this.articlesWithVariantsToItems(enriched);
  }

  private async buildArticleItemsForIds(internalIds: string[]): Promise<SyncItem[]> {
    if (internalIds.length === 0) return [];
    const [articles, taxRates] = await Promise.all([
      db
        .select({
          articleId: article.articleId,
          articleNo: article.articleNo,
          name: article.name,
          description: article.description,
          kurzbeschreibung: article.kurzbeschreibung,
          langtext: article.langtext,
          taxClassId: article.taxClassId,
        })
        .from(article)
        .where(
          and(
            eq(article.tenantId, this.tenantId),
            inArray(article.articleId, internalIds),
            isNull(article.archivedAt),
          ),
        ),
      this.loadArticleTaxRates(),
    ]);

    const enriched: ArticleRow[] = articles.map((a) => ({
      ...a,
      langtext: a.langtext ?? null,
      taxRate: a.taxClassId ? (taxRates.get(a.taxClassId) ?? null) : null,
    }));

    return this.articlesWithVariantsToItems(enriched);
  }

  private async articlesWithVariantsToItems(articles: ArticleRow[]): Promise<SyncItem[]> {
    if (articles.length === 0) return [];

    const articleIds = articles.map((a) => a.articleId);

    const variants = await db
      .select({
        variantId: articleVariant.variantId,
        articleId: articleVariant.articleId,
        sku: articleVariant.sku,
        ean: articleVariant.ean,
        price: articleVariant.price,
        weight: articleVariant.weight,
        isActive: articleVariant.isActive,
      })
      .from(articleVariant)
      .where(
        and(
          eq(articleVariant.tenantId, this.tenantId),
          inArray(articleVariant.articleId, articleIds),
        ),
      );

    const variantIds = variants.map((v) => v.variantId);

    const [stockRows, optionValueRows, articleCategoryMap, priceListRows, articleMediaMap] =
      await Promise.all([
        variantIds.length > 0
          ? db
              .select({
                variantId: inventoryItem.variantId,
                totalQty: sql<string>`COALESCE(SUM(${inventoryLevel.quantity}), 0)`,
              })
              .from(inventoryItem)
              .leftJoin(inventoryLevel, eq(inventoryLevel.itemId, inventoryItem.itemId))
              .where(
                and(
                  eq(inventoryItem.tenantId, this.tenantId),
                  inArray(inventoryItem.variantId, variantIds),
                ),
              )
              .groupBy(inventoryItem.variantId)
          : Promise.resolve([]),
        variantIds.length > 0
          ? db
              .select({
                variantId: articleVariantOptionValue.variantId,
                valueId: articleOptionValue.valueId,
                value: articleOptionValue.value,
                groupId: articleOption.optionId,
                groupName: articleOption.name,
              })
              .from(articleVariantOptionValue)
              .innerJoin(
                articleOptionValue,
                eq(articleVariantOptionValue.valueId, articleOptionValue.valueId),
              )
              .innerJoin(articleOption, eq(articleOptionValue.optionId, articleOption.optionId))
              .where(
                and(
                  eq(articleVariantOptionValue.tenantId, this.tenantId),
                  inArray(articleVariantOptionValue.variantId, variantIds),
                ),
              )
          : Promise.resolve([]),
        this.loadArticleCategoryIds(articleIds),
        variantIds.length > 0
          ? db
              .select({
                variantId: priceListItem.variantId,
                price: priceListItem.price,
                plName: priceList.name,
                isNet: priceList.isNet,
                currencyId: priceList.currencyId,
              })
              .from(priceListItem)
              .innerJoin(priceList, eq(priceListItem.priceListId, priceList.priceListId))
              .where(
                and(
                  eq(priceListItem.tenantId, this.tenantId),
                  inArray(priceListItem.variantId, variantIds),
                  eq(priceList.archived, false),
                  or(
                    isNull(priceListItem.validFrom),
                    lte(priceListItem.validFrom, sql`CURRENT_DATE`),
                  ),
                  or(isNull(priceListItem.validTo), sql`${priceListItem.validTo} >= CURRENT_DATE`),
                ),
              )
          : Promise.resolve([]),
        this.loadArticleMediaLinks(articleIds),
      ]);

    const stockMap = new Map<string, number>();
    for (const row of stockRows) {
      stockMap.set(row.variantId, Number(row.totalQty) || 0);
    }

    const optionsByVariant = new Map<string, VariantRow["optionValues"]>();
    for (const row of optionValueRows) {
      const arr = optionsByVariant.get(row.variantId) ?? [];
      arr.push({
        groupName: row.groupName,
        groupId: row.groupId,
        valueId: row.valueId,
        value: row.value,
      });
      optionsByVariant.set(row.variantId, arr);
    }

    const pricesByVariant = new Map<string, PriceListPrice[]>();
    for (const row of priceListRows) {
      const arr = pricesByVariant.get(row.variantId) ?? [];
      arr.push({
        priceListName: row.plName,
        isNet: row.isNet,
        currencyId: row.currencyId,
        price: Number(row.price),
      });
      pricesByVariant.set(row.variantId, arr);
    }

    const variantsByArticle = new Map<string, VariantRow[]>();
    for (const variant of variants) {
      const enriched: VariantRow = {
        ...variant,
        availableStock: stockMap.get(variant.variantId) ?? 0,
        optionValues: optionsByVariant.get(variant.variantId),
        priceListPrices: pricesByVariant.get(variant.variantId),
      };
      const rows = variantsByArticle.get(variant.articleId) ?? [];
      rows.push(enriched);
      variantsByArticle.set(variant.articleId, rows);
    }

    return articles.map((item) => {
      const mapped = mapArticleToShopwareProduct(
        item,
        variantsByArticle.get(item.articleId) ?? [],
        articleCategoryMap.get(item.articleId),
        articleMediaMap.get(item.articleId),
      );
      return {
        internalId: mapped.internalId,
        entity: "article" as const,
        payload: mapped.payload,
        taxRate: mapped.taxRate,
        optionGroups: mapped.optionGroups,
      };
    });
  }

  private async buildCategoryItems(): Promise<SyncItem[]> {
    const rows = await db
      .select({
        categoryId: category.categoryId,
        parentCategoryId: category.parentCategoryId,
        name: category.name,
        slug: category.slug,
        description: category.description,
        sortOrder: category.sortOrder,
      })
      .from(category)
      .where(and(eq(category.tenantId, this.tenantId), eq(category.archived, false)));

    return topologicalSortCategories(rows).map((row) => {
      const mapped = mapCategoryToShopwareCategory(row);
      return {
        internalId: mapped.internalId,
        entity: "category" as const,
        payload: mapped.payload,
      };
    });
  }

  private async buildCategoryItemsForIds(internalIds: string[]): Promise<SyncItem[]> {
    if (internalIds.length === 0) return [];
    const rows = await db
      .select({
        categoryId: category.categoryId,
        parentCategoryId: category.parentCategoryId,
        name: category.name,
        slug: category.slug,
        description: category.description,
        sortOrder: category.sortOrder,
      })
      .from(category)
      .where(
        and(
          eq(category.tenantId, this.tenantId),
          inArray(category.categoryId, internalIds),
          eq(category.archived, false),
        ),
      );

    return topologicalSortCategories(rows).map((row) => {
      const mapped = mapCategoryToShopwareCategory(row);
      return {
        internalId: mapped.internalId,
        entity: "category" as const,
        payload: mapped.payload,
      };
    });
  }

  private async loadArticleCategoryIds(articleIds: string[]): Promise<Map<string, string[]>> {
    if (articleIds.length === 0) return new Map();
    const rows = await db
      .select({
        articleId: articleCategory.articleId,
        categoryId: articleCategory.categoryId,
      })
      .from(articleCategory)
      .where(
        and(
          eq(articleCategory.tenantId, this.tenantId),
          inArray(articleCategory.articleId, articleIds),
          eq(articleCategory.archived, false),
        ),
      );

    const map = new Map<string, string[]>();
    for (const row of rows) {
      const ids = map.get(row.articleId) ?? [];
      ids.push(row.categoryId);
      map.set(row.articleId, ids);
    }
    return map;
  }

  private async loadArticleMediaLinks(
    articleIds: string[],
  ): Promise<Map<string, ArticleMediaLink[]>> {
    if (articleIds.length === 0) return new Map();
    const rows = await db
      .select({
        articleId: articleImage.articleId,
        articleImageId: articleImage.articleImageId,
        primaryImageId: article.primaryImageId,
        sortOrder: articleImage.sortOrder,
      })
      .from(articleImage)
      .innerJoin(article, eq(articleImage.articleId, article.articleId))
      .where(
        and(
          eq(articleImage.tenantId, this.tenantId),
          inArray(articleImage.articleId, articleIds),
          eq(articleImage.archived, false),
        ),
      );

    const map = new Map<string, ArticleMediaLink[]>();
    for (const row of rows) {
      const links = map.get(row.articleId) ?? [];
      links.push({
        articleImageId: row.articleImageId,
        role: row.primaryImageId === row.articleImageId ? "cover" : "gallery",
        sortOrder: row.sortOrder,
      });
      map.set(row.articleId, links);
    }
    return map;
  }

  private static readonly mediaSelect = {
    articleImageId: articleImage.articleImageId,
    storageKey: articleImage.storageKey,
    fileName: articleImage.fileName,
    mimeType: articleImage.mimeType,
    checksum: sql<string | null>`NULL`,
    altText: articleImage.altText,
  } as const;

  /**
   * Load the previously-synced checksum per article image so unchanged binaries are
   * not re-uploaded. The checksum is persisted in the mapping's payload snapshot.
   */
  private async loadSyncedMediaChecksums(
    salesChannelId: string,
    articleImageIds: string[],
  ): Promise<Map<string, string | null>> {
    if (articleImageIds.length === 0) return new Map();
    const rows = await db
      .select({
        internalId: externalSyncMapping.internalId,
        payloadSnapshot: externalSyncMapping.payloadSnapshot,
      })
      .from(externalSyncMapping)
      .where(
        and(
          eq(externalSyncMapping.tenantId, this.tenantId),
          eq(externalSyncMapping.salesChannelId, salesChannelId),
          eq(externalSyncMapping.entityType, "media_asset"),
          inArray(externalSyncMapping.internalId, articleImageIds),
          eq(externalSyncMapping.syncStatus, "success"),
        ),
      );

    const map = new Map<string, string | null>();
    for (const row of rows) {
      const snapshot = row.payloadSnapshot as {
        customFields?: { slopwareChecksum?: unknown };
      } | null;
      const checksum = snapshot?.customFields?.slopwareChecksum;
      map.set(row.internalId, typeof checksum === "string" ? checksum : null);
    }
    return map;
  }

  private async mediaRowsToItems(rows: MediaRow[], salesChannelId: string): Promise<SyncItem[]> {
    if (rows.length === 0) return [];
    const syncedChecksums = await this.loadSyncedMediaChecksums(
      salesChannelId,
      rows.map((r) => r.articleImageId),
    );

    return Promise.all(
      rows.map(async (row) => {
        const checksum =
          row.checksum ??
          createHash("sha256")
            .update(await readStorageBinary(row.storageKey))
            .digest("hex");
        const mapped = mapArticleImageToShopwareMedia({ ...row, checksum });
        const priorChecksum = syncedChecksums.get(row.articleImageId);
        const alreadySynced = syncedChecksums.has(row.articleImageId);
        // Re-upload when never synced, when no checksum is recorded, or when it changed.
        const needsUpload = !alreadySynced || !priorChecksum || priorChecksum !== mapped.checksum;
        return {
          internalId: mapped.internalId,
          entity: "media_asset" as const,
          payload: mapped.payload,
          mediaBinary: { ...mapped.binary, needsUpload },
        };
      }),
    );
  }

  private async buildMediaItems(salesChannelId: string): Promise<SyncItem[]> {
    const rows = await db
      .selectDistinct(CommerceSyncService.mediaSelect)
      .from(articleImage)
      .where(and(eq(articleImage.tenantId, this.tenantId), eq(articleImage.archived, false)));

    return this.mediaRowsToItems(rows, salesChannelId);
  }

  private async buildMediaItemsForIds(
    internalIds: string[],
    salesChannelId: string,
  ): Promise<SyncItem[]> {
    if (internalIds.length === 0) return [];
    const rows = await db
      .selectDistinct(CommerceSyncService.mediaSelect)
      .from(articleImage)
      .where(
        and(
          eq(articleImage.tenantId, this.tenantId),
          inArray(articleImage.articleImageId, internalIds),
          eq(articleImage.archived, false),
        ),
      );

    return this.mediaRowsToItems(rows, salesChannelId);
  }

  private async recordStep(input: {
    runId: string;
    channel: SalesChannelConfig;
    entity: CommerceSyncEntity;
    phase: "push" | "pull";
    status: "running" | "skipped";
    sequence: number;
    batchNo?: number;
    plannedItems: number;
    succeededItems: number;
    failedItems: number;
    payloadSummary: unknown;
  }) {
    const [step] = await db
      .insert(commerceSyncRunStep)
      .values({
        runId: input.runId,
        tenantId: this.tenantId,
        salesChannelId: input.channel.salesChannelId,
        entityType: input.entity,
        phase: input.phase,
        status: input.status,
        sequence: input.sequence,
        batchNo: input.batchNo ?? 0,
        plannedItems: input.plannedItems,
        succeededItems: input.succeededItems,
        failedItems: input.failedItems,
        payloadSummary: input.payloadSummary,
        startedAt: input.status === "running" ? new Date() : null,
        completedAt: input.status === "skipped" ? new Date() : null,
      })
      .returning();
    return step;
  }

  private async finishStep(
    stepId: string,
    status: "success" | "error",
    succeededItems: number,
    failedItems: number,
    errorSummary?: string,
  ) {
    await db
      .update(commerceSyncRunStep)
      .set({
        status,
        succeededItems,
        failedItems,
        errorSummary,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(commerceSyncRunStep.stepId, stepId));
  }

  private async listSteps(runId: string) {
    return db
      .select()
      .from(commerceSyncRunStep)
      .where(
        and(eq(commerceSyncRunStep.tenantId, this.tenantId), eq(commerceSyncRunStep.runId, runId)),
      );
  }

  /**
   * Load the last successfully-synced payload snapshot per internal id, so the
   * delta diff can compare it against the freshly-built payload.
   */
  private async loadSyncedPayloads(
    salesChannelId: string,
    entity: CommerceSyncEntity,
    internalIds: string[],
  ): Promise<Map<string, unknown>> {
    if (internalIds.length === 0) return new Map();
    const rows = await db
      .select({
        internalId: externalSyncMapping.internalId,
        payloadSnapshot: externalSyncMapping.payloadSnapshot,
      })
      .from(externalSyncMapping)
      .where(
        and(
          eq(externalSyncMapping.tenantId, this.tenantId),
          eq(externalSyncMapping.salesChannelId, salesChannelId),
          eq(externalSyncMapping.entityType, entity),
          inArray(externalSyncMapping.internalId, internalIds),
          eq(externalSyncMapping.syncStatus, "success"),
        ),
      );

    const map = new Map<string, unknown>();
    for (const row of rows) {
      // Skip null snapshots (e.g. legacy rows synced before snapshots were stored):
      // without a baseline we cannot prove the item is unchanged, so re-push it.
      if (row.payloadSnapshot != null) map.set(row.internalId, row.payloadSnapshot);
    }
    return map;
  }

  /**
   * Delta gate: keep only items whose payload differs from the last successful
   * push. Because article payloads embed stock, prices, options, categories and
   * media, this catches related-table changes that never touch `article.updatedAt`.
   */
  private async filterUnchangedItems(
    channel: SalesChannelConfig,
    entity: CommerceSyncEntity,
    items: SyncItem[],
  ): Promise<{ items: SyncItem[]; skipped: number }> {
    if (items.length === 0) return { items, skipped: 0 };
    const snapshots = await this.loadSyncedPayloads(
      channel.salesChannelId,
      entity,
      items.map((item) => item.internalId),
    );

    const kept: SyncItem[] = [];
    let skipped = 0;
    for (const item of items) {
      const prior = snapshots.get(item.internalId);
      if (prior !== undefined && stableStringify(prior) === stableStringify(item.payload)) {
        skipped++;
        continue;
      }
      kept.push(item);
    }
    return { items: kept, skipped };
  }

  private async persistMappings(
    channel: SalesChannelConfig,
    entity: CommerceSyncEntity,
    externalIds: Array<{ internalId: string; externalId: string; payloadSnapshot?: unknown }>,
  ) {
    for (const item of externalIds) {
      await db
        .insert(externalSyncMapping)
        .values({
          tenantId: this.tenantId,
          salesChannelId: channel.salesChannelId,
          sourceSystem: "sales_channel",
          entityType: entity,
          internalId: item.internalId,
          externalId: item.externalId,
          syncDirection: "push",
          payloadSnapshot: item.payloadSnapshot,
          lastSyncAt: new Date(),
          syncStatus: "success",
          errorLog: null,
        })
        .onConflictDoUpdate({
          target: [
            externalSyncMapping.tenantId,
            externalSyncMapping.salesChannelId,
            externalSyncMapping.entityType,
            externalSyncMapping.internalId,
          ],
          set: {
            externalId: item.externalId,
            payloadSnapshot: item.payloadSnapshot,
            lastSyncAt: new Date(),
            syncStatus: "success",
            errorLog: null,
          },
        });
    }
  }

  private async writeToDlq(input: {
    runId: string;
    channel: SalesChannelConfig;
    entity: CommerceSyncEntity;
    failed: Array<{ internalId: string; error: string }>;
  }) {
    const now = new Date();
    for (const item of input.failed) {
      const existing = await db
        .select({
          itemId: commerceSyncDeadLetter.itemId,
          attemptCount: commerceSyncDeadLetter.attemptCount,
        })
        .from(commerceSyncDeadLetter)
        .where(
          and(
            eq(commerceSyncDeadLetter.tenantId, this.tenantId),
            eq(commerceSyncDeadLetter.salesChannelId, input.channel.salesChannelId),
            eq(commerceSyncDeadLetter.entityType, input.entity),
            eq(commerceSyncDeadLetter.internalId, item.internalId),
            eq(commerceSyncDeadLetter.status, "pending"),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        const existingItem = existing[0];
        const newAttemptCount = existingItem.attemptCount + 1;
        const newStatus: "pending" | "abandoned" =
          newAttemptCount >= DLQ_MAX_ATTEMPTS ? "abandoned" : "pending";
        await db
          .update(commerceSyncDeadLetter)
          .set({
            errorMessage: item.error,
            attemptCount: newAttemptCount,
            lastAttemptedAt: now,
            nextRetryAt:
              newStatus === "pending"
                ? new Date(now.getTime() + dlqNextRetryMs(newAttemptCount))
                : null,
            status: newStatus,
            updatedAt: now,
          })
          .where(eq(commerceSyncDeadLetter.itemId, existingItem.itemId));
      } else {
        await db.insert(commerceSyncDeadLetter).values({
          runId: input.runId,
          tenantId: this.tenantId,
          salesChannelId: input.channel.salesChannelId,
          entityType: input.entity,
          internalId: item.internalId,
          errorMessage: item.error,
          attemptCount: 1,
          lastAttemptedAt: now,
          nextRetryAt: new Date(now.getTime() + dlqNextRetryMs(1)),
          status: "pending",
        });
      }
    }
  }
}

function normalizeEntities(
  entities: CommerceSyncEntity[],
  mode: CommerceSyncMode,
): CommerceSyncEntity[] {
  // Media must be pushed before articles, since product payloads reference media ids.
  if (mode === "full") return ["category", "address", "media_asset", "article"];
  return [...new Set(entities)];
}

function splitIntoBatches<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}
