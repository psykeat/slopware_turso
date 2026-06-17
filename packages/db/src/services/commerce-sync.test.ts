import assert from "node:assert/strict";
import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import test, { after } from "node:test";

import { and, eq } from "drizzle-orm";

import "../scripts/load-env";
import { executeCapability, type ExecutionContext } from "../capabilities";
import { closeDb, db } from "../index";
import {
  address,
  article,
  articleCategory,
  articleImage,
  articleVariant,
  category,
  commerceSyncDeadLetter,
  company,
  document,
  documentGroup,
  externalSyncMapping,
  organization,
  priceList,
  priceListItem,
  salesChannel,
  tenant,
} from "../schema/app.schema";
import {
  CommerceSyncService,
  computeOrderLineFinancials,
  deriveUnitNet,
  mapAddressToShopwareCustomer,
  mapArticleToShopwareProduct,
  mapArticleImageToShopwareMedia,
  mapCategoryToShopwareCategory,
  normalizeShopwareOrder,
  type CommerceSyncAdapter,
  type ShopSyncBatchResult,
  type ShopwareOrder,
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
    email: "info@example.de",
    phoneLandline: "+49 30 1234567",
    phoneMobile: null,
    salutation: "Herr",
  });

  assert.equal(mappedAddress.externalId.length, 32);
  assert.equal(mappedAddress.payload.customerNumber, "10001");
  assert.equal(mappedAddress.payload.email, "info@example.de");
  assert.equal(mappedAddress.salutationKey, "mr");
  assert.deepEqual(
    (mappedAddress.payload.customFields as Record<string, unknown>).slopwareAddressId,
    "7f908f72-d263-4b3e-91fb-0c0f27546988",
  );
  assert.equal(
    (mappedAddress.payload.customFields as Record<string, unknown>).slopwarePhoneLandline,
    "+49 30 1234567",
  );

  const mappedArticle = mapArticleToShopwareProduct(
    {
      articleId: "c9624a0a-2699-48d1-a527-3790904578d2",
      articleNo: "A-100",
      name: "Variant Shirt",
      description: "Long text",
      kurzbeschreibung: "Short desc",
      langtext: "<p>Rich long text</p>",
      taxRate: "19",
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
        availableStock: 50,
        optionValues: [
          { groupName: "Color", groupId: "g1", valueId: "v1", value: "Red" },
        ],
      },
      {
        variantId: "bfc4c778-fcb9-43e3-a53a-7a157b195249",
        articleId: "c9624a0a-2699-48d1-a527-3790904578d2",
        sku: "A-100-BLUE",
        ean: null,
        price: "21.50",
        weight: null,
        isActive: true,
        availableStock: 25,
        optionValues: [
          { groupName: "Color", groupId: "g1", valueId: "v2", value: "Blue" },
        ],
      },
    ],
  );

  assert.equal(mappedArticle.externalId.length, 32);
  assert.equal(mappedArticle.payload.description, "<p>Rich long text</p>");
  assert.equal(mappedArticle.payload.metaDescription, "Short desc");
  assert.equal(mappedArticle.payload.stock, 75);
  assert.equal(mappedArticle.taxRate, "19");
  assert.equal((mappedArticle.payload.children as unknown[]).length, 2);
  assert.equal(mappedArticle.variantExternalIds.length, 2);
  const firstChild = (mappedArticle.payload.children as Array<Record<string, unknown>>)[0];
  assert.equal(firstChild.stock, 50);

  // Variant options: configuratorSettings on parent, options on children
  const configuratorSettings = mappedArticle.payload.configuratorSettings as Array<{ id: string; optionId: string }>;
  assert.equal(configuratorSettings.length, 2, "parent should have 2 configuratorSettings (Red + Blue)");
  assert.equal(configuratorSettings[0].id.length, 32);
  assert.equal(configuratorSettings[0].optionId.length, 32);

  const firstChildOptions = firstChild.options as Array<{ id: string }>;
  assert.equal(firstChildOptions.length, 1, "first child should have 1 option (Red)");
  assert.equal(firstChildOptions[0].id.length, 32);

  const secondChild = (mappedArticle.payload.children as Array<Record<string, unknown>>)[1];
  const secondChildOptions = secondChild.options as Array<{ id: string }>;
  assert.equal(secondChildOptions.length, 1, "second child should have 1 option (Blue)");

  // Option groups are collected for property_group sync
  assert.equal(mappedArticle.optionGroups.length, 1, "should have 1 option group (Color)");
  assert.equal(mappedArticle.optionGroups[0].groupName, "Color");
  assert.equal(mappedArticle.optionGroups[0].values.length, 2, "Color group should have 2 values");
  assert.equal(mappedArticle.optionGroups[0].shopwareGroupId.length, 32);
});

