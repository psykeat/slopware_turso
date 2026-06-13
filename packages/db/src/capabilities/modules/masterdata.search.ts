import { and, asc, desc, eq, ilike, isNotNull, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "../../index";
import {
  address,
  addressContact,
  addressContactIdentity,
  article,
  deliveryAddress,
  unit,
} from "../../schema/app.schema";
import { defineCapability } from "../core/define";

function formatContactName(firstName: string | null, lastName: string | null) {
  return [firstName, lastName].filter(Boolean).join(" ").trim();
}

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
  exposure: {
    llm: "safe",
    http: true,
    ai: {
      group: "catalog",
      activeByDefault: true,
      useWhen: [
        "You have an article name or number fragment and need to resolve it to an articleId (e.g. before adding a document line).",
      ],
      resultShape: "{ items: { articleId, articleNo, name, ... }[] }",
    },
  },
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
  exposure: {
    llm: "safe",
    http: true,
    ai: {
      group: "catalog",
      activeByDefault: true,
      useWhen: [
        "You have a company name, address number or city fragment and need to resolve it to an addressId (e.g. a customer for a document).",
      ],
      resultShape: "{ items: { addressId, addressNo, companyName, city, ... }[] }",
    },
  },
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

// Contact type-ahead, moved verbatim from the `?q=` branch of /api/data/$.ts.
// Searches contact name/email and external identity values, dedups by contact,
// and synthesizes a display `name`. Bespoke identity join, so hand-written.
export const addressContactSearch = defineCapability({
  module: "masterdata",
  entityName: "addressContact",
  operation: "search",
  kind: "read",
  summary: { en: "Search contacts for lookup", de: "Kontakte für Lookup suchen" },
  description: {
    en: "Type-ahead lookup over contact name, email and external identity values; returns a compact row with a display name for pickers.",
    de: "Type-ahead-Lookup über Kontaktname, E-Mail und externe Identitätswerte; liefert eine kompakte Zeile mit Anzeigename für Picker.",
  },
  input: searchInputSchema,
  output: z.object({ items: z.array(looseRowSchema) }),
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: {
    llm: "safe",
    http: true,
    ai: {
      group: "mail",
      activeByDefault: true,
      useWhen: [
        "You have a sender name or email address from a mail and need to resolve it to the contact's parent addressId.",
      ],
      resultShape: "{ items: { contactId, addressId, name, email, ... }[] }",
    },
  },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    if (input.q.length === 0) return { items: [] };
    const term = `%${input.q}%`;
    const rows = await db
      .select({
        contactId: addressContact.contactId,
        addressId: addressContact.addressId,
        firstName: addressContact.firstName,
        lastName: addressContact.lastName,
        email: addressContact.email,
        isPrimary: addressContact.isPrimary,
        sourceSystem: addressContactIdentity.sourceSystem,
      })
      .from(addressContact)
      .leftJoin(
        addressContactIdentity,
        eq(addressContact.contactId, addressContactIdentity.contactId),
      )
      .where(
        and(
          eq(addressContact.tenantId, ctx.tenantId),
          eq(addressContact.archived, false),
          or(
            and(
              isNotNull(addressContact.email),
              sql`${addressContact.email} <> ''`,
              or(
                ilike(addressContact.firstName, term),
                ilike(addressContact.lastName, term),
                ilike(addressContact.email, term),
              ),
            ),
            ilike(addressContactIdentity.value, term),
            ilike(addressContactIdentity.normalizedValue, term),
          ),
        ),
      )
      .orderBy(asc(addressContact.lastName), asc(addressContact.firstName), asc(addressContact.email))
      .limit(input.limit * 5);

    const deduped = new Map<string, z.output<typeof looseRowSchema>>();
    for (const row of rows) {
      if (deduped.has(row.contactId)) continue;
      deduped.set(row.contactId, {
        ...row,
        sourceSystem: row.sourceSystem ?? "crm",
        name: formatContactName(row.firstName, row.lastName),
      });
    }
    return { items: Array.from(deduped.values()).slice(0, input.limit) };
  },
});

export const searchCapabilities = [
  articleSearch,
  addressSearch,
  deliveryAddressSearch,
  addressContactSearch,
];
