import assert from "node:assert/strict";
import crypto from "node:crypto";
import test, { after } from "node:test";

import "../scripts/load-env";
import { closeDb, db } from "../index";
import {
  address,
  article,
  articleVariant,
  company,
  country,
  deliveryAddress,
  organization,
  sellerTaxRegistration,
  taxClass,
  taxCode,
  taxRule,
  tenant,
} from "../schema/app.schema";
import { DocumentService } from "./document-service";
import { TaxResolutionService } from "./tax-resolution-service";

async function createTaxFixture() {
  const suffix = crypto.randomUUID().slice(0, 8);

  const [org] = await db
    .insert(organization)
    .values({
      name: `Tax Resolution Org ${suffix}`,
      slug: `tax-resolution-org-${suffix}`,
    })
    .returning({ organizationId: organization.organizationId });

  const [tenantRow] = await db
    .insert(tenant)
    .values({
      organizationId: org.organizationId,
      name: `Tax Resolution Tenant ${suffix}`,
      slug: `tax-resolution-tenant-${suffix}`,
    })
    .returning({ tenantId: tenant.tenantId });

  await db
    .insert(country)
    .values([
      { iso2Code: "DE", iso3Code: "DEU", name: { en: "Germany", de: "Deutschland" }, isEu: true },
      { iso2Code: "AT", iso3Code: "AUT", name: { en: "Austria", de: "Oesterreich" }, isEu: true },
    ])
    .onConflictDoNothing();

  const [seller] = await db
    .insert(company)
    .values({
      tenantId: tenantRow.tenantId,
      companyNo: `CO-${suffix}`,
      name: `Seller ${suffix}`,
      countryCode: "DE",
      currencyId: "EUR",
      vatId: `DE${suffix}`,
    })
    .returning({ companyId: company.companyId });

  await db.insert(sellerTaxRegistration).values({
    tenantId: tenantRow.tenantId,
    companyId: seller.companyId,
    countryCode: "DE",
    vatId: `DE${suffix}`,
    registrationType: "oss",
    validFrom: "2026-01-01",
  });

  const [customerClass] = await db
    .insert(taxClass)
    .values({
      tenantId: tenantRow.tenantId,
      code: `CUST-${suffix}`,
      name: { en: "Customer", de: "Kunde" },
    })
    .returning({ taxClassId: taxClass.taxClassId });

  const [articleClass] = await db
    .insert(taxClass)
    .values({
      tenantId: tenantRow.tenantId,
      code: `ART-${suffix}`,
      name: { en: "Article", de: "Artikel" },
    })
    .returning({ taxClassId: taxClass.taxClassId });

  const [genericTaxCode] = await db
    .insert(taxCode)
    .values({
      tenantId: tenantRow.tenantId,
      code: `GEN-${suffix}`,
      description: "Generic tax",
      taxRate: "10",
    })
    .returning({ taxCodeId: taxCode.taxCodeId });

  const [specificTaxCode] = await db
    .insert(taxCode)
    .values({
      tenantId: tenantRow.tenantId,
      code: `SPEC-${suffix}`,
      description: "Specific tax",
      taxRate: "20",
    })
    .returning({ taxCodeId: taxCode.taxCodeId });

  const [deliveryTaxCode] = await db
    .insert(taxCode)
    .values({
      tenantId: tenantRow.tenantId,
      code: `DEL-${suffix}`,
      description: "Delivery country tax",
      taxRate: "19",
    })
    .returning({ taxCodeId: taxCode.taxCodeId });

  const [ossTaxCode] = await db
    .insert(taxCode)
    .values({
      tenantId: tenantRow.tenantId,
      code: `OSS-${suffix}`,
      description: "OSS destination country tax",
      taxRate: "20",
    })
    .returning({ taxCodeId: taxCode.taxCodeId });

  const [customer] = await db
    .insert(address)
    .values({
      tenantId: tenantRow.tenantId,
      addressNo: `C-${suffix}`,
      isCustomer: true,
      companyName: `Customer ${suffix}`,
      addressLine1: "Main Street 1",
      postalCode: "1010",
      city: "Vienna",
      countryCode: "AT",
      taxClassId: customerClass.taxClassId,
      vatId: `ATU${suffix}`,
    })
    .returning({ addressId: address.addressId });

  const [customerDeliveryAddress] = await db
    .insert(deliveryAddress)
    .values({
      tenantId: tenantRow.tenantId,
      addressId: customer.addressId,
      name: `Delivery ${suffix}`,
      addressLine1: "Delivery Street 1",
      postalCode: "10115",
      city: "Berlin",
      countryCode: "DE",
    })
    .returning({ deliveryAddressId: deliveryAddress.deliveryAddressId });

  const [catalogArticle] = await db
    .insert(article)
    .values({
      tenantId: tenantRow.tenantId,
      articleNo: `A-${suffix}`,
      name: `Article ${suffix}`,
      taxClassId: articleClass.taxClassId,
    })
    .returning({ articleId: article.articleId });

  const [variant] = await db
    .insert(articleVariant)
    .values({
      tenantId: tenantRow.tenantId,
      articleId: catalogArticle.articleId,
      sku: `SKU-${suffix}`,
      optionValueHash: `hash-${suffix}`,
      isActive: true,
    })
    .returning({ variantId: articleVariant.variantId });

  const [genericRule] = await db
    .insert(taxRule)
    .values({
      tenantId: tenantRow.tenantId,
      customerTaxClassId: null,
      articleTaxClassId: articleClass.taxClassId,
      countryCode: null,
      taxCodeId: genericTaxCode.taxCodeId,
      validFrom: "2026-01-01",
    })
    .returning({ taxRuleId: taxRule.taxRuleId });

  const [specificRule] = await db
    .insert(taxRule)
    .values({
      tenantId: tenantRow.tenantId,
      customerTaxClassId: customerClass.taxClassId,
      articleTaxClassId: articleClass.taxClassId,
      countryCode: "AT",
      taxCodeId: specificTaxCode.taxCodeId,
      validFrom: "2026-01-01",
    })
    .returning({ taxRuleId: taxRule.taxRuleId });

  const [ossRule] = await db
    .insert(taxRule)
    .values({
      tenantId: tenantRow.tenantId,
      customerTaxClassId: null,
      articleTaxClassId: articleClass.taxClassId,
      countryCode: "AT",
      taxCodeId: ossTaxCode.taxCodeId,
      validFrom: "2026-01-01",
    })
    .returning({ taxRuleId: taxRule.taxRuleId });

  const [deliveryRule] = await db
    .insert(taxRule)
    .values({
      tenantId: tenantRow.tenantId,
      customerTaxClassId: customerClass.taxClassId,
      articleTaxClassId: articleClass.taxClassId,
      countryCode: "DE",
      taxCodeId: deliveryTaxCode.taxCodeId,
      validFrom: "2026-01-01",
    })
    .returning({ taxRuleId: taxRule.taxRuleId });

  const [foreignOrg] = await db
    .insert(organization)
    .values({
      name: `Foreign Tax Resolution Org ${suffix}`,
      slug: `foreign-tax-resolution-org-${suffix}`,
    })
    .returning({ organizationId: organization.organizationId });

  const [foreignTenant] = await db
    .insert(tenant)
    .values({
      organizationId: foreignOrg.organizationId,
      name: `Foreign Tax Resolution Tenant ${suffix}`,
      slug: `foreign-tax-resolution-tenant-${suffix}`,
    })
    .returning({ tenantId: tenant.tenantId });

  const [foreignCustomer] = await db
    .insert(address)
    .values({
      tenantId: foreignTenant.tenantId,
      addressNo: `FC-${suffix}`,
      isCustomer: true,
      companyName: `Foreign Customer ${suffix}`,
      addressLine1: "Other Street 1",
      postalCode: "20095",
      city: "Hamburg",
      countryCode: "DE",
    })
    .returning({ addressId: address.addressId });

  const [foreignDeliveryAddress] = await db
    .insert(deliveryAddress)
    .values({
      tenantId: foreignTenant.tenantId,
      addressId: foreignCustomer.addressId,
      name: `Foreign Delivery ${suffix}`,
      addressLine1: "Foreign Delivery Street 1",
      postalCode: "20095",
      city: "Hamburg",
      countryCode: "DE",
    })
    .returning({ deliveryAddressId: deliveryAddress.deliveryAddressId });

  return {
    tenantId: tenantRow.tenantId,
    companyId: seller.companyId,
    customerTaxClassId: customerClass.taxClassId,
    articleTaxClassId: articleClass.taxClassId,
    customerId: customer.addressId,
    variantId: variant.variantId,
    genericTaxCodeId: genericTaxCode.taxCodeId,
    specificTaxCodeId: specificTaxCode.taxCodeId,
    deliveryTaxCodeId: deliveryTaxCode.taxCodeId,
    ossTaxCodeId: ossTaxCode.taxCodeId,
    deliveryAddressId: customerDeliveryAddress.deliveryAddressId,
    foreignDeliveryAddressId: foreignDeliveryAddress.deliveryAddressId,
    genericRuleId: genericRule.taxRuleId,
    specificRuleId: specificRule.taxRuleId,
    deliveryRuleId: deliveryRule.taxRuleId,
    ossRuleId: ossRule.taxRuleId,
  };
}