test("commerce mapper produces no configuratorSettings for single-variant articles", () => {
  const mapped = mapArticleToShopwareProduct(
    {
      articleId: "single-var-1",
      articleNo: "SINGLE-1",
      name: "Simple Product",
      description: null,
      kurzbeschreibung: null,
      langtext: null,
      taxRate: "20",
    },
    [
      {
        variantId: "sv-1",
        articleId: "single-var-1",
        sku: "SINGLE-1-DEF",
        ean: null,
        price: "9.99",
        weight: null,
        isActive: true,
        availableStock: 10,
      },
    ],
  );

  assert.equal(mapped.payload.configuratorSettings, undefined);
  assert.equal(mapped.payload.children, undefined);
  assert.equal(mapped.optionGroups.length, 0);
});

test("commerce mapper uses price list prices with net→gross calculation", () => {
  const mapped = mapArticleToShopwareProduct(
    {
      articleId: "price-list-art-1",
      articleNo: "PL-ART-1",
      name: "Price List Product",
      description: null,
      kurzbeschreibung: null,
      langtext: null,
      taxRate: "20",
    },
    [
      {
        variantId: "pl-v1",
        articleId: "price-list-art-1",
        sku: "PL-ART-1-RED",
        ean: null,
        price: "10.00",
        weight: null,
        isActive: true,
        availableStock: 5,
        optionValues: [
          { groupName: "Color", groupId: "g1", valueId: "v1", value: "Red" },
        ],
        priceListPrices: [
          { priceListName: "Standard", isNet: true, currencyId: "EUR", price: 100 },
        ],
      },
      {
        variantId: "pl-v2",
        articleId: "price-list-art-1",
        sku: "PL-ART-1-BLUE",
        ean: null,
        price: "10.00",
        weight: null,
        isActive: true,
        availableStock: 3,
        optionValues: [
          { groupName: "Color", groupId: "g1", valueId: "v2", value: "Blue" },
        ],
        priceListPrices: [
          { priceListName: "Standard", isNet: false, currencyId: "EUR", price: 119.99 },
        ],
      },
    ],
  );

  // Children should have price list prices
  const children = mapped.payload.children as Array<Record<string, unknown>>;
  assert.equal(children.length, 2);

  // First child: net=100, gross should be 100 * 1.20 = 120
  const price1 = (children[0].price as Array<Record<string, unknown>>)[0];
  assert.equal(price1.net, 100);
  assert.equal(price1.gross, 120);
  assert.equal(price1.currencyId, "EUR");
  assert.equal(price1.linked, false);

  // Second child: gross=119.99, net should be 119.99 / 1.20 = 99.99 (rounded)
  const price2 = (children[1].price as Array<Record<string, unknown>>)[0];
  assert.equal(price2.gross, 119.99);
  assert.equal(price2.net, 99.99);
  assert.equal(price2.linked, false);
});

test("commerce mapper falls back to variant.price when no price list prices exist", () => {
  const mapped = mapArticleToShopwareProduct(
    {
      articleId: "fallback-art-1",
      articleNo: "FB-ART-1",
      name: "Fallback Product",
      description: null,
      kurzbeschreibung: null,
      langtext: null,
      taxRate: "19",
    },
    [
      {
        variantId: "fb-v1",
        articleId: "fallback-art-1",
        sku: "FB-ART-1-DEF",
        ean: null,
        price: "49.99",
        weight: null,
        isActive: true,
        availableStock: 10,
      },
    ],
  );

  const price = (mapped.payload.price as Array<Record<string, unknown>>)[0];
  assert.equal(price.gross, 49.99);
  assert.equal(price.net, 49.99);
  assert.equal(price.linked, true);
  assert.equal(price.currencyId, "EUR");
});

