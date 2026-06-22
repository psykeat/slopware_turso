CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "email_verified" integer NOT NULL DEFAULT 0,
  "image" text,
  "created_at" integer NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
  "updated_at" integer NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
  "display_name" text,
  "is_active" integer NOT NULL DEFAULT 1,
  "last_company_id" text,
  "is_system_admin" integer NOT NULL DEFAULT 0,
  "is_tenant_admin" integer NOT NULL DEFAULT 0,
  "locale" text NOT NULL DEFAULT 'de'
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY,
  "expires_at" integer NOT NULL,
  "token" text NOT NULL UNIQUE,
  "created_at" integer NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
  "updated_at" integer NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
  "ip_address" text,
  "user_agent" text,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" integer,
  "refresh_token_expires_at" integer,
  "scope" text,
  "password" text,
  "created_at" integer NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
  "updated_at" integer NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" integer NOT NULL,
  "created_at" integer NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
  "updated_at" integer NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" ("identifier");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization" (
  "organization_id" text PRIMARY KEY,
  "slug" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "is_active" integer NOT NULL DEFAULT 1,
  "archived" integer NOT NULL DEFAULT 0,
  "created_at" integer NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_slug_key" ON "organization" ("slug");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant" (
  "tenant_id" text PRIMARY KEY,
  "organization_id" text NOT NULL REFERENCES "organization"("organization_id"),
  "slug" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "is_base" integer NOT NULL DEFAULT 0,
  "is_active" integer NOT NULL DEFAULT 1,
  "archived" integer NOT NULL DEFAULT 0,
  "database_url" text,
  "auth_token_ref" text,
  "created_at" integer NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tenant_organization" ON "tenant" ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_slug_key" ON "tenant" ("slug");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_single_base_tenant" ON "tenant" ("is_base") WHERE is_base = 1;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_tenant" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id"),
  "tenant_id" text NOT NULL REFERENCES "tenant"("tenant_id"),
  "role" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_tenant_tenant_user_unique" ON "user_tenant" ("tenant_id", "user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_tenant_tenant" ON "user_tenant" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_tenant_user" ON "user_tenant" ("user_id");
