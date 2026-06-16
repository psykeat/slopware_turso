import "@tanstack/react-start/server-only";

import { createHash } from "node:crypto";

import { and, eq, inArray, isNull, lte, or } from "drizzle-orm";

import { db } from "../index";
import {
  address,
  article,
  articleVariant,
  commerceSyncDeadLetter,
  commerceSyncRun,
  commerceSyncRunStep,
  externalSyncMapping,
  salesChannel,
} from "../schema/app.schema";

export type CommerceSyncEntity = "address" | "article";
export type CommerceSyncDirection = "push" | "pull" | "bidirectional";
export type CommerceSyncMode = "single" | "full";

export interface CommerceSyncPlan {
  salesChannelId: string;
  direction: CommerceSyncDirection;
  mode: CommerceSyncMode;
  entities: CommerceSyncEntity[];
  dryRun?: boolean;
  batchSize?: number;
}

export interface SyncItem {
  internalId: string;
  entity: CommerceSyncEntity;
  payload: Record<string, unknown>;
}

export interface CommerceSyncAdapter {
  pushBatch(input: {
    salesChannel: SalesChannelConfig;
    items: SyncItem[];
  }): Promise<ShopSyncBatchResult>;
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
  customerGroupId: string;
  paymentMethodId: string;
  salesChannelId: string;
  salutationId: string;
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
}

interface ArticleRow {
  articleId: string;
  articleNo: string;
  name: string;
  description: string | null;
  kurzbeschreibung: string | null;
}

interface VariantRow {
  variantId: string;
  articleId: string;
  sku: string;
  ean: string | null;
  price: string | null;
  weight: string | null;
  isActive: boolean;
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
  { maxAttempts = 3, initialDelayMs = 1000 }: { maxAttempts?: number; initialDelayMs?: number } = {},
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
    Object.entries(record).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  );
}

function toDecimalNumber(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
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

  return {
    internalId: row.addressId,
    externalId,
    payload: compactRecord({
      id: externalId,
      customerNumber: row.addressNo,
      email: `slopware-${row.addressNo.replace(/[^a-zA-Z0-9._-]/g, "-")}@example.invalid`,
      firstName: row.firstName ?? row.companyName ?? row.addressNo,
      lastName: row.lastName ?? "-",
      company: row.companyName,
      vatIds: row.vatId ? [row.vatId] : undefined,
      customFields: {
        slopwareAddressId: row.addressId,
        slopwareAddressNo: row.addressNo,
        slopwareCountryCode: row.countryCode,
        slopwareDisplayName: displayName,
        slopwareIsSupplier: row.isSupplier,
      },
      defaultBillingAddress: compactRecord({
        id: stableShopwareId("address-billing", row.addressId),
        firstName: row.firstName ?? row.companyName ?? row.addressNo,
        lastName: row.lastName ?? "-",
        company: row.companyName,
        street: [row.addressLine1, row.addressLine2].filter(Boolean).join(" "),
        zipcode: row.postalCode,
        city: row.city,
        country: { iso: row.countryCode },
      }),
    }),
  };
}