test("commerce category mapper creates deterministic hierarchical payload", () => {
  const root = mapCategoryToShopwareCategory({
    categoryId: "cat-root-001",
    parentCategoryId: null,
    name: "Alle Produkte",
    slug: "alle-produkte",
    description: "Root category",
    sortOrder: 0,
  });

  assert.equal(root.externalId.length, 32);
  assert.equal(root.payload.name, "Alle Produkte");
  assert.equal(root.payload.parentId, undefined);
  assert.equal(root.payload.active, true);
  assert.equal(
    (root.payload.customFields as Record<string, unknown>).slopwareCategoryId,
    "cat-root-001",
  );

  const child = mapCategoryToShopwareCategory({
    categoryId: "cat-child-001",
    parentCategoryId: "cat-root-001",
    name: "Software",
    slug: "software",
    description: null,
    sortOrder: 1,
  });

  assert.equal(child.externalId.length, 32);
  assert.equal(child.payload.parentId, root.externalId);
  assert.equal(child.payload.name, "Software");

  // Deterministic: same input → same output
  const child2 = mapCategoryToShopwareCategory({
    categoryId: "cat-child-001",
    parentCategoryId: "cat-root-001",
    name: "Software",
    slug: "software",
    description: null,
    sortOrder: 1,
  });
  assert.equal(child.externalId, child2.externalId);
});

test("commerce media mapper creates deterministic Shopware media payload from article images", () => {
  const mapped = mapArticleImageToShopwareMedia({
    articleImageId: "11111111-2222-3333-4444-555555555555",
    storageKey: "tenant-x/articles/article-1/abc-tshirt-cover.png",
    fileName: "tshirt-cover.png",
    mimeType: "image/png",
    checksum: "deadbeef",
    altText: "T-Shirt Hauptbild",
  });

  assert.equal(mapped.externalId.length, 32);
  assert.equal(mapped.internalId, "11111111-2222-3333-4444-555555555555");
  assert.equal(mapped.payload.id, mapped.externalId);
  assert.equal(mapped.payload.title, "tshirt-cover", "title strips the file extension");
  assert.equal(mapped.payload.alt, "T-Shirt Hauptbild");
  assert.equal(
    (mapped.payload.customFields as Record<string, unknown>).slopwareChecksum,
    "deadbeef",
  );
  assert.equal(
    (mapped.payload.customFields as Record<string, unknown>).slopwareArticleImageId,
    "11111111-2222-3333-4444-555555555555",
  );
  assert.equal(mapped.binary.fileName, "tshirt-cover");
  assert.equal(mapped.binary.extension, "png");
  assert.equal(mapped.binary.storageKey, "tenant-x/articles/article-1/abc-tshirt-cover.png");
  assert.equal(mapped.checksum, "deadbeef");

  // Deterministic: same article image id → same external id
  const again = mapArticleImageToShopwareMedia({
    articleImageId: "11111111-2222-3333-4444-555555555555",
    storageKey: "tenant-x/articles/article-1/abc-tshirt-cover.png",
    fileName: "tshirt-cover.png",
    mimeType: "image/png",
    checksum: "deadbeef",
    altText: null,
  });
  assert.equal(again.externalId, mapped.externalId);
});

