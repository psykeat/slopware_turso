# Feature Slice: Localized Onboarding & Year-End Rollover

This document specifies the design, implementation details, and verification requirements for localized company onboarding (supporting German SKR03 and Austrian EKR templates) and the Jahreswechsel (year-end rollover) assistant.

---

## 1. Goal & Context

Fresh company setups require standard default settings to be immediately operational. Additionally, businesses in Germany and Austria require specialized charts of accounts (Sachkonten) and tax rules.

This feature slice:

- Automatically seeds tax classes, tax codes, leaf GL accounts, payment terms, and warehouses during company initialization based on selected country context.
- Integrates an interactive 5-step Setup Guide wizard to capture legal profile data and run initialization.
- Integrates a Year-End Rollover Assistant to safely reset and clone numbering sequences for upcoming business years.

---

## 2. Database Schema Enhancements

To support year-dependent document numbering sequences, the `number_sequence` table is updated to support specific business years.

### A. Modified Schema Definition (`packages/db/src/schema/app.schema.ts`)

The table `number_sequence` is enhanced with a nullable `fiscal_year` integer column. The composite unique constraint is renamed and expanded to prevent duplicate sequence prefixes _within the same year_:

```typescript
export const numberSequence = pgTable(
  "number_sequence",
  {
    numberSequenceId: uuid("number_sequence_id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.tenantId),
    companyId: uuid("company_id")
      .notNull()
      .references(() => company.companyId),
    prefix: varchar("prefix", { length: 10 }).notNull(),
    fiscalYear: integer("fiscal_year"), // <-- NEW: NULL represents continuous/non-year-bound sequences
    nextValue: integer("next_value").notNull().default(1),
    padding: integer("padding").notNull().default(5),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    unique("number_sequence_tenant_id_company_id_prefix_year_unique").on(
      table.tenantId,
      table.companyId,
      table.prefix,
      table.fiscalYear,
    ),
  ],
);
```

### B. Applied Migrations

The database schema changes were successfully applied via the Drizzle migration engine:

- **Migration Path**: `packages/db/migrations/20260522005551_nosy_typhoid_mary/migration.sql`
- **Actions**:
  1. Drops constraint `number_sequence_tenant_id_company_id_prefix_unique`.
  2. Adds integer column `fiscal_year`.
  3. Establishes unique constraint `number_sequence_tenant_id_company_id_prefix_year_unique` on `(tenant_id, company_id, prefix, fiscal_year)`.

---

## 3. Localization Templates & Seeding Flow

The `CompanyInitializerService` manages the seeding of localized templates inside a single transaction:

- **Germany (DE) Template**:
  - **Taxes**: Seeds standard 19% sales/purchase, 7% reduced sales/purchase, exempt (0%), reverse charge (19%), and EU B2B intra-community taxes.
  - **GL Accounts**: Imports leaf accounts from the standard German **SKR03** template (read dynamically from `/packages/db/src/scripts/skr03.json`). Filtered to ensure only leaf nodes with a 4-digit code are created.
- **Austria (AT) Template**:
  - **Taxes**: Seeds standard 20% sales/purchase, 10% reduced sales/purchase, 13% reduced sales/purchase, exempt (0%), reverse charge (20%), and EU B2B intra-community taxes.
  - **GL Accounts**: Seeds a high-fidelity curated list of Austrian Einheitskontenrahmen (**EKR**) accounts (e.g. 2800 Bank, 1400 Forderungen, 1600 Verbindlichkeiten, 4000 Umsatzerlöse, 5000 Wareneinsatz).
- **Default Sequences**: Seeds standard numbering prefixes (`RE-`, `AN-`, `LI-`, `AU-`, `GU-`) pre-configured with the current calendar year.
- **Corporate Defaults**: Seeds standard warehouse (`MAIN` / `Hauptlager`), standard multi-language payment terms, and primary address categories (`Kunden`, `Lieferanten`, etc.).

---

## 4. UI Presentation & Wizard Details

The UI layer implements two premium React 19 wizards in `apps/web/src/components/setup/`:

### A. SetupGuide (`SetupGuide.tsx`)

A 5-step gorgeous onboarding dialog with strict data validations:

