-- Migration: agent table + address/contact/document extension
-- 2026-06-15
-- Adds: agent table, address communication/shop/finance fields,
--       address_contact social/fax fields, document agent+commission fields.
-- Idempotent: all statements use IF NOT EXISTS / DO NOTHING.

-- ─── 1. Agent table ──────────────────────────────────────────────────────────
-- Vertreternummer is a Büroware concept: the agent is itself an address record.
-- address_id links the agent to their address entry (optional, set by reconcile).
-- user_id links to an internal system user (optional).

CREATE TABLE IF NOT EXISTS "agent" (
  "agent_id"          UUID        PRIMARY KEY DEFAULT uuidv7(),
  "tenant_id"         UUID        NOT NULL REFERENCES "tenant"("tenant_id"),
  "agent_no"          TEXT        NOT NULL,
  "name"              TEXT,
  "address_id"        UUID        REFERENCES "address"("address_id"),
  "user_id"           TEXT        REFERENCES "user"("id"),
  "commission_rate"   NUMERIC(5,2),
  "active"            BOOLEAN     NOT NULL DEFAULT TRUE,
  "archived_at"       TIMESTAMPTZ,
  "custom_attributes" JSONB,
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"        TIMESTAMPTZ,
  CONSTRAINT "uq_agent_tenant_no" UNIQUE ("tenant_id", "agent_no")
);

CREATE INDEX IF NOT EXISTS "idx_agent_tenant"  ON "agent" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_agent_address" ON "agent" ("address_id") WHERE "address_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_agent_user"    ON "agent" ("user_id")    WHERE "user_id"    IS NOT NULL;

-- ─── 2. Extend address ───────────────────────────────────────────────────────
-- communication fields (phone/fax/mobile/email/homepage — firm-level, not contact-level)
-- e-invoicing (leitweg_id for XRechnung, peppol_id for Peppol network)
-- geo (coordinates JSONB {lat, lng} — filled by address.geocode capability via Nominatim)
-- agent FK (nullable; set by import reconciliation after agent records exist)
-- commission_rate (per-customer override, ADR_392_5)
-- credit_rating_score (ADR_3201_6 CP-Rating-Score)
-- shop_active (computed from ADR_2304_1 shopFaehig && !ADR_2305_1 shopGesperrt)

ALTER TABLE "address"
  ADD COLUMN IF NOT EXISTS "salutation"          TEXT,
  ADD COLUMN IF NOT EXISTS "phone_landline"      TEXT,
  ADD COLUMN IF NOT EXISTS "phone_fax"           TEXT,
  ADD COLUMN IF NOT EXISTS "phone_mobile"        TEXT,
  ADD COLUMN IF NOT EXISTS "email"               TEXT,
  ADD COLUMN IF NOT EXISTS "homepage"            TEXT,
  ADD COLUMN IF NOT EXISTS "leitweg_id"          TEXT,
  ADD COLUMN IF NOT EXISTS "peppol_id"           TEXT,
  ADD COLUMN IF NOT EXISTS "coordinates"         JSONB,
  ADD COLUMN IF NOT EXISTS "agent_id"            UUID REFERENCES "agent"("agent_id"),
  ADD COLUMN IF NOT EXISTS "commission_rate"     NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS "credit_rating_score" TEXT,
  ADD COLUMN IF NOT EXISTS "shop_active"         BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS "idx_address_agent" ON "address" ("tenant_id", "agent_id")
  WHERE "agent_id" IS NOT NULL;

-- ─── 3. Extend address_contact ───────────────────────────────────────────────
ALTER TABLE "address_contact"
  ADD COLUMN IF NOT EXISTS "salutation"     TEXT,
  ADD COLUMN IF NOT EXISTS "phone_fax"      TEXT,
  ADD COLUMN IF NOT EXISTS "twitter_handle" TEXT,
  ADD COLUMN IF NOT EXISTS "youtube_url"    TEXT;

-- ─── 4. Extend document ──────────────────────────────────────────────────────
-- agent_id: responsible sales rep at time of document creation (snapshot via address.agent_id)
-- commission_rate: per-document commission % snapshot (from address.commission_rate or agent.commission_rate)

ALTER TABLE "document"
  ADD COLUMN IF NOT EXISTS "agent_id"        UUID REFERENCES "agent"("agent_id"),
  ADD COLUMN IF NOT EXISTS "commission_rate" NUMERIC(5,2);

CREATE INDEX IF NOT EXISTS "idx_document_agent" ON "document" ("tenant_id", "agent_id")
  WHERE "agent_id" IS NOT NULL;