test("commerce article mapper includes media gallery + cover when media links provided", () => {
  const mapped = mapArticleToShopwareProduct(
    {
      articleId: "art-with-media",
      articleNo: "MEDIA-ART-1",
      name: "Product With Images",
      description: null,
      kurzbeschreibung: null,
      langtext: null,
      taxRate: "20",
    },
    [
      {
        variantId: "v-media-1",
        articleId: "art-with-media",
        sku: "MEDIA-ART-1-DEF",
        ean: null,
        price: "29.99",
        weight: null,
        isActive: true,
        availableStock: 5,
      },
    ],
    undefined,
    [
      { articleImageId: "image-gallery", role: "gallery", sortOrder: 1 },
      { articleImageId: "image-cover", role: "cover", sortOrder: 0 },
    ],
  );

  const media = mapped.payload.media as Array<{ id: string; mediaId: string; position: number }>;
  assert.equal(media.length, 2, "both media links appear in the gallery");
  assert.equal(media[0].id.length, 32);
  assert.equal(media[0].mediaId.length, 32);
  // Sorted by sortOrder: cover (0) first
  assert.equal(media[0].position, 0);

  // coverId points at the product_media id of the role=cover link
  const coverProductMediaId = media.find((m) => m.position === 0)?.id;
  assert.equal(mapped.payload.coverId, coverProductMediaId);

  // Without media links: no media/coverId keys
  const noMedia = mapArticleToShopwareProduct(
    {
      articleId: "art-no-media",
      articleNo: "NOMEDIA-1",
      name: "No Images",
      description: null,
      kurzbeschreibung: null,
      langtext: null,
      taxRate: "20",
    },
    [
      {
        variantId: "v-nomedia-1",
        articleId: "art-no-media",
        sku: "NOMEDIA-1-DEF",
        ean: null,
        price: "9.99",
        weight: null,
        isActive: true,
        availableStock: 1,
      },
    ],
  );
  assert.equal(noMedia.payload.media, undefined);
  assert.equal(noMedia.payload.coverId, undefined);
});

