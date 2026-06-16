import assert from "node:assert/strict";
import crypto from "node:crypto";
import test, { after } from "node:test";

import { and, eq } from "drizzle-orm";

import "../scripts/load-env";
import { executeCapability, type ExecutionContext } from "../capabilities";
import { closeDb, db } from "../index";
import {
  address,
  article,
  articleVariant,
  commerceSyncDeadLetter,
  organization,
  salesChannel,
  tenant,
} from "../schema/app.schema";
import {
  CommerceSyncService,
  mapAddressToShopwareCustomer,
  mapArticleToShopwareProduct,
  type CommerceSyncAdapter,
  type ShopSyncBatchResult,
} from "./commerce-sync";

async function createFixture() {
  const suffix = crypto.randomUUID().slice(0, 8);
  const [org] = await db
    .insert(organization)
    .values({ name: `Commerce Org ${suffix}`, slug: `commerce-org-${suffix}` })
    .returning({ organizationId: organization.organizationId });

  const [tenantRow] = await db
    .insert(tenant)
    .values({
      organizationId: org.organizationId,
      name: `Commerce Tenant ${suffix}`,
      slug: `commerce-tenant-${suffix}`,
    })
    .returning({ tenantId: tenant.tenantId });

  const [channel] = await db
    .insert(salesChannel)
    .values({
      tenantId: tenantRow.tenantId,
      name: "Local Shopware",
      platform: "shopware6",
      apiUrl: "http://localhost:8080",
      credentials: { clientId: "test", clientSecret: "secret" },
    })
    .returning({ salesChannelId: salesChannel.salesChannelId });

  const ctx: ExecutionContext = {
    tenantId: tenantRow.tenantId,
    organizationId: org.organizationId,
    userId: null,
    actorMode: "test",
    role: "system",
  };

  return { ctx, suffix, salesChannelId: channel.salesChannelId };
}

function expectOk<T>(result: { ok: true; data: T } | { ok: false; error: unknown }): T {
  assert.equal(result.ok, true, `expected ok envelope, got ${JSON.stringify(result)}`);
  return (result as { ok: true; data: T }).data;
}

test("commerce mappers create deterministic Shopware payload identities", () => {
  const mappedAddress = mapAddressToShopwareCustomer({
    addressId: "7f908f72-d263-4b3e-91fb-0c0f27546988",
    addressNo: "10001",
    isCustomer: true,
    isSupplier: false,
    companyName: "Example GmbH",
    firstName: null,
    lastName: null,
    addressLine1: "Main Street 1",
    addressLine2: null,
    postalCode: "10115",
    city: "Berlin",
    countryCode: "DE",
    vatId: "DE123",
  });

  assert.equal(mappedAddress.externalId.length, 32);
  assert.equal(mappedAddress.payload.customerNumber, "10001");
  assert.deepEqual(
    (mappedAddress.payload.customFields as Record<string, unknown>).slopwareAddressId,
    "7f908f72-d263-4b3e-91fb-0c0f27546988",
  );

  const mappedArticle = mapArticleToShopwareProduct(
    {
      articleId: "c9624a0a-2699-48d1-a527-3790904578d2",
      articleNo: "A-100",
      name: "Variant Shirt",
      description: "Long text",
      kurzbeschreibung: null,
    },
    [
      {
        variantId: "138d4c48-202a-4dc2-a25d-c0a2a2d26f55",
        articleId: "c9624a0a-2699-48d1-a527-3790904578d2",
        sku: "A-100-RED",
        ean: "400000000001",
        price: "19.99",
        weight: "0.2",
        isActive: true,
      },
      {
        variantId: "bfc4c778-fcb9-43e3-a53a-7a157b195249",
        articleId: "c9624a0a-2699-48d1-a527-3790904578d2",
        sku: "A-100-BLUE",
        ean: null,
        price: "21.50",
        weight: null,
        isActive: true,
      },
    ],
  );

  assert.equal(mappedArticle.externalId.length, 32);
  assert.equal((mappedArticle.payload.children as unknown[]).length, 2);
  assert.equal(mappedArticle.variantExternalIds.length, 2);
});

