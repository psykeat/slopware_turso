import assert from "node:assert/strict";
import crypto from "node:crypto";
import test, { after } from "node:test";

import { and, eq } from "drizzle-orm";

import "../scripts/load-env";
import { closeDb, db } from "../index";
import {
  article,
  articleVariant,
  commerceWebhookEvent,
  company,
  document,
  documentGroup,
  externalSyncMapping,
  organization,
  salesChannel,
  tenant,
} from "../schema/app.schema";
import {
  CommerceWebhookLookupError,
  CommerceWebhookService,
  CommerceWebhookValidationError,
  findWebhookChannelCandidates,
  ingestShopwareWebhook,
  parseShopwareWebhook,
  verifyShopwareSignature,
} from "./commerce-webhook";
import type { CommerceSyncAdapter, ShopSyncBatchResult, ShopwareOrder } from "./commerce-sync";
import { encryptSecret } from "./secret-crypto";

const SHOP_URL = "http://localhost:8080";

async function createFixture() {
  const suffix = crypto.randomUUID().slice(0, 8);
  // Unique secret per fixture: when several channels share a shop URL, the
  // signature (keyed by this secret) is what selects the right channel.
  const appSecret = `app-secret-${suffix}`;
  const [org] = await db
    .insert(organization)
    .values({ name: `Webhook Org ${suffix}`, slug: `webhook-org-${suffix}` })
    .returning({ organizationId: organization.organizationId });

  const [tenantRow] = await db
    .insert(tenant)
    .values({
      organizationId: org.organizationId,
      name: `Webhook Tenant ${suffix}`,
      slug: `webhook-tenant-${suffix}`,
    })
    .returning({ tenantId: tenant.tenantId });
  const tenantId = tenantRow.tenantId;

  const [channel] = await db
    .insert(salesChannel)
    .values({
      tenantId,
      name: "Webhook Shopware",
      platform: "shopware6",
      // Trailing slash on purpose: resolution must normalize this against source.url.
      apiUrl: `${SHOP_URL}/`,
      credentials: {
        clientId: "test",
        clientSecret: encryptSecret("secret"),
        appSecret: encryptSecret(appSecret),
      },
    })
    .returning({ salesChannelId: salesChannel.salesChannelId });

  const [comp] = await db
    .insert(company)
    .values({
      tenantId,
      companyNo: `C-${suffix}`,
      name: "Webhook Co",
      countryCode: "DE",
      currencyId: "EUR",
    })
    .returning({ companyId: company.companyId });

  await db.insert(documentGroup).values({
    tenantId,
    companyId: comp.companyId,
    name: "Aufträge",
    documentType: "A",
    groupNumber: 1,
  });

  const [art] = await db
    .insert(article)
    .values({ tenantId, articleNo: `ART-WH-${suffix}`, name: "Webhook Article" })
    .returning({ articleId: article.articleId });

  await db.insert(articleVariant).values({
    tenantId,
    articleId: art.articleId,
    sku: `SKU-WH-${suffix}`,
    optionValueHash: crypto.createHash("sha256").update("wh").digest("hex"),
    price: "100.00",
    isActive: true,
  });

  return { tenantId, suffix, salesChannelId: channel.salesChannelId, appSecret };
}

function signedWebhook(appSecret: string, eventName: string, payload: Record<string, unknown> = {}) {
  const rawBody = JSON.stringify({
    source: { url: SHOP_URL, appVersion: "1.0.0", shopId: "shop-1" },
    data: { event: eventName, payload },
    timestamp: Date.now(),
  });
  const signature = crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  return { rawBody, signature };
}

function mockOrderAdapter(order: ShopwareOrder): CommerceSyncAdapter {
  return {
    async pushBatch(): Promise<ShopSyncBatchResult> {
      return { accepted: 0, externalIds: [], rejected: [] };
    },
    async pullOrders(): Promise<ShopwareOrder[]> {
      return [order];
    },
  };
}

test("verifyShopwareSignature accepts a valid HMAC and rejects tampering", () => {
  const secret = "unit-secret";
  const { rawBody, signature } = signedWebhook(secret, "checkout.order.placed");
  assert.equal(verifyShopwareSignature(rawBody, signature, secret), true);
  assert.equal(verifyShopwareSignature(rawBody, signature, "wrong-secret"), false);
  assert.equal(verifyShopwareSignature(`${rawBody} `, signature, secret), false);
  assert.equal(verifyShopwareSignature(rawBody, null, secret), false);
});

test("parseShopwareWebhook flattens the App-System envelope", () => {
  const parsed = parseShopwareWebhook(
    JSON.stringify({
      source: { url: SHOP_URL },
      data: { event: "checkout.order.placed", payload: { order: { id: "o1" } } },
    }),
  );
  assert.equal(parsed.shopUrl, SHOP_URL);
  assert.equal(parsed.eventName, "checkout.order.placed");
  assert.deepEqual(parsed.payload, { order: { id: "o1" } });

  assert.throws(() => parseShopwareWebhook("not json"), CommerceWebhookValidationError);
  assert.throws(
    () => parseShopwareWebhook(JSON.stringify({ source: { url: SHOP_URL }, data: {} })),
    CommerceWebhookValidationError,
  );
});