1. **Legal Profile**: Captures Company Legal Name, Tax Number, VAT ID (DE/AT regex checks), Bank Name, BIC (8 or 11 characters), and IBAN (22 digits for DE, 20 digits for AT).
2. **Country & Standard Selection**: Selecable cards for Germany (SKR03) and Austria (EKR) presenting standard and reduced tax summaries.
3. **Preview Accounts & Taxes**: Displays side-by-side grids detailing the standard GL accounts and tax keys that will be initialized.
4. **Default Sequences**: Offers standard number sequences (`RE-`, `AN-`, `LI-`, etc.) with customizable prefixes and starting document numbers.
5. **Background Finalization**: Triggers a sequence of asynchronous steps (patching legal profile, running `/api/setup/initialize`, patching custom sequences) featuring interactive status checklists.

### B. YearEndAssistant (`YearEndAssistant.tsx`)

A guided dialog for annual closing and new-year preparation:

- Allows admins to select a target fiscal year (defaulted automatically to next calendar year).
- Clones all current active numbering sequences for the company into the target year.
- Resets the sequence counter `nextValue` to `1` for the target year.
- Leaves existing past transactions completely intact and unmutated.

---

## 5. Architectural Proposed Changes (Files Touched)

### Database Package

- **`[MODIFY] app.schema.ts`** ([app.schema.ts](file:///home/ubuntu/slopware/packages/db/src/schema/app.schema.ts)): Added `fiscalYear` and created constraint `number_sequence_tenant_id_company_id_prefix_year_unique`.
- **`[NEW] company-initializer.ts`** ([company-initializer.ts](file:///home/ubuntu/slopware/packages/db/src/services/company-initializer.ts)): Service implementing transactional initialization logic for AT/DE templates.

### Web Application

- **`[NEW] SetupGuide.tsx`** ([SetupGuide.tsx](file:///home/ubuntu/slopware/apps/web/src/components/setup/SetupGuide.tsx)): Multi-step onboarding setup guide wizard.
- **`[NEW] YearEndAssistant.tsx`** ([YearEndAssistant.tsx](file:///home/ubuntu/slopware/apps/web/src/components/setup/YearEndAssistant.tsx)): Fiscal year rollover assistant.
- **`[NEW] Route: /api/setup/initialize`** ([initialize.ts](file:///home/ubuntu/slopware/apps/web/src/routes/api/setup/initialize.ts)): Server route executing transactional seeding.
- **`[NEW] Route: /api/setup/year-end`** ([year-end.ts](file:///home/ubuntu/slopware/apps/web/src/routes/api/setup/year-end.ts)): Server route cloning numbering sequences.
- **`[MODIFY] Route: _auth/app/settings/index.tsx`** ([index.tsx](file:///home/ubuntu/slopware/apps/web/src/routes/_auth/app/settings/index.tsx)): Integrated setup and rollover widgets within settings panels when tab is `"company"`.

---

## 5.5 Post-Implementation Fixes & Operational Changes

The following changes were made after the initial feature implementation to correct discovered issues and harden the setup process. Recorded here so future agents understand the current state of the scripts.

**Current setup contract**

- `pnpm db:migrate` applies Drizzle migrations, regenerates docs, and refreshes the settings metadata registry.
- `pnpm db:setup` imports reference data only: countries, currencies, Austrian postal codes, and German postal codes.
- `pnpm db:seed` seeds the base org/tenant/company and canonical business defaults only.
- The fresh-install flow is now intentionally split this way so reference data cannot accidentally overwrite tenant seed data again.

---

### Fix 1 — Settings sidebar was empty after first login (`2026-05-22`)

**Symptom**: After migrations, the Settings left-hand menu showed only the header with no items.

**Root cause**: `helper_table_registry` was empty. The settings sidebar is entirely data-driven: it fetches `/api/metadata/settings-registry` → `MetadataResolver.getSettingsRegistry()` → `SELECT * FROM helper_table_registry WHERE category = 'settings'`. The `seed-metadata.ts` script that populates this table had never been run.

**Fix — [`packages/db/package.json`](file:///home/ubuntu/slopware/packages/db/package.json)**:

The `migrate` script now automatically chains `seed:metadata` on every run:

```diff
- "migrate": "drizzle-kit migrate && pnpm run docs",
+ "migrate": "drizzle-kit migrate && pnpm run docs && pnpm run seed:metadata",
```

`seed:metadata` auto-discovers all Drizzle schema tables, assigns groups, and upserts into `helper_table_registry` + `tenant_fields`. It is fully idempotent. Expected result after migrate: **20 rows** in `helper_table_registry` with `category = 'settings'`.

---

### Fix 2 — `seed.ts` was creating a rogue demo tenant with corrupt data (`2026-05-22`)

**Symptom**: After running `pnpm db:seed`, the Settings UI showed:

- A duplicate `PRD` article group (one on the base tenant, one on a `demo` tenant)
- A wrong document group named `"Standard Invoices"` with `document_type = 'L'`, `group_number = 1`
- Countries and currencies tables were empty (separate issue — see Fix 3)

**Root cause**: `seed.ts` contained a block (section 12) that created a full `demo` org + tenant + company and seeded it with minimal but incorrectly configured reference data:

- `articleGroup { code: 'PRD' }` — duplicate of the base tenant group, different `tenant_id`
- `documentGroup { name: 'Standard Invoices', documentType: 'L', groupNumber: 1 }` — used `L` (Lieferschein) instead of the correct type, and `groupNumber: 1` conflicts with canonical `groupNumber: 0` convention

**Fix — [`packages/db/src/scripts/seed.ts`](file:///home/ubuntu/slopware/packages/db/src/scripts/seed.ts)**:

The entire demo tenant block (sections 12) was removed. `seed.ts` now exclusively seeds the **base tenant**. If a demo/test tenant is ever needed, it must be created via the app UI or a dedicated `seed-demo.ts` script scoped clearly to that purpose.

**DB cleanup applied**:

- Demo tenant (`slug: 'demo'`) and its org deleted from all tables
- `"Standard Invoices"` L/1 document group on the real tenant archived (`archived = true`) per the no-hard-delete rule

> **Invariant**: `seed.ts` must never create additional tenants. Each new tenant gets its own data scope — any cross-contamination shows up in every tenant's settings views.

---

### Fix 3 — Countries, currencies, and postal codes were missing (`2026-05-22`)

**Symptom**: `SELECT count(*) FROM country` → 0, same for `currency` and `postal_code`.

**Root cause**: These tables are populated by standalone import scripts that were never part of any automated chain. They had to be run manually after every fresh DB setup, but this was not documented.

**Fix — new composite script and root shortcuts**:

Added `setup:reference` to [`packages/db/package.json`](file:///home/ubuntu/slopware/packages/db/package.json):

```json
"setup:reference": "pnpm run import-countries-csv && pnpm run seed-currencies && pnpm run import-postal-codes && pnpm run import-german-postal-codes"
```

Added shortcuts to root [`package.json`](file:///home/ubuntu/slopware/package.json):

```json
"db:seed":  "vp run --filter=@repo/db seed",
"db:setup": "vp run --filter=@repo/db setup:reference"
```

**Expected counts after `pnpm db:setup`**:

| Table            | Count                                        |
| ---------------- | -------------------------------------------- |
| `country`        | 249                                          |
| `currency`       | 10 (EUR USD GBP CHF JPY AUD CAD CNY PLN SEK) |
| `postal_code` AT | 2 357                                        |
| `postal_code` DE | 19 531                                       |

> **Note on DE postal import duration**: The `german_postal_codes.json` file is 2 MB / 19 675 rows and takes ~2–3 minutes even with 500-row batch inserts. This is expected. Do not kill the process early.

---

## 6. Fresh Install Runbook

Complete ordered sequence for setting up a new environment from scratch. Every step is idempotent — safe to re-run.

---

### Phase 1 — Schema & Metadata

```bash
# 1a. Apply all Drizzle migrations.
#     Automatically chains: docs generation + seed:metadata
#     Result: all tables created, helper_table_registry populated (20 settings rows)
pnpm db:migrate
```

> **Why this matters**: `pnpm db:migrate` is wired to also run `seed:metadata` on completion (see [packages/db/package.json](file:///home/ubuntu/slopware/packages/db/package.json)). A missing `seed:metadata` run leaves `helper_table_registry` empty, which causes the Settings left-hand menu to appear completely blank.

**Verify:**

```sql
SELECT count(*) FROM helper_table_registry WHERE category = 'settings';
-- expect 20
```

---

### Phase 2 — Reference Data

Imports global lookup tables (countries, currencies, postal codes). No admin user required. Safe on any existing DB — all imports use `ON CONFLICT DO NOTHING`.

```bash
# Single command — runs all four imports in order:
#   1. 249 countries (from countries.csv)
#   2. 10 major currencies (EUR, USD, GBP, CHF, JPY, AUD, CAD, CNY, PLN, SEK)
#   3. 2 357 Austrian postal codes
#   4. 19 531 German postal codes  (~2-3 min due to dataset size)
pnpm db:setup
```

**Verify:**

```sql
SELECT 'countries',    count(*) FROM country      -- 249
UNION ALL
SELECT 'currencies',   count(*) FROM currency     -- 10
UNION ALL
SELECT 'postal_codes', count(*) FROM postal_code; -- ~21 888
```

---

### Phase 3 — Admin User & Base Tenant

> **Prerequisite**: The app must be running (`pnpm dev`) for user registration.

```bash
# 3a. Start the dev environment if not already running
sudo docker compose up -d && pnpm dev
```

1. Open the app and register the first user account via the signup form.
2. Promote that user to system admin in the DB:
   ```sql
   UPDATE "user" SET is_system_admin = true WHERE email = 'your@email.com';
   ```
3. Seed the base org, tenant, company, document types, document groups, article groups, number sequences, and units:
   ```bash
   pnpm db:seed
   ```

**Verify:**

```sql
SELECT slug, is_base FROM tenant;                     -- base = true
SELECT count(*) FROM document_group WHERE tenant_id = (SELECT tenant_id FROM tenant WHERE is_base);
-- expect 13 canonical groups (group_number = 0)
SELECT count(*) FROM article_group WHERE tenant_id = (SELECT tenant_id FROM tenant WHERE is_base);
-- expect 4 (PKG, PRD, RAW, SVC)
```

---

### Phase 4 — Company Initialization (UI)

Run inside the app after logging in as the admin user:

1. Go to **Settings → Company Master**.
2. Create a company record (F3) if one doesn't exist.
3. Click **"Ersteinrichtung starten"** → complete the 5-step Setup Guide:
   - Select **Deutschland (SKR03)** or **Österreich (EKR)**
   - Confirm the GL accounts and tax codes previewed
   - Customize number sequence prefixes if needed
   - Let the wizard finalize (seeds taxes, GL accounts, payment terms, warehouse)

---

### Phase 5 — Lint Check

```bash
pnpm lint
# expect 0 errors
```

---

### Settings Sidebar Checklist

After all phases complete, the Settings sidebar must show all 6 groups:

| Group             | Entities                                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| **Master**        | Company                                                                                                        |
| **Organisation**  | Bank Accounts, Number Sequences                                                                                |
| **Vertrieb**      | Address Categories, Discount Groups, Document Groups, Industries, Payment Terms, Price Lists, Shipping Methods |
| **Lager/Artikel** | Article Groups, Units, Warehouses                                                                              |
| **Finanzen**      | Cost Centers, Currencies, GL Accounts, Tax Classes, Tax Codes                                                  |
| **Geodaten**      | Countries, Postal Codes                                                                                        |

---

### Re-running Individual Steps

| Need                                          | Command                                |
| --------------------------------------------- | -------------------------------------- |
| Refresh settings registry after schema change | `pnpm --filter=@repo/db seed:metadata` |
| Re-import countries only                      | `pnpm db:import-countries-csv`         |
| Re-import currencies only                     | `pnpm db:seed-currencies`              |
| Re-import AT postal codes                     | `pnpm db:import-postal-codes`          |
| Re-import DE postal codes                     | `pnpm db:import-german-postal-codes`   |
| Full reference data re-import                 | `pnpm db:setup`                        |
| Re-seed base tenant data                      | `pnpm db:seed`                         |