test("commerce.sync.start dry-run records address and article steps without external calls", async () => {
  const { ctx, suffix, salesChannelId } = await createFixture();

  await db.insert(address).values({
    tenantId: ctx.tenantId,
    addressNo: `ADR-${suffix}`,
    isCustomer: true,
    companyName: "Dry Run Customer",
    addressLine1: "Sync Street 1",
    postalCode: "10115",
    city: "Berlin",
    countryCode: "DE",
  });

  const [articleRow] = await db
    .insert(article)
    .values({
      tenantId: ctx.tenantId,
      articleNo: `ART-${suffix}`,
      name: "Dry Run Article",
    })
    .returning({ articleId: article.articleId });

  await db.insert(articleVariant).values({
    tenantId: ctx.tenantId,
    articleId: articleRow.articleId,
    sku: `ART-${suffix}-DEFAULT`,
    optionValueHash: crypto.createHash("sha256").update("").digest("hex"),
    price: "10.00",
    isActive: true,
  });

  const result = expectOk<{
    run: { runId: string; status: string; totalItems: number; succeededItems: number; dryRun: boolean };
    steps: Array<{ entityType: string; status: string; plannedItems: number }>;
  }>(
    await executeCapability("commerce.commerceSyncRun.start", ctx, {
      salesChannelId,
      direction: "push",
      mode: "single",
      entities: ["address", "article"],
      dryRun: true,
    }),
  );

  assert.equal(result.run.status, "success");
  assert.equal(result.run.dryRun, true);
  assert.equal(result.run.totalItems, 2);
  assert.equal(result.run.succeededItems, 2);
  assert.equal(result.steps.length, 2);
  assert.deepEqual(
    result.steps.map((step) => [step.entityType, step.status, step.plannedItems]),
    [
      ["address", "success", 1],
      ["article", "success", 1],
    ],
  );

  const loaded = expectOk<{ run: { runId: string }; steps: unknown[] }>(
    await executeCapability("commerce.commerceSyncRun.get", ctx, {
      runId: result.run.runId,
    }),
  );
  assert.equal(loaded.run.runId, result.run.runId);
  assert.equal(loaded.steps.length, 2);
});

test("commerce.sync adapter writes rejected items to DLQ and accepted items to mapping", async () => {
  const { ctx, suffix, salesChannelId } = await createFixture();

  const [addr1] = await db
    .insert(address)
    .values({
      tenantId: ctx.tenantId,
      addressNo: `ADR-OK-${suffix}`,
      isCustomer: true,
      companyName: "Valid Customer",
      addressLine1: "Good Street 1",
      postalCode: "10115",
      city: "Berlin",
      countryCode: "DE",
    })
    .returning({ addressId: address.addressId });

  const [addr2] = await db
    .insert(address)
    .values({
      tenantId: ctx.tenantId,
      addressNo: `ADR-BAD-${suffix}`,
      isCustomer: true,
      companyName: "Bad Customer",
      addressLine1: "Bad Street 2",
      postalCode: "99999",
      city: "Nowhere",
      countryCode: "DE",
    })
    .returning({ addressId: address.addressId });

  // Adapter that accepts addr1 but rejects addr2
  const mockAdapter: CommerceSyncAdapter = {
    async pushBatch(input): Promise<ShopSyncBatchResult> {
      const accepted = input.items
        .filter((i) => i.internalId === addr1.addressId)
        .map((i) => ({ internalId: i.internalId, externalId: `ext-${i.internalId}` }));
      const rejected = input.items
        .filter((i) => i.internalId === addr2.addressId)
        .map((i) => ({ internalId: i.internalId, error: "Shopware rejected: invalid postal code" }));
      return { accepted: accepted.length, externalIds: accepted, rejected };
    },
  };

  const svc = new CommerceSyncService(ctx.tenantId, null, () => mockAdapter);
  const result = await svc.start({
    salesChannelId,
    direction: "push",
    mode: "single",
    entities: ["address"],
  });

  assert.equal(result.run.status, "partial_error");
  assert.equal(result.run.succeededItems, 1);
  assert.equal(result.run.failedItems, 1);

  const dlqResult = await svc.listDeadLetter(salesChannelId, "pending");
  assert.equal(dlqResult.items.length, 1);
  assert.equal(dlqResult.items[0].internalId, addr2.addressId);
  assert.match(dlqResult.items[0].errorMessage, /invalid postal code/);
  assert.equal(dlqResult.items[0].attemptCount, 1);
});