test("ingest rejects unknown shops and invalid signatures", async () => {
  const { appSecret } = await createFixture();

  // Unknown shop URL → lookup error.
  const unknown = signedWebhook(appSecret, "checkout.order.placed");
  await assert.rejects(
    ingestShopwareWebhook({
      rawBody: unknown.rawBody.replace(SHOP_URL, "http://unknown-shop:9999"),
      signature: unknown.signature,
    }),
    CommerceWebhookLookupError,
  );

  // Known shop, bad signature → validation error (401).
  const bad = signedWebhook(appSecret, "checkout.order.placed");
  await assert.rejects(
    ingestShopwareWebhook({ rawBody: bad.rawBody, signature: "deadbeef" }),
    (err: unknown) =>
      err instanceof CommerceWebhookValidationError && err.status === 401,
  );
});

test("findWebhookChannelCandidates matches the shop URL and disambiguates by signature", async () => {
  const { tenantId, salesChannelId, appSecret } = await createFixture();
  const candidates = await findWebhookChannelCandidates(SHOP_URL);
  // Other fixtures may share the URL; the one matching this secret must be present.
  const mine = candidates.find((c) => c.appSecret === appSecret);
  assert.ok(mine, "expected this fixture's channel among the candidates");
  assert.equal(mine.tenantId, tenantId);
  assert.equal(mine.channel.salesChannelId, salesChannelId);
});

test("ingest persists a pending event and deduplicates redeliveries", async () => {
  const { tenantId, salesChannelId, appSecret } = await createFixture();
  const { rawBody, signature } = signedWebhook(appSecret, "checkout.order.placed", {
    order: { id: "x" },
  });

  const first = await ingestShopwareWebhook({ rawBody, signature });
  assert.equal(first.duplicate, false);
  assert.ok(first.eventId);
  assert.equal(first.tenantId, tenantId);
  assert.equal(first.salesChannelId, salesChannelId);

  // Same signature again (Shopware at-least-once redelivery) → no new row.
  const second = await ingestShopwareWebhook({ rawBody, signature });
  assert.equal(second.duplicate, true);
  assert.equal(second.eventId, null);

  const rows = await db
    .select()
    .from(commerceWebhookEvent)
    .where(eq(commerceWebhookEvent.salesChannelId, salesChannelId));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "pending");
  assert.equal(rows[0].eventName, "checkout.order.placed");
});

test("processPending imports an order on checkout.order.placed and acknowledges other events", async () => {
  const { tenantId, suffix, salesChannelId, appSecret } = await createFixture();

  const order: ShopwareOrder = {
    orderId: `sw-order-${suffix}`,
    orderNumber: `SW-${suffix}`,
    orderDateTime: "2026-06-18T10:00:00.000Z",
    taxStatus: "gross",
    currencyIso: "EUR",
    customer: {
      customerId: `sw-cust-${suffix}`,
      customerNumber: `WC-${suffix}`,
      email: `wh-${suffix}@example.de`,
      firstName: "Webhook",
      lastName: "Kunde",
      company: null,
      vatId: null,
    },
    billingAddress: {
      firstName: "Webhook",
      lastName: "Kunde",
      company: null,
      street: "Shopstr 1",
      zipcode: "10115",
      city: "Berlin",
      countryIso: "DE",
      phoneNumber: null,
    },
    paymentState: "paid",
    shippingState: "open",
    lines: [
      {
        type: "product",
        referencedId: `sw-prod-${suffix}`,
        productNumber: `SKU-WH-${suffix}`,
        label: "Webhook Article",
        quantity: 1,
        unitPrice: 119,
        taxRate: 19,
      },
    ],
  };

  const svc = new CommerceWebhookService(tenantId, null, () => mockOrderAdapter(order));

  // Order placed → triggers the (idempotent) inbound pull import.
  const placed = signedWebhook(appSecret, "checkout.order.placed", {
    order: { orderId: order.orderId },
  });
  await ingestShopwareWebhook(placed);

  // A non-actionable event is acknowledged, not failed.
  const stock = signedWebhook(appSecret, "product.stock.changed", { productId: "p1" });
  await ingestShopwareWebhook(stock);

  const result = await svc.processPending(salesChannelId);
  assert.equal(result.attempted, 2);
  assert.equal(result.processed, 1);
  assert.equal(result.ignored, 1);
  assert.equal(result.failed, 0);

  const docs = await db
    .select()
    .from(document)
    .where(and(eq(document.tenantId, tenantId), eq(document.documentType, "A")));
  assert.equal(docs.length, 1);
  assert.ok(docs[0].customerId);

  const maps = await db
    .select()
    .from(externalSyncMapping)
    .where(and(eq(externalSyncMapping.tenantId, tenantId), eq(externalSyncMapping.entityType, "document")));
  assert.equal(maps.length, 1);
  assert.equal(maps[0].externalId, order.orderId);

  // Events are now terminal; re-draining does nothing and creates no duplicate doc.
  const drainAgain = await svc.processPending(salesChannelId);
  assert.equal(drainAgain.attempted, 0);

  const events = await db
    .select()
    .from(commerceWebhookEvent)
    .where(eq(commerceWebhookEvent.salesChannelId, salesChannelId));
  const byEvent = new Map(events.map((e) => [e.eventName, e.status]));
  assert.equal(byEvent.get("checkout.order.placed"), "processed");
  assert.equal(byEvent.get("product.stock.changed"), "ignored");

  const docsAfter = await db
    .select()
    .from(document)
    .where(and(eq(document.tenantId, tenantId), eq(document.documentType, "A")));
  assert.equal(docsAfter.length, 1, "no duplicate document on re-drain");
});

after(async () => {
  await closeDb();
});