export function mapArticleToShopwareProduct(row: ArticleRow, variants: VariantRow[]) {
  const activeVariants = variants.filter((variant) => variant.isActive);
  const externalId = stableShopwareId("article", row.articleId);
  const basePayload = compactRecord({
    id: externalId,
    productNumber: row.articleNo,
    name: row.name,
    description: row.description ?? row.kurzbeschreibung,
    active: true,
    customFields: {
      slopwareArticleId: row.articleId,
      slopwareArticleNo: row.articleNo,
    },
  });

  if (activeVariants.length <= 1) {
    const variant = activeVariants[0];
    return {
      internalId: row.articleId,
      externalId,
      payload: compactRecord({
        ...basePayload,
        productNumber: variant?.sku ?? row.articleNo,
        ean: variant?.ean,
        weight: toDecimalNumber(variant?.weight ?? null),
        price: [
          {
            currencyId: "EUR",
            gross: toDecimalNumber(variant?.price ?? null) ?? 0,
            net: toDecimalNumber(variant?.price ?? null) ?? 0,
            linked: true,
          },
        ],
      }),
      variantExternalIds: variant
        ? [{ internalId: variant.variantId, externalId: stableShopwareId("article-variant", variant.variantId) }]
        : [],
    };
  }

  return {
    internalId: row.articleId,
    externalId,
    payload: {
      ...basePayload,
      children: activeVariants.map((variant) =>
        compactRecord({
          id: stableShopwareId("article-variant", variant.variantId),
          productNumber: variant.sku,
          ean: variant.ean,
          active: variant.isActive,
          weight: toDecimalNumber(variant.weight),
          customFields: {
            slopwareVariantId: variant.variantId,
            slopwareSku: variant.sku,
          },
        }),
      ),
    },
    variantExternalIds: activeVariants.map((variant) => ({
      internalId: variant.variantId,
      externalId: stableShopwareId("article-variant", variant.variantId),
    })),
  };
}

export class Shopware6Adapter implements CommerceSyncAdapter {
  async pushBatch(input: {
    salesChannel: SalesChannelConfig;
    items: SyncItem[];
  }): Promise<ShopSyncBatchResult> {
    const token = await withRetry(() => this.fetchToken(input.salesChannel));
    const references = await withRetry(() => this.resolveReferences(input.salesChannel, token));

    const accepted: Array<{ internalId: string; externalId: string; payloadSnapshot?: unknown }> = [];
    const rejected: Array<{ internalId: string; error: string }> = [];
    const customerItems: Array<{ internalId: string; prepared: Record<string, unknown> }> = [];
    const productItems: Array<{ internalId: string; prepared: Record<string, unknown> }> = [];

    for (const item of input.items) {
      try {
        if (item.entity === "address") {
          const prepared = this.prepareCustomerPayload(item.payload, references);
          const errors = validateShopwareCustomerPayload(prepared);
          if (errors.length > 0) {
            rejected.push({ internalId: item.internalId, error: errors.join("; ") });
          } else {
            customerItems.push({ internalId: item.internalId, prepared });
          }
        } else {
          const prepared = this.prepareProductPayload(item.payload, references);
          const errors = validateShopwareProductPayload(prepared);
          if (errors.length > 0) {
            rejected.push({ internalId: item.internalId, error: errors.join("; ") });
          } else {
            productItems.push({ internalId: item.internalId, prepared });
          }
        }
      } catch (error) {
        rejected.push({
          internalId: item.internalId,
          error: error instanceof Error ? error.message : "Unknown preparation error",
        });
      }
    }

    if (customerItems.length === 0 && productItems.length === 0) {
      return { accepted: 0, externalIds: [], rejected };
    }

    const operations: Record<string, { entity: string; action: string; payload: Record<string, unknown>[] }> =
      {};
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

    await withRetry(() => this.callSyncApi(input.salesChannel, token, operations));

    for (const item of customerItems) {
      accepted.push({
        internalId: item.internalId,
        externalId: typeof item.prepared.id === "string" ? item.prepared.id : item.internalId,
        payloadSnapshot: item.prepared,
      });
    }
    for (const item of productItems) {
      accepted.push({
        internalId: item.internalId,
        externalId: typeof item.prepared.id === "string" ? item.prepared.id : item.internalId,
        payloadSnapshot: item.prepared,
      });
    }

    return { accepted: accepted.length, externalIds: accepted, rejected };
  }