test("commerce.sync DLQ retry resolves an item on second attempt", async () => {
  const { ctx, suffix, salesChannelId } = await createFixture();

  const [addr] = await db
    .insert(address)
    .values({
      tenantId: ctx.tenantId,
      addressNo: `ADR-RETRY-${suffix}`,
      isCustomer: true,
      companyName: "Retry Customer",
      addressLine1: "Retry Lane 1",
      postalCode: "10115",
      city: "Berlin",
      countryCode: "DE",
    })
    .returning({ addressId: address.addressId });

  let callCount = 0;
  const mockAdapter: CommerceSyncAdapter = {
    async pushBatch(input): Promise<ShopSyncBatchResult> {
      callCount++;
      if (callCount === 1) {
        // First attempt fails
        return {
          accepted: 0,
          externalIds: [],
          rejected: input.items.map((i) => ({ internalId: i.internalId, error: "transient error" })),
        };
      }
      // Second attempt succeeds
      return {
        accepted: input.items.length,
        externalIds: input.items.map((i) => ({ internalId: i.internalId, externalId: `ext-${i.internalId}` })),
        rejected: [],
      };
    },
  };

  const svc = new CommerceSyncService(ctx.tenantId, null, () => mockAdapter);

  // First run — should fail and write to DLQ
  const run1 = await svc.start({
    salesChannelId,
    direction: "push",
    mode: "single",
    entities: ["address"],
  });
  assert.equal(run1.run.status, "error");

  const dlqBefore = await svc.listDeadLetter(salesChannelId, "pending");
  assert.equal(dlqBefore.items.length, 1);

  // Force nextRetryAt to past so retry picks it up
  await db
    .update(commerceSyncDeadLetter)
    .set({ nextRetryAt: new Date(Date.now() - 1000) });

  // Retry
  const retryResult = await svc.retryDeadLetter(salesChannelId);
  assert.equal(retryResult.attempted, 1);
  assert.equal(retryResult.resolved, 1);
  assert.equal(retryResult.stillFailed, 0);
  assert.equal(retryResult.abandoned, 0);

  const dlqAfter = await svc.listDeadLetter(salesChannelId, "pending");
  assert.equal(dlqAfter.items.length, 0);

  const dlqResolved = await svc.listDeadLetter(salesChannelId, "resolved");
  assert.equal(dlqResolved.items.length, 1);
  assert.equal(dlqResolved.items[0].internalId, addr.addressId);
});

test("commerce.sync DLQ item is abandoned after max attempts", async () => {
  const { ctx, suffix, salesChannelId } = await createFixture();

  const [addr] = await db
    .insert(address)
    .values({
      tenantId: ctx.tenantId,
      addressNo: `ADR-ABANDON-${suffix}`,
      isCustomer: true,
      companyName: "Always Fails",
      addressLine1: "Fail Street 1",
      postalCode: "10115",
      city: "Berlin",
      countryCode: "DE",
    })
    .returning({ addressId: address.addressId });

  const alwaysFailAdapter: CommerceSyncAdapter = {
    async pushBatch(input): Promise<ShopSyncBatchResult> {
      return {
        accepted: 0,
        externalIds: [],
        rejected: input.items.map((i) => ({ internalId: i.internalId, error: "permanent error" })),
      };
    },
  };

  const svc = new CommerceSyncService(ctx.tenantId, null, () => alwaysFailAdapter);

  // First run seeds the DLQ (attempt_count = 1)
  await svc.start({ salesChannelId, direction: "push", mode: "single", entities: ["address"] });

  // Retry 4 more times (attempts 2–5), forcing nextRetryAt past each time
  for (let i = 0; i < 4; i++) {
    await db
      .update(commerceSyncDeadLetter)
      .set({ nextRetryAt: new Date(Date.now() - 1000) })
      .where(
        and(
          eq(commerceSyncDeadLetter.tenantId, ctx.tenantId),
          eq(commerceSyncDeadLetter.salesChannelId, salesChannelId),
          eq(commerceSyncDeadLetter.internalId, addr.addressId),
        ),
      );
    await svc.retryDeadLetter(salesChannelId);
  }

  const dlqAbandoned = await svc.listDeadLetter(salesChannelId, "abandoned");
  assert.equal(dlqAbandoned.items.length, 1);
  assert.ok(dlqAbandoned.items[0].attemptCount >= 5);
});

test("commerce.sync capabilities are discoverable via capability registry", async () => {
  const dlqListResult = expectOk<{ items: unknown[] }>(
    await executeCapability("commerce.commerceSyncDeadLetter.list", {
      tenantId: "019e2889-5cd7-714b-9922-08a75fdfbaac",
      organizationId: "019e2889-5cd7-714b-9922-08a75fdfbaac",
      userId: null,
      actorMode: "test",
      role: "system",
    }, {}),
  );
  assert.ok(Array.isArray(dlqListResult.items));
});

after(async () => {
  await closeDb();
});