test("commerce article mapper includes category references when provided", () => {
  const mapped = mapArticleToShopwareProduct(
    {
      articleId: "art-with-cats",
      articleNo: "CAT-ART-1",
      name: "Categorized Product",
      description: null,
      kurzbeschreibung: null,
      langtext: null,
      taxRate: "20",
    },
    [
      {
        variantId: "v-cat-1",
        articleId: "art-with-cats",
        sku: "CAT-ART-1-DEF",
        ean: null,
        price: "29.99",
        weight: null,
        isActive: true,
        availableStock: 5,
      },
    ],
    ["cat-a", "cat-b"],
  );

  const categories = mapped.payload.categories as Array<{ id: string }>;
  assert.equal(categories.length, 2);
  assert.equal(categories[0].id.length, 32);
  assert.equal(categories[1].id.length, 32);
  assert.notEqual(categories[0].id, categories[1].id);

  // Without categories: no categories key
  const noCats = mapArticleToShopwareProduct(
    {
      articleId: "art-no-cats",
      articleNo: "NOCAT-1",
      name: "Uncategorized",
      description: null,
      kurzbeschreibung: null,
      langtext: null,
      taxRate: "20",
    },
    [
      {
        variantId: "v-nocat-1",
        articleId: "art-no-cats",
        sku: "NOCAT-1-DEF",
        ean: null,
        price: "9.99",
        weight: null,
        isActive: true,
        availableStock: 1,
      },
    ],
  );
  assert.equal(noCats.payload.categories, undefined);
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
    shopActive: true,
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

test("commerce.sync.start dry-run includes categories and article-category links", async () => {
  const { ctx, suffix, salesChannelId } = await createFixture();

  // Create a category hierarchy
  const [rootCat] = await db
    .insert(category)
    .values({
      tenantId: ctx.tenantId,
      code: `ROOT-${suffix}`,
      name: "Root Category",
      sortOrder: 0,
    })
    .returning();

  const [childCat] = await db
    .insert(category)
    .values({
      tenantId: ctx.tenantId,
      parentCategoryId: rootCat.categoryId,
      code: `CHILD-${suffix}`,
      name: "Child Category",
      sortOrder: 1,
    })
    .returning();

  // Create an article with a category link
  const [articleRow] = await db
    .insert(article)
    .values({
      tenantId: ctx.tenantId,
      articleNo: `ART-CAT-${suffix}`,
      name: "Categorized Article",
    })
    .returning({ articleId: article.articleId });

  await db.insert(articleVariant).values({
    tenantId: ctx.tenantId,
    articleId: articleRow.articleId,
    sku: `ART-CAT-${suffix}-DEF`,
    optionValueHash: crypto.createHash("sha256").update("").digest("hex"),
    price: "15.00",
    isActive: true,
  });

  await db.insert(articleCategory).values({
    tenantId: ctx.tenantId,
    articleId: articleRow.articleId,
    categoryId: childCat.categoryId,
  });

  // Dry-run with categories first, then articles
  const result = expectOk<{
    run: { status: string; totalItems: number; succeededItems: number; dryRun: boolean };
    steps: Array<{ entityType: string; status: string; plannedItems: number }>;
  }>(
    await executeCapability("commerce.commerceSyncRun.start", ctx, {
      salesChannelId,
      direction: "push",
      mode: "single",
      entities: ["category", "article"],
      dryRun: true,
    }),
  );

  assert.equal(result.run.status, "success");
  assert.equal(result.run.dryRun, true);
  assert.equal(result.run.totalItems, 3); // 2 categories + 1 article
  assert.equal(result.run.succeededItems, 3);
  assert.equal(result.steps.length, 2);
  assert.deepEqual(
    result.steps.map((step) => [step.entityType, step.status, step.plannedItems]),
    [
      ["category", "success", 2],
      ["article", "success", 1],
    ],
  );
});

test("commerce.sync dry-run uses price list prices when available", async () => {
  const { ctx, suffix, salesChannelId } = await createFixture();

  const [articleRow] = await db
    .insert(article)
    .values({
      tenantId: ctx.tenantId,
      articleNo: `ART-PL-${suffix}`,
      name: "Price List Article",
    })
    .returning({ articleId: article.articleId });

  const [variantRow] = await db
    .insert(articleVariant)
    .values({
      tenantId: ctx.tenantId,
      articleId: articleRow.articleId,
      sku: `ART-PL-${suffix}-DEF`,
      optionValueHash: crypto.createHash("sha256").update("").digest("hex"),
      price: "5.00",
      isActive: true,
    })
    .returning({ variantId: articleVariant.variantId });

  const [pl] = await db
    .insert(priceList)
    .values({
      tenantId: ctx.tenantId,
      name: `Standard-${suffix}`,
      currencyId: "EUR",
      isNet: true,
    })
    .returning({ priceListId: priceList.priceListId });

  await db.insert(priceListItem).values({
    tenantId: ctx.tenantId,
    priceListId: pl.priceListId,
    variantId: variantRow.variantId,
    price: "100.00",
  });

  const result = expectOk<{
    run: { status: string; totalItems: number; succeededItems: number; dryRun: boolean };
    steps: Array<{ entityType: string; status: string; plannedItems: number }>;
  }>(
    await executeCapability("commerce.commerceSyncRun.start", ctx, {
      salesChannelId,
      direction: "push",
      mode: "single",
      entities: ["article"],
      dryRun: true,
    }),
  );

  assert.equal(result.run.status, "success");
  assert.equal(result.run.dryRun, true);
  assert.equal(result.run.totalItems, 1);
  assert.equal(result.run.succeededItems, 1);
});

test("commerce.sync dry-run records a media step for linked media assets", async () => {
  const { ctx, suffix, salesChannelId } = await createFixture();

  const [articleRow] = await db
    .insert(article)
    .values({
      tenantId: ctx.tenantId,
      articleNo: `ART-MEDIA-${suffix}`,
      name: "Media Article",
    })
    .returning({ articleId: article.articleId });

  await db.insert(articleVariant).values({
    tenantId: ctx.tenantId,
    articleId: articleRow.articleId,
    sku: `ART-MEDIA-${suffix}-DEF`,
    optionValueHash: crypto.createHash("sha256").update("").digest("hex"),
    price: "12.00",
    isActive: true,
  });

  const imageBytes = Buffer.from("article image bytes");
  const storageRoot = process.env.STORAGE_PATH || join(homedir(), "slopware/storage");
  const storageKey = `tenant-${ctx.tenantId}/articles/${articleRow.articleId}/${suffix}-cover.png`;
  await mkdir(join(storageRoot, `tenant-${ctx.tenantId}`, "articles", articleRow.articleId), {
    recursive: true,
  });
  await writeFile(join(storageRoot, storageKey), imageBytes);

  const [image] = await db
    .insert(articleImage)
    .values({
      tenantId: ctx.tenantId,
      articleId: articleRow.articleId,
      storageKey,
      fileName: "cover.png",
      mimeType: "image/png",
      fileSize: imageBytes.byteLength,
      altText: "Cover",
    })
    .returning({ articleImageId: articleImage.articleImageId });

  const result = expectOk<{
    run: { status: string; totalItems: number; succeededItems: number; dryRun: boolean };
    steps: Array<{ entityType: string; status: string; plannedItems: number }>;
  }>(
    await executeCapability("commerce.commerceSyncRun.start", ctx, {
      salesChannelId,
      direction: "push",
      mode: "single",
      entities: ["media_asset"],
      dryRun: true,
    }),
  );

  assert.equal(result.run.status, "success");
  assert.equal(result.run.dryRun, true);
  assert.equal(result.run.totalItems, 1);
  assert.equal(result.run.succeededItems, 1);
  assert.ok(image.articleImageId);
  assert.equal(result.steps.length, 1);
  assert.deepEqual(
    result.steps.map((step) => [step.entityType, step.status, step.plannedItems]),
    [["media_asset", "success", 1]],
  );
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
      shopActive: true,
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
      shopActive: true,
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
      shopActive: true,
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
      shopActive: true,
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

test("commerce.sync delta skips unchanged items and re-pushes changed ones", async () => {
  const { ctx, suffix, salesChannelId } = await createFixture();

  const [addr1] = await db
    .insert(address)
    .values({
      tenantId: ctx.tenantId,
      addressNo: `ADR-DELTA-1-${suffix}`,
      isCustomer: true,
      companyName: "Delta Customer One",
      addressLine1: "Delta Street 1",
      postalCode: "10115",
      city: "Berlin",
      countryCode: "DE",
      shopActive: true,
    })
    .returning({ addressId: address.addressId });

  await db.insert(address).values({
    tenantId: ctx.tenantId,
    addressNo: `ADR-DELTA-2-${suffix}`,
    isCustomer: true,
    companyName: "Delta Customer Two",
    addressLine1: "Delta Street 2",
    postalCode: "10115",
    city: "Berlin",
    countryCode: "DE",
    shopActive: true,
  });

  // Records what each push received and echoes the raw payload back as the snapshot,
  // mirroring what the real Shopware adapter persists for the delta diff.
  const pushedBatches: number[] = [];
  const recordingAdapter: CommerceSyncAdapter = {
    async pushBatch(input): Promise<ShopSyncBatchResult> {
      pushedBatches.push(input.items.length);
      return {
        accepted: input.items.length,
        externalIds: input.items.map((i) => ({
          internalId: i.internalId,
          externalId: `ext-${i.internalId}`,
          payloadSnapshot: i.payload,
        })),
        rejected: [],
      };
    },
  };

  const svc = new CommerceSyncService(ctx.tenantId, null, () => recordingAdapter);

  // Run 1: both addresses are new → both pushed.
  const run1 = await svc.start({ salesChannelId, direction: "push", mode: "single", entities: ["address"] });
  assert.equal(run1.run.status, "success");
  assert.equal(run1.run.totalItems, 2);
  assert.deepEqual(pushedBatches, [2]);

  // Run 2: nothing changed → delta skips everything, no push happens.
  const run2 = await svc.start({ salesChannelId, direction: "push", mode: "single", entities: ["address"] });
  assert.equal(run2.run.status, "success");
  assert.equal(run2.run.totalItems, 0);
  assert.deepEqual(pushedBatches, [2], "no further push when nothing changed");
  assert.equal(run2.steps.length, 1);
  assert.equal(run2.steps[0].status, "skipped");

  // Change one address → only that one is re-pushed.
  await db
    .update(address)
    .set({ companyName: "Delta Customer One (edited)" })
    .where(eq(address.addressId, addr1.addressId));

  const run3 = await svc.start({ salesChannelId, direction: "push", mode: "single", entities: ["address"] });
  assert.equal(run3.run.status, "success");
  assert.equal(run3.run.totalItems, 1, "only the changed address is pushed");
  assert.deepEqual(pushedBatches, [2, 1]);

  // forceFullSync overrides the delta gate and re-pushes everything.
  const run4 = await svc.start({
    salesChannelId,
    direction: "push",
    mode: "single",
    entities: ["address"],
    forceFullSync: true,
  });
  assert.equal(run4.run.status, "success");
  assert.equal(run4.run.totalItems, 2, "force-full re-pushes all addresses");
  assert.deepEqual(pushedBatches, [2, 1, 2]);
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

test("order line financials: gross→net derivation and totals", () => {
  // Gross order (B2C): unit price is gross, net is derived.
  assert.equal(deriveUnitNet(119, "gross", 19), 100);
  // Net order (B2B): unit price is already net.
  assert.equal(deriveUnitNet(100, "net", 19), 100);
  assert.equal(deriveUnitNet(50, "tax-free", 0), 50);

  const fin = computeOrderLineFinancials(100, 3, 19);
  assert.equal(fin.lineTotalNet, 300);
  assert.equal(fin.taxAmount, 57);
});

test("normalizeShopwareOrder flattens nested associations", () => {
  const order = normalizeShopwareOrder({
    id: "sw-order-1",
    orderNumber: "10001",
    orderDateTime: "2026-06-17T10:00:00.000Z",
    taxStatus: "gross",
    currency: { isoCode: "EUR" },
    orderCustomer: {
      customerId: "sw-cust-1",
      customerNumber: "C-1",
      email: "a@b.de",
      firstName: "Max",
      lastName: "Muster",
      company: "Muster GmbH",
      vatIds: ["DE999"],
    },
    billingAddress: {
      firstName: "Max",
      lastName: "Muster",
      street: "Hauptstr 1",
      zipcode: "10115",
      city: "Berlin",
      country: { iso: "DE" },
      phoneNumber: "+49",
    },
    transactions: [
      { createdAt: "2026-06-17T10:00:00.000Z", stateMachineState: { technicalName: "open" } },
      { createdAt: "2026-06-17T11:00:00.000Z", stateMachineState: { technicalName: "paid" } },
    ],
    deliveries: [{ stateMachineState: { technicalName: "shipped" } }],
    lineItems: [
      {
        type: "product",
        referencedId: "sw-prod-1",
        label: "Shirt",
        quantity: 2,
        unitPrice: 119,
        payload: { productNumber: "SKU-1" },
        price: { unitPrice: 119, calculatedTaxes: [{ taxRate: 19 }] },
      },
      {
        type: "shipping",
        label: "Versand",
        quantity: 1,
        unitPrice: 4.99,
        price: { calculatedTaxes: [{ taxRate: 19 }] },
      },
    ],
  });

  assert.equal(order.orderId, "sw-order-1");
  assert.equal(order.taxStatus, "gross");
  assert.equal(order.currencyIso, "EUR");
  // Latest transaction by createdAt wins.
  assert.equal(order.paymentState, "paid");
  assert.equal(order.shippingState, "shipped");
  assert.equal(order.customer?.vatId, "DE999");
  assert.equal(order.billingAddress?.countryIso, "DE");
  assert.equal(order.lines.length, 2);
  assert.equal(order.lines[0].productNumber, "SKU-1");
  assert.equal(order.lines[0].taxRate, 19);
  assert.equal(order.lines[1].type, "shipping");
});

test("commerce.sync pull imports a shop order as a draft sales order (idempotent)", async () => {
  const { ctx, suffix, salesChannelId } = await createFixture();

  const [comp] = await db
    .insert(company)
    .values({
      tenantId: ctx.tenantId,
      companyNo: `C-${suffix}`,
      name: "Order Co",
      countryCode: "DE",
      currencyId: "EUR",
    })
    .returning({ companyId: company.companyId });

  await db.insert(documentGroup).values({
    tenantId: ctx.tenantId,
    companyId: comp.companyId,
    name: "Aufträge",
    documentType: "A",
    groupNumber: 1,
  });

  const [art] = await db
    .insert(article)
    .values({
      tenantId: ctx.tenantId,
      articleNo: `ART-ORD-${suffix}`,
      name: "Order Article",
    })
    .returning({ articleId: article.articleId });

  await db.insert(articleVariant).values({
    tenantId: ctx.tenantId,
    articleId: art.articleId,
    sku: `SKU-ORD-${suffix}`,
    optionValueHash: crypto.createHash("sha256").update("ord").digest("hex"),
    price: "100.00",
    isActive: true,
  });

  const order: ShopwareOrder = {
    orderId: `sw-order-${suffix}`,
    orderNumber: `SW-${suffix}`,
    orderDateTime: "2026-06-17T10:00:00.000Z",
    taxStatus: "gross",
    currencyIso: "EUR",
    customer: {
      customerId: `sw-cust-${suffix}`,
      customerNumber: `SC-${suffix}`,
      email: `shop-${suffix}@example.de`,
      firstName: "Shop",
      lastName: "Kunde",
      company: null,
      vatId: null,
    },
    billingAddress: {
      firstName: "Shop",
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
        productNumber: `SKU-ORD-${suffix}`,
        label: "Order Article",
        quantity: 2,
        unitPrice: 119,
        taxRate: 19,
      },
      {
        type: "shipping",
        referencedId: null,
        productNumber: null,
        label: "Versand",
        quantity: 1,
        unitPrice: 4.99,
        taxRate: 19,
      },
    ],
  };

  const mockAdapter: CommerceSyncAdapter = {
    async pushBatch(): Promise<ShopSyncBatchResult> {
      return { accepted: 0, externalIds: [], rejected: [] };
    },
    async pullOrders(): Promise<ShopwareOrder[]> {
      return [order];
    },
  };

  const svc = new CommerceSyncService(ctx.tenantId, null, () => mockAdapter);
  const run1 = await svc.start({
    salesChannelId,
    direction: "pull",
    mode: "full",
    entities: ["document"],
  });
  assert.equal(run1.run.status, "success", run1.run.errorSummary ?? "no error summary");
  assert.equal(run1.run.totalItems, 1);
  assert.equal(run1.run.succeededItems, 1);

  const docs = await db
    .select()
    .from(document)
    .where(and(eq(document.tenantId, ctx.tenantId), eq(document.documentType, "A")));
  assert.equal(docs.length, 1);
  assert.ok(docs[0].customerId);
  // 2 × 100 net (product) + 4.19 net (shipping derived from 4.99 gross @19%) = 204.19
  assert.equal(Number(docs[0].totalNet), 204.19);

  // New shop customer was auto-created as an address.
  const addrs = await db
    .select()
    .from(address)
    .where(and(eq(address.tenantId, ctx.tenantId), eq(address.addressNo, `SC-${suffix}`)));
  assert.equal(addrs.length, 1);
  assert.equal(addrs[0].isCustomer, true);
  assert.equal(addrs[0].shopActive, true);

  const maps = await db
    .select()
    .from(externalSyncMapping)
    .where(
      and(
        eq(externalSyncMapping.tenantId, ctx.tenantId),
        eq(externalSyncMapping.entityType, "document"),
      ),
    );
  assert.equal(maps.length, 1);
  assert.equal(maps[0].externalId, order.orderId);

  // Second pull: already-imported order is skipped, no duplicate document.
  const run2 = await svc.start({
    salesChannelId,
    direction: "pull",
    mode: "full",
    entities: ["document"],
  });
  assert.equal(run2.run.totalItems, 0);
  const docsAfter = await db
    .select()
    .from(document)
    .where(and(eq(document.tenantId, ctx.tenantId), eq(document.documentType, "A")));
  assert.equal(docsAfter.length, 1, "no duplicate document on re-pull");
});

after(async () => {
  await closeDb();
});
