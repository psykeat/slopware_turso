import assert from "node:assert/strict";
import crypto from "node:crypto";
import test, { after } from "node:test";

import "../scripts/load-env";
import { closeDb, db } from "../index";
import {
  address,
  company,
  country,
  deliveryAddress,
  organization,
  sellerTaxRegistration,
  taxClass,
  tenant,
} from "../schema/app.schema";
import { TaxContextService, type TaxContext } from "./tax-context-service";
import { TaxPolicyService } from "./tax-policy-service";

function taxContext(overrides: Partial<TaxContext> = {}): TaxContext {
  return {
    tenantId: "tenant",
    documentDate: "2026-06-17",
    sellerCountryCode: "DE",
    sellerVatId: "DE123",
    companyId: "company",
    customerId: "customer",
    customerTaxClassId: "customer-tax-class",
    customerVatId: null,
    customerVatStatus: "missing",
    billingCountryCode: "AT",
    deliveryCountryCode: "AT",
    taxCountryCode: "AT",
    sellerCountryIsEu: true,
    taxCountryIsEu: true,
    hasActiveOssRegistration: true,
    hasActiveDestinationVatRegistration: false,
    articleTaxClassId: "article-tax-class",
    ...overrides,
  };
}

async function createContextFixture() {
  const suffix = crypto.randomUUID().slice(0, 8);

  await db
    .insert(country)
    .values([
      { iso2Code: "DE", iso3Code: "DEU", name: { en: "Germany", de: "Deutschland" }, isEu: true },
      { iso2Code: "AT", iso3Code: "AUT", name: { en: "Austria", de: "Oesterreich" }, isEu: true },
      { iso2Code: "CH", iso3Code: "CHE", name: { en: "Switzerland", de: "Schweiz" }, isEu: false },
    ])
    .onConflictDoNothing();

  const [org] = await db
    .insert(organization)
    .values({
      name: `OSS Policy Org ${suffix}`,
      slug: `oss-policy-org-${suffix}`,
    })
    .returning({ organizationId: organization.organizationId });

  const [tenantRow] = await db
    .insert(tenant)
    .values({
      organizationId: org.organizationId,
      name: `OSS Policy Tenant ${suffix}`,
      slug: `oss-policy-tenant-${suffix}`,
    })
    .returning({ tenantId: tenant.tenantId });

  const [seller] = await db
    .insert(company)
    .values({
      tenantId: tenantRow.tenantId,
      companyNo: `C-${suffix}`,
      name: `Seller ${suffix}`,
      countryCode: "DE",
      currencyId: "EUR",
      vatId: `DE${suffix}`,
    })
    .returning({ companyId: company.companyId });

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

  const [customer] = await db
    .insert(address)
    .values({
      tenantId: tenantRow.tenantId,
      addressNo: `A-${suffix}`,
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

  await db.insert(sellerTaxRegistration).values({
    tenantId: tenantRow.tenantId,
    companyId: seller.companyId,
    countryCode: "DE",
    vatId: `DE${suffix}`,
    registrationType: "oss",
    validFrom: "2026-01-01",
  });

  const [foreignOrg] = await db
    .insert(organization)
    .values({
      name: `Foreign OSS Policy Org ${suffix}`,
      slug: `foreign-oss-policy-org-${suffix}`,
    })
    .returning({ organizationId: organization.organizationId });

  const [foreignTenant] = await db
    .insert(tenant)
    .values({
      organizationId: foreignOrg.organizationId,
      name: `Foreign OSS Policy Tenant ${suffix}`,
      slug: `foreign-oss-policy-tenant-${suffix}`,
    })
    .returning({ tenantId: tenant.tenantId });

  const [foreignCustomer] = await db
    .insert(address)
    .values({
      tenantId: foreignTenant.tenantId,
      addressNo: `FA-${suffix}`,
      isCustomer: true,
      companyName: `Foreign Customer ${suffix}`,
      addressLine1: "Foreign Street 1",
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
      postalCode: "8001",
      city: "Zurich",
      countryCode: "CH",
    })
    .returning({ deliveryAddressId: deliveryAddress.deliveryAddressId });

  return {
    tenantId: tenantRow.tenantId,
    companyId: seller.companyId,
    customerId: customer.addressId,
    customerTaxClassId: customerClass.taxClassId,
    articleTaxClassId: articleClass.taxClassId,
    deliveryAddressId: customerDeliveryAddress.deliveryAddressId,
    foreignDeliveryAddressId: foreignDeliveryAddress.deliveryAddressId,
  };
}

test("TaxPolicyService classifies domestic tax policy", () => {
  const result = new TaxPolicyService().classify(
    taxContext({
      sellerCountryCode: "DE",
      taxCountryCode: "DE",
      deliveryCountryCode: "DE",
      taxCountryIsEu: true,
    }),
  );

  assert.equal(result.classification, "domestic");
  assert.equal(result.effectiveCustomerTaxClassId, "customer-tax-class");
  assert.equal(result.taxCountryCode, "DE");
});

test("TaxPolicyService classifies EU B2B only with valid VAT ID", () => {
  const result = new TaxPolicyService().classify(
    taxContext({
      customerVatId: "ATU123",
      customerVatStatus: "valid",
    }),
  );

  assert.equal(result.classification, "intra-community-b2b");
  assert.equal(result.effectiveCustomerTaxClassId, "customer-tax-class");
  assert.equal(result.taxCountryCode, "AT");
});

test("TaxPolicyService falls back to EU B2C OSS when VAT ID is not valid", () => {
  const result = new TaxPolicyService().classify(
    taxContext({
      customerVatId: "ATU123",
      customerVatStatus: "unknown",
      hasActiveOssRegistration: true,
    }),
  );

  assert.equal(result.classification, "eu-b2c-oss");
  assert.equal(result.effectiveCustomerTaxClassId, null);
  assert.match(result.warnings.join(" "), /unknown/);
});

test("TaxPolicyService flags EU B2C without OSS as explicit fallback", () => {
  const result = new TaxPolicyService().classify(
    taxContext({
      customerVatStatus: "missing",
      hasActiveOssRegistration: false,
    }),
  );

  assert.equal(result.classification, "eu-b2c-non-oss");
  assert.equal(result.effectiveCustomerTaxClassId, null);
  assert.match(result.warnings.join(" "), /No active OSS/);
});

test("TaxPolicyService classifies third-country delivery as export", () => {
  const result = new TaxPolicyService().classify(
    taxContext({
      deliveryCountryCode: "CH",
      taxCountryCode: "CH",
      taxCountryIsEu: false,
      hasActiveOssRegistration: false,
    }),
  );

  assert.equal(result.classification, "export");
  assert.equal(result.effectiveCustomerTaxClassId, null);
  assert.equal(result.taxCountryCode, "CH");
});

test("TaxContextService loads seller, customer, delivery country and OSS registration", async () => {
  const fixture = await createContextFixture();
  const context = await new TaxContextService().buildTaxContext({
    tenantId: fixture.tenantId,
    companyId: fixture.companyId,
    documentDate: "2026-06-17",
    customerId: fixture.customerId,
    billingCountryCode: "AT",
    deliveryCountryCode: null,
    deliveryAddressId: fixture.deliveryAddressId,
    articleTaxClassId: fixture.articleTaxClassId,
  });

  assert.equal(context.sellerCountryCode, "DE");
  assert.equal(context.billingCountryCode, "AT");
  assert.equal(context.deliveryCountryCode, "DE");
  assert.equal(context.taxCountryCode, "DE");
  assert.equal(context.customerTaxClassId, fixture.customerTaxClassId);
  assert.equal(context.customerVatStatus, "unknown");
  assert.equal(context.sellerCountryIsEu, true);
  assert.equal(context.taxCountryIsEu, true);
  assert.equal(context.hasActiveOssRegistration, true);
});

test("TaxContextService ignores delivery addresses from another tenant", async () => {
  const fixture = await createContextFixture();
  const context = await new TaxContextService().buildTaxContext({
    tenantId: fixture.tenantId,
    companyId: fixture.companyId,
    documentDate: "2026-06-17",
    customerId: fixture.customerId,
    billingCountryCode: "AT",
    deliveryCountryCode: null,
    deliveryAddressId: fixture.foreignDeliveryAddressId,
    articleTaxClassId: fixture.articleTaxClassId,
  });

  assert.equal(context.deliveryCountryCode, null);
  assert.equal(context.taxCountryCode, "AT");
});

after(async () => {
  await closeDb();
});