test("resolveTaxCode prefers exact customer class and country over generic fallback", async () => {
  const fixture = await createTaxFixture();
  const service = new TaxResolutionService();

  const result = await service.resolveTaxCode({
    tenantId: fixture.tenantId,
    documentDate: "2026-06-17",
    customerId: fixture.customerId,
    billingCountryCode: null,
    deliveryCountryCode: null,
    articleTaxClassId: fixture.articleTaxClassId,
  });

  assert.equal(result.taxCodeId, fixture.specificTaxCodeId);
  assert.equal(result.ruleId, fixture.specificRuleId);
  assert.equal(result.taxRate, "20");
  assert.equal(result.countryCodeUsed, "AT");
  assert.equal(result.customerTaxClassId, fixture.customerTaxClassId);
  assert.equal(result.articleTaxClassId, fixture.articleTaxClassId);
});

test("resolveVariantPricing returns a real tax code, not the article tax class id", async () => {
  const fixture = await createTaxFixture();
  const service = new DocumentService();

  const result = await service.resolveVariantPricing(
    fixture.variantId,
    fixture.customerId,
    "2026-06-17",
    fixture.tenantId,
  );

  assert.equal(result.taxCodeId, fixture.specificTaxCodeId);
  assert.notEqual(result.taxCodeId, fixture.articleTaxClassId);
  assert.match(result.taxReason, /Resolved/);
  assert.equal(result.taxRuleId, fixture.specificRuleId);
  assert.equal(result.taxCountryCodeUsed, "AT");
  assert.equal(result.taxRate, "20");
  assert.equal(result.articleTaxClassId, fixture.articleTaxClassId);
  assert.equal(result.customerTaxClassId, fixture.customerTaxClassId);
});

