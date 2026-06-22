import { asc, desc, eq, and } from "drizzle-orm";

import { configDb as db } from "../persistence/config";
import { tenant, organization, userTenant, user } from "../schema/config.schema";

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

    // 3. Link User to Tenant
    await tx.insert(userTenant).values({
      userId,
      tenantId: t.tenantId,
      role: "owner",
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
    .where(and(eq(userTenant.userId, userId), eq(tenant.isActive, true)))
    .orderBy(desc(tenant.isBase), asc(tenant.name))
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
      role: userTenant.role,
      lastCompanyId: user.lastCompanyId,
    })
    .from(userTenant)
    .innerJoin(tenant, eq(userTenant.tenantId, tenant.tenantId))
    .innerJoin(organization, eq(tenant.organizationId, organization.organizationId))
    .innerJoin(user, eq(userTenant.userId, user.id))
    .where(and(eq(userTenant.userId, userId), eq(tenant.isActive, true)))
    .orderBy(desc(tenant.isBase), asc(tenant.name))
    .limit(1);

  return result[0] || null;
}

export async function getUserTenantRole(userId: string, tenantId: string) {
  const [result] = await db
    .select({
      role: userTenant.role,
    })
    .from(userTenant)
    .where(and(eq(userTenant.userId, userId), eq(userTenant.tenantId, tenantId)))
    .limit(1);

  return result?.role ?? null;
}

export async function getTenantInfoById(tenantId: string) {
  const result = await db
    .select({
      tenantId: tenant.tenantId,
      tenantName: tenant.name,
      organizationId: tenant.organizationId,
      orgName: organization.name,
      isActive: tenant.isActive,
      isBase: tenant.isBase,
    })
    .from(tenant)
    .innerJoin(organization, eq(tenant.organizationId, organization.organizationId))
    .where(eq(tenant.tenantId, tenantId))
    .limit(1);

  return result[0] || null;
}

export async function getTenantContextById(tenantId: string) {
  const result = await db
    .select({
      tenantId: tenant.tenantId,
      organizationId: tenant.organizationId,
      isActive: tenant.isActive,
      isBase: tenant.isBase,
    })
    .from(tenant)
    .where(eq(tenant.tenantId, tenantId))
    .limit(1);

  return result[0] || null;
}

export async function getAllTenants() {
  return await db
    .select({
      tenantId: tenant.tenantId,
      tenantName: tenant.name,
      orgName: organization.name,
      isBase: tenant.isBase,
    })
    .from(tenant)
    .innerJoin(organization, eq(tenant.organizationId, organization.organizationId))
    .where(eq(tenant.isActive, true))
    .orderBy(asc(organization.name), asc(tenant.name));
}
