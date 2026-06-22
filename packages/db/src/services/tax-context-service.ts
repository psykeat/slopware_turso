import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "../index";
import {
  address,
  company,
  country,
  deliveryAddress,
  sellerTaxRegistration,
} from "../schema/sqlite.schema";

export type VatValidationStatus = "missing" | "unknown" | "valid" | "invalid";

export type BuildTaxContextInput = {
  tenantId: string;
  companyId?: string | null;
  documentDate: string;
  customerId: string | null;
  billingCountryCode: string | null;
  deliveryCountryCode: string | null;
  deliveryAddressId?: string | null;
  articleTaxClassId: string | null;
  documentType?: string | null;
};

export type TaxContext = {
  tenantId: string;
  documentDate: string;
  sellerCountryCode: string | null;
  sellerVatId: string | null;
  companyId: string | null;
  customerId: string | null;
  customerTaxClassId: string | null;
  customerVatId: string | null;
  customerVatStatus: VatValidationStatus;
  billingCountryCode: string | null;
  deliveryCountryCode: string | null;
  taxCountryCode: string | null;
  sellerCountryIsEu: boolean | null;
  taxCountryIsEu: boolean | null;
  hasActiveOssRegistration: boolean;
  hasActiveDestinationVatRegistration: boolean;
  articleTaxClassId: string | null;
};

type CountryMetadata = {
  isEu: boolean | null;
};

export class TaxContextService {
  async buildTaxContext(input: BuildTaxContextInput): Promise<TaxContext> {
    const seller = await this.resolveSeller(input.tenantId, input.companyId ?? null);
    const customer = input.customerId
      ? await this.resolveCustomer(input.tenantId, input.customerId)
      : null;
    const deliveryAddressCountryCode = input.deliveryAddressId
      ? await this.resolveDeliveryAddressCountryCode(input.tenantId, input.deliveryAddressId)
      : null;

    const billingCountryCode = normalizeCountryCode(
      input.billingCountryCode ?? customer?.countryCode ?? null,
    );
    const deliveryCountryCode = normalizeCountryCode(
      deliveryAddressCountryCode ?? input.deliveryCountryCode ?? null,
    );
    const taxCountryCode = deliveryCountryCode ?? billingCountryCode;
    const sellerCountryCode = normalizeCountryCode(seller?.countryCode ?? null);

    const [sellerCountry, taxCountry] = await Promise.all([
      this.resolveCountryMetadata(sellerCountryCode),
      this.resolveCountryMetadata(taxCountryCode),
    ]);

    const [hasActiveOssRegistration, hasActiveDestinationVatRegistration] = await Promise.all([
      this.hasActiveRegistration({
        tenantId: input.tenantId,
        companyId: seller?.companyId ?? null,
        countryCode: sellerCountryCode,
        registrationType: "oss",
        documentDate: input.documentDate,
        anyCountry: true,
      }),
      this.hasActiveRegistration({
        tenantId: input.tenantId,
        companyId: seller?.companyId ?? null,
        countryCode: taxCountryCode,
        registrationType: sellerCountryCode === taxCountryCode ? "domestic" : "foreign_vat",
        documentDate: input.documentDate,
      }),
    ]);

    return {
      tenantId: input.tenantId,
      documentDate: input.documentDate,
      sellerCountryCode,
      sellerVatId: seller?.vatId ?? null,
      companyId: seller?.companyId ?? null,
      customerId: input.customerId,
      customerTaxClassId: customer?.taxClassId ?? null,
      customerVatId: customer?.vatId ?? null,
      customerVatStatus: resolveVatStatus(customer?.vatId ?? null),
      billingCountryCode,
      deliveryCountryCode,
      taxCountryCode,
      sellerCountryIsEu: sellerCountry.isEu,
      taxCountryIsEu: taxCountry.isEu,
      hasActiveOssRegistration,
      hasActiveDestinationVatRegistration,
      articleTaxClassId: input.articleTaxClassId,
    };
  }

  private async resolveSeller(tenantId: string, companyId: string | null) {
    const conditions = [eq(company.archived, false)];
    if (companyId) conditions.push(eq(company.companyId, companyId));

    const [row] = await db
      .select({
        companyId: company.companyId,
        countryCode: company.countryCode,
        vatId: company.vatId,
      })
      .from(company)
      .where(and(...conditions))
      .orderBy(asc(company.companyNo))
      .limit(1);

    return row ?? null;
  }

  private async resolveCustomer(tenantId: string, customerId: string) {
    const [row] = await db
      .select({
        taxClassId: address.taxClassId,
        vatId: address.vatId,
        countryCode: address.countryCode,
      })
      .from(address)
      .where(eq(address.addressId, customerId))
      .limit(1);

    return row ?? null;
  }

  private async resolveDeliveryAddressCountryCode(
    tenantId: string,
    deliveryAddressId: string,
  ): Promise<string | null> {
    const [row] = await db
      .select({ countryCode: deliveryAddress.countryCode })
      .from(deliveryAddress)
      .where(
        and(
          eq(deliveryAddress.deliveryAddressId, deliveryAddressId),
          eq(deliveryAddress.archived, false),
        ),
      )
      .limit(1);

    return normalizeCountryCode(row?.countryCode ?? null);
  }

  private async resolveCountryMetadata(countryCode: string | null): Promise<CountryMetadata> {
    if (!countryCode) return { isEu: null };

    const [row] = await db
      .select({ isEu: country.isEu })
      .from(country)
      .where(eq(country.iso2Code, countryCode))
      .limit(1);

    return { isEu: row?.isEu ?? null };
  }

  private async hasActiveRegistration(input: {
    tenantId: string;
    companyId: string | null;
    countryCode: string | null;
    registrationType: "domestic" | "oss" | "foreign_vat";
    documentDate: string;
    anyCountry?: boolean;
  }): Promise<boolean> {
    if (!input.anyCountry && !input.countryCode) return false;

    const companyCondition = input.companyId
      ? sql`(${sellerTaxRegistration.companyId} = ${input.companyId} or ${sellerTaxRegistration.companyId} is null)`
      : sql`${sellerTaxRegistration.companyId} is null`;

    const countryCondition = input.anyCountry
      ? sql`true`
      : eq(sellerTaxRegistration.countryCode, input.countryCode as string);

    const [row] = await db
      .select({ sellerTaxRegistrationId: sellerTaxRegistration.sellerTaxRegistrationId })
      .from(sellerTaxRegistration)
      .where(
        and(
          eq(sellerTaxRegistration.archived, false),
          eq(sellerTaxRegistration.registrationType, input.registrationType),
          countryCondition,
          companyCondition,
          sql`${sellerTaxRegistration.validFrom} <= ${input.documentDate}::date`,
          sql`(${sellerTaxRegistration.validTo} is null or ${sellerTaxRegistration.validTo} >= ${input.documentDate}::date)`,
        ),
      )
      .limit(1);

    return Boolean(row);
  }
}

function resolveVatStatus(vatId: string | null): VatValidationStatus {
  const normalized = vatId?.trim();
  return normalized ? "unknown" : "missing";
}

function normalizeCountryCode(countryCode: string | null | undefined): string | null {
  const normalized = countryCode?.trim().toUpperCase();
  return normalized ? normalized : null;
}