  private prepareCustomerPayload(
    payload: Record<string, unknown>,
    references: ShopwareReferences,
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
      throw new Error(`Shopware country mapping missing for ISO code "${countryCode ?? "unknown"}"`);
    }
    delete billingAddress.country;
    return {
      ...payload,
      groupId: references.customerGroupId,
      salesChannelId: references.salesChannelId,
      defaultPaymentMethodId: references.paymentMethodId,
      salutationId: references.salutationId,
      defaultBillingAddress: {
        ...billingAddress,
        salutationId: references.salutationId,
        countryId,
      },
    };
  }

  private prepareProductPayload(
    payload: Record<string, unknown>,
    references: ShopwareReferences,
  ): Record<string, unknown> {
    return {
      ...payload,
      taxId: references.taxId,
      stock: typeof payload.stock === "number" ? payload.stock : 0,
      price: normalizeShopwarePrice(payload.price, references.currencyId),
    };
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

  private async resolveReferences(
    salesChannelConfig: SalesChannelConfig,
    token: string,
  ): Promise<ShopwareReferences> {
    const [currency, tax, customerGroup, paymentMethod, shopwareSalesChannel, salutation] =
      await Promise.all([
        this.searchFirst(salesChannelConfig, token, "currency", {
          filter: [{ type: "equals", field: "isoCode", value: "EUR" }],
        }),
        this.searchFirst(salesChannelConfig, token, "tax", { limit: 1 }),
        this.searchFirst(salesChannelConfig, token, "customer-group", { limit: 1 }),
        this.searchFirst(salesChannelConfig, token, "payment-method", {
          filter: [{ type: "equals", field: "active", value: true }],
        }),
        this.searchFirst(salesChannelConfig, token, "sales-channel", {
          filter: [{ type: "equals", field: "active", value: true }],
        }),
        this.searchFirst(salesChannelConfig, token, "salutation", { limit: 1 }),
      ]);

    const countries = await this.searchMany(salesChannelConfig, token, "country", { limit: 500 });
    const countriesByIso = new Map<string, string>();
    for (const country of countries) {
      const iso = country.attributes.iso;
      if (typeof iso === "string") countriesByIso.set(iso.toUpperCase(), country.id);
    }

    return {
      currencyId: requireShopwareId(currency, "currency EUR"),
      taxId: requireShopwareId(tax, "tax"),
      customerGroupId: requireShopwareId(customerGroup, "customer group"),
      paymentMethodId: requireShopwareId(paymentMethod, "payment method"),
      salesChannelId: requireShopwareId(shopwareSalesChannel, "sales channel"),
      salutationId: requireShopwareId(salutation, "salutation"),
      countriesByIso,
    };
  }

  private async searchFirst(
    salesChannelConfig: SalesChannelConfig,
    token: string,
    entity: string,
    criteria: Record<string, unknown>,
  ) {
    const rows = await this.searchMany(salesChannelConfig, token, entity, { limit: 1, ...criteria });
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

function normalizeShopwarePrice(value: unknown, currencyId: string) {
  const first = Array.isArray(value) ? value[0] : null;
  const price = first && typeof first === "object" ? (first as Record<string, unknown>) : {};
  const gross = typeof price.gross === "number" ? price.gross : 0;
  const net = typeof price.net === "number" ? price.net : gross;
  return [{ currencyId, gross, net, linked: price.linked !== false }];
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
  return { clientId, clientSecret };
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
    private readonly adapterFactory: (salesChannel: SalesChannelConfig) => CommerceSyncAdapter = () =>
      new Shopware6Adapter(),
  ) {}

  async start(plan: CommerceSyncPlan) {
    if (plan.direction !== "push") {
      throw new Error("Only push sync is implemented for commerce sync v1");
    }

    const channel = await this.getSalesChannel(plan.salesChannelId);
    const entities = normalizeEntities(plan.entities, plan.mode);
    const batchSize = plan.batchSize ?? 100;
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
          : await this.buildArticleItems();

      if (allItems.length === 0) {
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
          payloadSummary: { items: 0 },
        });
        continue;
      }

      const batches = splitIntoBatches(allItems, batchSize);

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
          payloadSummary: { entity, items: batchItems.length },
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
          await this.finishStep(step.stepId, result.rejected.length === result.accepted + result.rejected.length ? "error" : "success", result.accepted, result.rejected.length);
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

  async cancel(runId: string) {
    const [run] = await db
      .update(commerceSyncRun)
      .set({ status: "cancel_requested", cancelRequestedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(commerceSyncRun.tenantId, this.tenantId), eq(commerceSyncRun.runId, runId)))
      .returning();
    return run ?? null;
  }

  async listDeadLetter(
    salesChannelId?: string,
    status?: "pending" | "resolved" | "abandoned",
  ) {
    const conditions = [eq(commerceSyncDeadLetter.tenantId, this.tenantId)];
    if (salesChannelId)
      conditions.push(eq(commerceSyncDeadLetter.salesChannelId, salesChannelId));
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
    if (row.platform !== "shopware6") throw new Error(`Unsupported commerce platform: ${row.platform}`);
    return {
      salesChannelId: row.salesChannelId,
      platform: row.platform,
      apiUrl: row.apiUrl,
      credentials: row.credentials,
    };
  }

  private async buildAddressItems(): Promise<SyncItem[]> {
    const rows = await db
      .select({
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
      })
      .from(address)
      .where(and(eq(address.tenantId, this.tenantId), isNull(address.archivedAt)));

    return rows.map((row) => {
      const mapped = mapAddressToShopwareCustomer(row);
      return { internalId: mapped.internalId, entity: "address" as const, payload: mapped.payload };
    });
  }

  private async buildAddressItemsForIds(internalIds: string[]): Promise<SyncItem[]> {
    if (internalIds.length === 0) return [];
    const rows = await db
      .select({
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
      })
      .from(address)
      .where(
        and(
          eq(address.tenantId, this.tenantId),
          inArray(address.addressId, internalIds),
          isNull(address.archivedAt),
        ),
      );

    return rows.map((row) => {
      const mapped = mapAddressToShopwareCustomer(row);
      return { internalId: mapped.internalId, entity: "address" as const, payload: mapped.payload };
    });
  }

  private async buildArticleItems(): Promise<SyncItem[]> {
    const articles = await db
      .select({
        articleId: article.articleId,
        articleNo: article.articleNo,
        name: article.name,
        description: article.description,
        kurzbeschreibung: article.kurzbeschreibung,
      })
      .from(article)
      .where(and(eq(article.tenantId, this.tenantId), isNull(article.archivedAt)));

    return this.articlesWithVariantsToItems(articles);
  }

  private async buildArticleItemsForIds(internalIds: string[]): Promise<SyncItem[]> {
    if (internalIds.length === 0) return [];
    const articles = await db
      .select({
        articleId: article.articleId,
        articleNo: article.articleNo,
        name: article.name,
        description: article.description,
        kurzbeschreibung: article.kurzbeschreibung,
      })
      .from(article)
      .where(
        and(
          eq(article.tenantId, this.tenantId),
          inArray(article.articleId, internalIds),
          isNull(article.archivedAt),
        ),
      );

    return this.articlesWithVariantsToItems(articles);
  }

  private async articlesWithVariantsToItems(
    articles: ArticleRow[],
  ): Promise<SyncItem[]> {
    if (articles.length === 0) return [];

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
          inArray(
            articleVariant.articleId,
            articles.map((a) => a.articleId),
          ),
        ),
      );

    const variantsByArticle = new Map<string, VariantRow[]>();
    for (const variant of variants) {
      const rows = variantsByArticle.get(variant.articleId) ?? [];
      rows.push(variant);
      variantsByArticle.set(variant.articleId, rows);
    }

    return articles.map((item) => {
      const mapped = mapArticleToShopwareProduct(item, variantsByArticle.get(item.articleId) ?? []);
      return { internalId: mapped.internalId, entity: "article" as const, payload: mapped.payload };
    });
  }

  private async recordStep(input: {
    runId: string;
    channel: SalesChannelConfig;
    entity: CommerceSyncEntity;
    phase: "push";
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

function normalizeEntities(entities: CommerceSyncEntity[], mode: CommerceSyncMode): CommerceSyncEntity[] {
  if (mode === "full") return ["address", "article"];
  return [...new Set(entities)];
}

function splitIntoBatches<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}
