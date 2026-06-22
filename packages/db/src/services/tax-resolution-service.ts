import { and, eq, sql } from "drizzle-orm";

import { db } from "../index";
import { address, taxCode, taxRule } from "../schema/sqlite.schema";
import { TaxContextService } from "./tax-context-service";
import { TaxPolicyService, type TaxPolicyClassification } from "./tax-policy-service";

export type ResolveTaxInput = {
  tenantId: string;
  companyId?: string | null;
  documentDate: string;
  customerId: string | null;
  billingCountryCode: string | null;
  deliveryCountryCode: string | null;
  deliveryAddressId?: string | null;
  articleTaxClassId: string | null;
  documentType?: string | null;
  customerTaxClassIdOverride?: string | null;
  countryCodeOverride?: string | null;
  taxPolicyClassification?: TaxPolicyClassification | null;
  taxPolicyReason?: string | null;
  taxWarnings?: string[];
};

export type ResolvedTaxResult = {
  taxCodeId: string | null;
  taxRate: string | null;
  ruleId: string | null;
  countryCodeUsed: string | null;
  customerTaxClassId: string | null;
  articleTaxClassId: string | null;
  reason: string;
  taxPolicyClassification?: TaxPolicyClassification | null;
  taxPolicyReason?: string | null;
  taxWarnings?: string[];
};

type CustomerTaxContext = {
  taxClassId: string | null;
  vatId: string | null;
  countryCode: string | null;
};

export class TaxResolutionService {
  async resolveTaxCodeWithPolicy(input: ResolveTaxInput): Promise<ResolvedTaxResult> {
    const context = await new TaxContextService().buildTaxContext({
      tenantId: input.tenantId,
      companyId: input.companyId ?? null,
      documentDate: input.documentDate,
      customerId: input.customerId,
      billingCountryCode: input.billingCountryCode,
      deliveryCountryCode: input.deliveryCountryCode,
      deliveryAddressId: input.deliveryAddressId ?? null,
      articleTaxClassId: input.articleTaxClassId,
      documentType: input.documentType,
    });
    const policy = new TaxPolicyService().classify(context);

    return this.resolveTaxCode({
      ...input,
      billingCountryCode: policy.taxCountryCode,
      deliveryCountryCode: null,
      customerTaxClassIdOverride: policy.effectiveCustomerTaxClassId,
      countryCodeOverride: policy.taxCountryCode,
      taxPolicyClassification: policy.classification,
      taxPolicyReason: policy.reason,
      taxWarnings: policy.warnings,
    });
  }

  async resolveTaxCode(input: ResolveTaxInput): Promise<ResolvedTaxResult> {
    const customerContext = input.customerId
      ? await this.resolveCustomerContext(input.tenantId, input.customerId)
      : null;

    const customerTaxClassId =
      "customerTaxClassIdOverride" in input
        ? (input.customerTaxClassIdOverride ?? null)
        : (customerContext?.taxClassId ?? null);
    const billingCountryCode = normalizeCountryCode(
      input.billingCountryCode ?? customerContext?.countryCode ?? null,
    );
    const deliveryCountryCode = normalizeCountryCode(input.deliveryCountryCode);
    const countryCodeUsed =
      normalizeCountryCode(input.countryCodeOverride) ?? deliveryCountryCode ?? billingCountryCode;
    const articleTaxClassId = input.articleTaxClassId;

    if (!articleTaxClassId) {
      return {
        taxCodeId: null,
        taxRate: null,
        ruleId: null,
        countryCodeUsed,
        customerTaxClassId,
        articleTaxClassId,
        reason: "No article tax class provided; tax rule lookup skipped.",
        taxPolicyClassification: input.taxPolicyClassification ?? null,
        taxPolicyReason: input.taxPolicyReason ?? null,
        taxWarnings: input.taxWarnings ?? [],
      };
    }

    const [match] = await db
      .select({
        ruleId: taxRule.taxRuleId,
        taxCodeId: taxRule.taxCodeId,
        taxRate: taxCode.taxRate,
        countryCode: taxRule.countryCode,
        customerTaxClassId: taxRule.customerTaxClassId,
      })
      .from(taxRule)
      .innerJoin(taxCode, eq(taxRule.taxCodeId, taxCode.taxCodeId))
      .where(
        and(
          eq(taxRule.articleTaxClassId, articleTaxClassId),
          sql`${taxRule.validFrom} <= ${input.documentDate}::date`,
          sql`(${taxRule.validTo} is null or ${taxRule.validTo} >= ${input.documentDate}::date)`,
          customerTaxClassId
            ? sql`(${taxRule.customerTaxClassId} = ${customerTaxClassId} or ${taxRule.customerTaxClassId} is null)`
            : sql`${taxRule.customerTaxClassId} is null`,
          countryCodeUsed
            ? sql`(${taxRule.countryCode} = ${countryCodeUsed} or ${taxRule.countryCode} is null)`
            : sql`${taxRule.countryCode} is null`,
        ),
      )
      .orderBy(
        sql`case when ${taxRule.customerTaxClassId} is not null then 0 else 1 end`,
        sql`case when ${taxRule.countryCode} is not null then 0 else 1 end`,
        sql`${taxRule.validFrom} desc`,
      )
      .limit(1);

    if (!match) {
      return {
        taxCodeId: null,
        taxRate: null,
        ruleId: null,
        countryCodeUsed,
        customerTaxClassId,
        articleTaxClassId,
        reason: "No matching tax rule found for customer class, article class, country, and date.",
        taxPolicyClassification: input.taxPolicyClassification ?? null,
        taxPolicyReason: input.taxPolicyReason ?? null,
        taxWarnings: input.taxWarnings ?? [],
      };
    }

    const customerSpecificity = match.customerTaxClassId ? "customer-specific" : "customer-generic";
    const countrySpecificity = match.countryCode ? "country-specific" : "country-generic";

    return {
      taxCodeId: match.taxCodeId,
      taxRate: match.taxRate,
      ruleId: match.ruleId,
      countryCodeUsed,
      customerTaxClassId,
      articleTaxClassId,
      reason: `Resolved ${customerSpecificity}, ${countrySpecificity} tax rule.`,
      taxPolicyClassification: input.taxPolicyClassification ?? null,
      taxPolicyReason: input.taxPolicyReason ?? null,
      taxWarnings: input.taxWarnings ?? [],
    };
  }

  private async resolveCustomerContext(
    tenantId: string,
    customerId: string,
  ): Promise<CustomerTaxContext | null> {
    const [customer] = await db
      .select({
        taxClassId: address.taxClassId,
        vatId: address.vatId,
        countryCode: address.countryCode,
      })
      .from(address)
      .where(eq(address.addressId, customerId))
      .limit(1);

    return customer ?? null;
  }
}

function normalizeCountryCode(countryCode: string | null | undefined): string | null {
  const normalized = countryCode?.trim().toUpperCase();
  return normalized ? normalized : null;
}
