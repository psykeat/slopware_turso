ALTER TABLE "user" ADD COLUMN "is_tenant_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "email_account" ADD COLUMN "granted_by_user_id" text;--> statement-breakpoint
ALTER TABLE "email_account" ADD COLUMN "granted_scopes" jsonb;--> statement-breakpoint
ALTER TABLE "email_account" ADD CONSTRAINT "email_account_granted_by_user_id_user_id_fkey" FOREIGN KEY ("granted_by_user_id") REFERENCES "user"("id");--> statement-breakpoint
