import type { TaxContext } from "./tax-context-service";

export type TaxPolicyClassification =
  | "domestic"
  | "intra-community-b2b"
  | "eu-b2c-oss"
  | "eu-b2c-non-oss"
  | "export"
  | "unknown";

export type TaxPolicyResult = {
  classification: TaxPolicyClassification;
  effectiveCustomerTaxClassId: string | null;
  taxCountryCode: string | null;
  reason: string;
  warnings: string[];
};

export class TaxPolicyService {
  classify(context: TaxContext): TaxPolicyResult {
    const warnings: string[] = [];

    if (!context.sellerCountryCode || !context.taxCountryCode) {
      return {
        classification: "unknown",
        effectiveCustomerTaxClassId: null,
        taxCountryCode: context.taxCountryCode,
        reason: "Seller country or tax country is missing; tax policy cannot be classified.",
        warnings: ["Missing seller country or tax country."],
      };
    }

    if (context.sellerCountryCode === context.taxCountryCode) {
      return {
        classification: "domestic",
        effectiveCustomerTaxClassId: context.customerTaxClassId,
        taxCountryCode: context.taxCountryCode,
        reason: "Seller country and tax country are identical; domestic tax policy applies.",
        warnings,
      };
    }

    if (context.taxCountryIsEu === false) {
      return {
        classification: "export",
        effectiveCustomerTaxClassId: null,
        taxCountryCode: context.taxCountryCode,
        reason: "Tax country is outside the EU; export tax policy applies.",
        warnings,
      };
    }

    if (context.sellerCountryIsEu !== true || context.taxCountryIsEu !== true) {
      return {
        classification: "unknown",
        effectiveCustomerTaxClassId: null,
        taxCountryCode: context.taxCountryCode,
        reason: "EU metadata is incomplete for seller country or tax country.",
        warnings: ["Missing or incomplete EU country metadata."],
      };
    }

    if (context.customerVatStatus === "valid" && context.customerTaxClassId) {
      return {
        classification: "intra-community-b2b",
        effectiveCustomerTaxClassId: context.customerTaxClassId,
        taxCountryCode: context.taxCountryCode,
        reason:
          "EU cross-border B2B customer has a valid VAT ID; intra-community tax policy applies.",
        warnings,
      };
    }

    if (context.customerVatStatus !== "valid") {
      warnings.push(
        `Customer VAT ID status is ${context.customerVatStatus}; intra-community B2B tax-free policy is not allowed.`,
      );
    }

    if (context.hasActiveOssRegistration) {
      return {
        classification: "eu-b2c-oss",
        effectiveCustomerTaxClassId: null,
        taxCountryCode: context.taxCountryCode,
        reason:
          "EU cross-border B2C customer with active OSS registration; destination-country tax policy applies.",
        warnings,
      };
    }

    warnings.push("No active OSS registration found for EU cross-border B2C tax policy.");

    return {
      classification: "eu-b2c-non-oss",
      effectiveCustomerTaxClassId: null,
      taxCountryCode: context.taxCountryCode,
      reason:
        "EU cross-border B2C customer without active OSS registration; explicit fallback tax rule is required.",
      warnings,
    };
  }
}
