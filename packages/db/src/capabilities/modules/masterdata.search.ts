import { and, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { z } from "zod";

import { db } from "../../index";
import { address, article, deliveryAddress, unit } from "../../schema/app.schema";
import { defineCapability } from "../core/define";

const looseRowSchema = z.looseObject({});

const searchInputSchema = z.object({
  q: z.string().trim().default(""),
  limit: z.number().int().min(1).max(50).default(20),
});

// Dedicated lookup/search reads, moved verbatim out of the ad-hoc
// /api/{articles,addresses,delivery-addresses}/search routes. Bespoke column
// projections + multi-field ilike, so they stay hand-written queries rather
// than going through DataService.list.

export const articleSearch = defineCapability({
  module: "masterdata",
  entityName: "article",
  operation: "search",
  kind: "read",
  summary: { en: "Search articles for lookup", de: "Artikel für Lookup suchen" },
  description: {
    en: "Type-ahead lookup over articleNo and name; returns a compact row for pickers.",
    de: "Type-ahead-Lookup über Artikelnummer und Name; liefert eine kompakte Zeile für Picker.",
  },
  input: searchInputSchema,
  output: z.object({ items: z.array(looseRowSchema) }),
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const rows = await db
      .select({
        articleId: article.articleId,
        articleNo: article.articleNo,
        name: article.name,
        baseUnitCode: unit.code,
        taxClassId: article.taxClassId,
        bomType: article.bomType,
        trackingMode: article.trackingMode,
      })
      .from(article)
      .leftJoin(unit, eq(unit.unitId, article.baseUnitId))
      .where(
        and(
          eq(article.tenantId, ctx.tenantId),
          isNull(article.archivedAt),
          input.q.length > 0
            ? or(ilike(article.articleNo, `%${input.q}%`), ilike(article.name, `%${input.q}%`))
            : undefined,
        ),
      )
      .limit(input.limit);
    return { items: rows as z.output<typeof looseRowSchema>[] };
  },
});

export const addressSearch = defineCapability({
  module: "masterdata",
  entityName: "address",
  operation: "search",
  kind: "read",
  summary: { en: "Search addresses for lookup", de: "Adressen für Lookup suchen" },
  description: {
    en: "Type-ahead lookup over addressNo, company, city and search text.",
    de: "Type-ahead-Lookup über Adressnummer, Firma, Ort und Suchtext.",
  },
  input: searchInputSchema,
  output: z.object({ items: z.array(looseRowSchema) }),
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const rows = await db
      .select({
        addressId: address.addressId,
        addressNo: address.addressNo,
        companyName: address.companyName,
        firstName: address.firstName,
        lastName: address.lastName,
        addressLine1: address.addressLine1,
        postalCode: address.postalCode,
        city: address.city,
        countryCode: address.countryCode,
        currencyId: address.currencyId,
        paymentTermId: address.paymentTermId,
        defaultDeliveryAddressId: address.defaultDeliveryAddressId,
      })
      .from(address)
      .where(
        and(
          eq(address.tenantId, ctx.tenantId),
          input.q.length > 0
            ? or(
                ilike(address.companyName, `%${input.q}%`),
                ilike(address.addressNo, `%${input.q}%`),
                ilike(address.city, `%${input.q}%`),
                ilike(address.searchText, `%${input.q}%`),
              )
            : undefined,
        ),
      )
      .limit(input.limit);
    return { items: rows as z.output<typeof looseRowSchema>[] };
  },
});

export const deliveryAddressSearch = defineCapability({
  module: "masterdata",
  entityName: "deliveryAddress",
  operation: "search",
  kind: "read",
  summary: { en: "Search delivery addresses for lookup", de: "Lieferadressen für Lookup suchen" },
  description: {
    en: "Type-ahead lookup over delivery address and parent address fields; optionally scoped to one addressId.",
    de: "Type-ahead-Lookup über Liefer- und Stammadressfelder; optional auf eine addressId eingeschränkt.",
  },
  input: searchInputSchema.extend({ addressId: z.uuid().optional() }),
  output: z.object({ items: z.array(looseRowSchema) }),
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const rows = await db
      .select({
        deliveryAddressId: deliveryAddress.deliveryAddressId,
        addressNo: address.addressNo,
        name: deliveryAddress.name,
        companyName: address.companyName,
        addressLine1: deliveryAddress.addressLine1,
        postalCode: deliveryAddress.postalCode,
        city: deliveryAddress.city,
        countryCode: deliveryAddress.countryCode,
      })
      .from(deliveryAddress)
      .innerJoin(address, eq(deliveryAddress.addressId, address.addressId))
      .where(
        and(
          eq(deliveryAddress.tenantId, ctx.tenantId),
          eq(address.tenantId, ctx.tenantId),
          input.addressId ? eq(deliveryAddress.addressId, input.addressId) : undefined,
          input.q.length > 0
            ? or(
                ilike(deliveryAddress.name, `%${input.q}%`),
                ilike(deliveryAddress.addressLine1, `%${input.q}%`),
                ilike(deliveryAddress.city, `%${input.q}%`),
                ilike(deliveryAddress.postalCode, `%${input.q}%`),
                ilike(address.addressNo, `%${input.q}%`),
                ilike(address.companyName, `%${input.q}%`),
                ilike(address.searchText, `%${input.q}%`),
              )
            : undefined,
        ),
      )
      .orderBy(desc(deliveryAddress.createdAt))
      .limit(input.limit);
    return { items: rows as z.output<typeof looseRowSchema>[] };
  },
});

export const searchCapabilities = [articleSearch, addressSearch, deliveryAddressSearch];
