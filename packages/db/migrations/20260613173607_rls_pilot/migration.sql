-- RLS pilot (Phase 8). A NOLOGIN `app_runtime` role plus tenant-isolation
-- policies on five tables, keyed to the transaction-local `app.tenant_id` GUC
-- that the capability runtime sets when CAPABILITY_RLS=1. RLS is ENABLEd (not
-- FORCEd), so the migration/seed/owner connection keeps bypassing it and the
-- running app is unaffected; only sessions acting as app_runtime are scoped.
-- The runtime connection cutover (DATABASE_URL → app_runtime) is a separate,
-- deliberate step once every non-capability DB path has been audited.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime NOLOGIN;
  END IF;
END
$$;--> statement-breakpoint
-- Allow the current (owner) role to SET ROLE app_runtime for verification and
-- the eventual cutover.
GRANT app_runtime TO CURRENT_USER;--> statement-breakpoint
GRANT USAGE ON SCHEMA "public" TO app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "address", "article", "document", "document_line", "email_thread" TO app_runtime;--> statement-breakpoint
ALTER TABLE "address" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "rls_tenant_isolation" ON "address";--> statement-breakpoint
CREATE POLICY "rls_tenant_isolation" ON "address"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "article" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "rls_tenant_isolation" ON "article";--> statement-breakpoint
CREATE POLICY "rls_tenant_isolation" ON "article"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "document" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "rls_tenant_isolation" ON "document";--> statement-breakpoint
CREATE POLICY "rls_tenant_isolation" ON "document"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "document_line" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "rls_tenant_isolation" ON "document_line";--> statement-breakpoint
CREATE POLICY "rls_tenant_isolation" ON "document_line"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "email_thread" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "rls_tenant_isolation" ON "email_thread";--> statement-breakpoint
CREATE POLICY "rls_tenant_isolation" ON "email_thread"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
