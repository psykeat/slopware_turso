import { db } from "../index";
import {
  tenant,
  organization,
  userTenant,
  company,
  address,
  article,
  documentType,
  documentGroup,
} from "../schema/app.schema";
import { eq } from "drizzle-orm";

export async function initializeDefaultTenant(userId: string, name: string) {
  return await db.transaction(async (tx) => {
    // 1. Create Organization
    const [org] = await tx
      .insert(organization)
      .values({
        name: `${name}'s Org`,
        slug: `org-${userId.slice(0, 8)}`,
      })
      .returning();

    // 2. Create Tenant
    const [t] = await tx
      .insert(tenant)
      .values({
        organizationId: org.organizationId,
        name: "Default Tenant",
        slug: `tenant-${userId.slice(0, 8)}`,
      })
      .returning();

    // 3. Create Company (Mandatory for Documents)
    const [comp] = await tx
      .insert(company)
      .values({
        tenantId: t.tenantId,
        name: `${name}'s Company`,
        companyNo: "1000",
        countryCode: "DE",
        currencyId: "EUR",
      })
      .returning();

    // 4. Link User to Tenant
    await tx.insert(userTenant).values({
      userId,
      tenantId: t.tenantId,
      role: "owner",
    });

    // 5. Seed Sample Business Data
    await tx.insert(address).values({
      tenantId: t.tenantId,
      addressNo: "10000",
      addressType: "company",
      isCustomer: true,
      companyName: "Sample Customer",
      addressLine1: "Main Street 1",
      city: "Berlin",
      postalCode: "10115",
      countryCode: "DE",
    });

    await tx.insert(article).values({
      tenantId: t.tenantId,
      articleNo: "ART-001",
      name: "Sample Product",
      baseUnit: "pcs",
    });

    const [dt] = await tx
      .insert(documentType)
      .values({
        tenantId: t.tenantId,
        code: "INV",
        name: "Invoice",
        movementType: "L",
      })
      .returning();

    await tx.insert(documentGroup).values({
      tenantId: t.tenantId,
      companyId: comp.companyId,
      name: "Standard Invoices",
      documentType: "L",
      groupNumber: 1,
    });

    return t;
  });
}

export async function getTenantContext(userId: string) {
  const result = await db
    .select({
      tenantId: userTenant.tenantId,
      organizationId: tenant.organizationId,
    })
    .from(userTenant)
    .innerJoin(tenant, eq(userTenant.tenantId, tenant.tenantId))
    .where(eq(userTenant.userId, userId))
    .limit(1);

  return result[0] || null;
}

export async function getUserTenantInfo(userId: string) {
  const result = await db
    .select({
      tenantId: userTenant.tenantId,
      tenantName: tenant.name,
      organizationId: tenant.organizationId,
      orgName: organization.name,
    })
    .from(userTenant)
    .innerJoin(tenant, eq(userTenant.tenantId, tenant.tenantId))
    .innerJoin(organization, eq(tenant.organizationId, organization.organizationId))
    .where(eq(userTenant.userId, userId))
    .limit(1);

  return result[0] || null;
}
