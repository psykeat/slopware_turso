# Variant-Centric Commerce Issues

Parent: [docs/prd/variant-centric-commerce-stabilization.md](/home/ubuntu/slopware/docs/prd/variant-centric-commerce-stabilization.md)

## 1. Harden Variant Schema and Constraints

**Type:** AFK  
**What:** Make the variant-centric entities the authoritative schema shape, including uniqueness, lookup, and foreign-key constraints for `article_variant`, `article_option`, `article_option_value`, `article_variant_option_value`, `inventory_item`, `inventory_level`, `price_list_item`, and `external_sync_mapping`.  
**File Cluster:** `packages/db/src/schema/app.schema.ts`, `packages/db/migrations/*`  
**Blocked by:** None  
**Acceptance shape:** schema

## 2. Backfill Default Variants for Legacy Articles

**Type:** AFK  
**What:** Create exactly one default variant and one inventory item for each article that lacks a variant, with idempotent behavior under repeated execution.  
**File Cluster:** `packages/db/src/services/default-variant-backfill.ts`, `packages/db/src/services/default-variant-backfill.test.ts`  
**Blocked by:** 1  
**Acceptance shape:** write path + reconciliation

## 3. Generate Article Variants from Options

**Type:** AFK  
**What:** Generate the cartesian product of article options, create missing variants and inventory items, and keep the operation idempotent and concurrency-safe.  
**File Cluster:** `packages/db/src/services/article-variant-generator.ts`, `packages/db/src/services/article-variant-generator.test.ts`, `apps/web/src/routes/api/articles/$articleId/generate-variants.ts`  
**Blocked by:** 1, 2  
**Acceptance shape:** write path + endpoint

## 4. Enforce Variant-Aware Document Lines

**Type:** AFK  
**What:** Ensure catalog document lines require `variantId`, and route document-line validation and posting through variant truth instead of article truth.  
**File Cluster:** `packages/db/src/services/document-service.ts`, `packages/db/src/schema/app.schema.ts`, document-line-related tests  
**Blocked by:** 1, 2, 3  
**Acceptance shape:** validation + write path

## 5. Move Stock Projection to Variant Inventory Anchors

**Type:** AFK  
**What:** Eliminate article-centric stock truth by making inventory posting and stock projection operate through `inventory_item` / `variantId` / `inventory_level` instead of `articleId`.  
**File Cluster:** `packages/db/src/services/document-service.ts`, `packages/db/src/schema/app.schema.ts`, stock-related tests  
**Blocked by:** 1, 2, 4  
**Acceptance shape:** write path + schema

## 6. Make Price Resolution Variant-First

**Type:** AFK  
**What:** Resolve prices from variant-specific rows and remove article-as-operative-price assumptions from pricing and document entry.  
**File Cluster:** `packages/db/src/services/document-service.ts`, `packages/db/src/schema/app.schema.ts`, pricing-related tests  
**Blocked by:** 1, 2, 3, 4  
**Acceptance shape:** read path + write path

## 7. Propagate Variant Identity into Facts and Reporting

**Type:** AFK  
**What:** Keep article aggregation available, but ensure facts and reporting carry variant identity as the primary operational reference.  
**File Cluster:** `packages/db/src/schema/app.schema.ts`, `packages/db/src/services/document-service.ts`, reporting queries/tests  
**Blocked by:** 1, 4, 5, 6  
**Acceptance shape:** read path + schema

## 8. Expose Variant Lookup and Actions in the Article Workspace

**Type:** HITL  
**What:** Update the article workspace so variant selection, SKU and option summaries, inventory SKU editing, and bulk variant actions remain usable in the UI.  
**File Cluster:** `apps/web/src/routes/_auth/app/articles.tsx`, `packages/db/src/services/metadata.ts`, `packages/db/src/services/ai-discovery.ts`  
**Blocked by:** 2, 3, 4, 5, 6  
**Acceptance shape:** UI affordance + integration

## 9. Register Sync Mappings for Variant Entities

**Type:** AFK  
**What:** Ensure external sync mapping and payload building treat variant entities as first-class sync targets.  
**File Cluster:** `packages/db/src/schema/app.schema.ts`, `packages/db/src/services/import-service.ts`, sync payload builder code  
**Blocked by:** 1, 3, 6  
**Acceptance shape:** integration + schema

## Review Notes

- UI stays split from backend stabilization.
- Backend slices are intentionally ordered from schema to migration to operational flows.
- The UI slice remains HITL because layout and affordance decisions need human review.
- The stock-projection slice is the highest-risk backend slice because it still contains article-centric truth in the live path.
