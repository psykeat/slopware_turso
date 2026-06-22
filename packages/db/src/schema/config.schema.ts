import { randomUUID } from "node:crypto";

import { defineRelations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, unique, uniqueIndex } from "drizzle-orm/sqlite-core";

const nowMs = sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`;

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  displayName: text("display_name"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  lastCompanyId: text("last_company_id"),
  isSystemAdmin: integer("is_system_admin", { mode: "boolean" }).notNull().default(false),
  isTenantAdmin: integer("is_tenant_admin", { mode: "boolean" }).notNull().default(false),
  locale: text("locale").notNull().default("de"),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const organization = sqliteTable(
  "organization",
  {
    organizationId: text("organization_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  },
  (table) => [index("organization_slug_key").on(table.slug)],
);

export const tenant = sqliteTable(
  "tenant",
  {
    tenantId: text("tenant_id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.organizationId),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    isBase: integer("is_base", { mode: "boolean" }).notNull().default(false),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    databaseUrl: text("database_url"),
    authTokenRef: text("auth_token_ref"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(nowMs),
  },
  (table) => [
    index("idx_tenant_organization").on(table.organizationId),
    index("tenant_slug_key").on(table.slug),
    uniqueIndex("uq_single_base_tenant")
      .on(table.isBase)
      .where(sql`is_base = 1`),
  ],
);

export const userTenant = sqliteTable(
  "user_tenant",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    role: text("role").notNull(),
  },
  (table) => [
    unique("user_tenant_tenant_user_unique").on(table.tenantId, table.userId),
    index("idx_user_tenant_tenant").on(table.tenantId),
    index("idx_user_tenant_user").on(table.userId),
  ],
);

export const relations = defineRelations(
  { user, session, account, verification, organization, tenant, userTenant },
  (r) => ({
    user: {
      sessions: r.many.session({
        from: r.user.id,
        to: r.session.userId,
      }),
      accounts: r.many.account({
        from: r.user.id,
        to: r.account.userId,
      }),
      tenants: r.many.userTenant({
        from: r.user.id,
        to: r.userTenant.userId,
      }),
    },
    session: {
      user: r.one.user({
        from: r.session.userId,
        to: r.user.id,
      }),
    },
    account: {
      user: r.one.user({
        from: r.account.userId,
        to: r.user.id,
      }),
    },
    organization: {
      tenants: r.many.tenant({
        from: r.organization.organizationId,
        to: r.tenant.organizationId,
      }),
    },
    tenant: {
      organization: r.one.organization({
        from: r.tenant.organizationId,
        to: r.organization.organizationId,
      }),
      users: r.many.userTenant({
        from: r.tenant.tenantId,
        to: r.userTenant.tenantId,
      }),
    },
    userTenant: {
      user: r.one.user({
        from: r.userTenant.userId,
        to: r.user.id,
      }),
      tenant: r.one.tenant({
        from: r.userTenant.tenantId,
        to: r.tenant.tenantId,
      }),
    },
  }),
);