test("resolveTaxCode uses delivery country before billing country", async () => {
  const fixture = await createTaxFixture();
  const service = new TaxResolutionService();

  const result = await service.resolveTaxCode({
    tenantId: fixture.tenantId,
    documentDate: "2026-06-17",
    customerId: fixture.customerId,
    billingCountryCode: "AT",
    deliveryCountryCode: "DE",
    articleTaxClassId: fixture.articleTaxClassId,
  });

  assert.equal(result.taxCodeId, fixture.deliveryTaxCodeId);
  assert.equal(result.ruleId, fixture.deliveryRuleId);
  assert.equal(result.countryCodeUsed, "DE");
});

test("resolveTaxCodeWithPolicy uses OSS B2C rule when EU customer VAT status is unknown", async () => {
  const fixture = await createTaxFixture();
  const service = new TaxResolutionService();

  const result = await service.resolveTaxCodeWithPolicy({
    tenantId: fixture.tenantId,
    companyId: fixture.companyId,
    documentDate: "2026-06-17",
    customerId: fixture.customerId,
    billingCountryCode: "AT",
    deliveryCountryCode: null,
    articleTaxClassId: fixture.articleTaxClassId,
  });

  assert.equal(result.taxPolicyClassification, "eu-b2c-oss");
  assert.equal(result.taxCodeId, fixture.ossTaxCodeId);
  assert.equal(result.ruleId, fixture.ossRuleId);
  assert.equal(result.customerTaxClassId, null);
  assert.equal(result.countryCodeUsed, "AT");
  assert.match(result.taxWarnings?.join(" ") ?? "", /unknown/);
});

test("resolveVariantPricing resolves delivery address country server-side", async () => {
  const fixture = await createTaxFixture();
  const service = new DocumentService();

  const result = await service.resolveVariantPricing(
    fixture.variantId,
    fixture.customerId,
    "2026-06-17",
    fixture.tenantId,
    {
      billingCountryCode: "AT",
      deliveryAddressId: fixture.deliveryAddressId,
    },
  );

  assert.equal(result.taxCodeId, fixture.deliveryTaxCodeId);
  assert.equal(result.taxRuleId, fixture.deliveryRuleId);
  assert.equal(result.taxCountryCodeUsed, "DE");
});

test("resolveVariantPricing ignores delivery addresses from another tenant", async () => {
  const fixture = await createTaxFixture();
  const service = new DocumentService();

  const result = await service.resolveVariantPricing(
    fixture.variantId,
    fixture.customerId,
    "2026-06-17",
    fixture.tenantId,
    {
      billingCountryCode: "AT",
      deliveryAddressId: fixture.foreignDeliveryAddressId,
    },
  );

  assert.equal(result.taxCodeId, fixture.specificTaxCodeId);
});

test("resolveTaxCode returns no result when no tax rule matches", async () => {
  const fixture = await createTaxFixture();
  const service = new TaxResolutionService();

  const result = await service.resolveTaxCode({
    tenantId: fixture.tenantId,
    documentDate: "2025-12-31",
    customerId: fixture.customerId,
    billingCountryCode: null,
    deliveryCountryCode: null,
    articleTaxClassId: fixture.articleTaxClassId,
  });

  assert.equal(result.taxCodeId, null);
  assert.equal(result.ruleId, null);
  assert.match(result.reason, /No matching tax rule/);
});

after(async () => {
  await closeDb();
});
