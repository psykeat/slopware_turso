# Variant-Centric Commerce Stabilization PRD

## Problem Statement

The current commerce implementation is in an inconsistent transition state between an article-centric operational model and the planned variant-centric model.

The intended target model is clear:
- `article` remains the parent/catalog container.
- `article_variant` is the sellable unit for price, stock, and document lines.
- `inventory_item` is the operational stock booking anchor.
- `inventory_level.quantity` is the projected stock value by warehouse or location.
- `document_line` references the sold variant for catalog lines.

The codebase now contains strong pieces of the target model, but the operational paths are still mixed:
- `price_list_item` still carries legacy article coupling alongside variant fields.
- `inventory_balance` remains article-centric and is still used as the stock projection anchor.
- `document_service` still contains article-to-variant casts and other legacy compatibility paths.
- `fact_sales_event` stores both article and variant references, which is acceptable only as a transition state.

This creates a product risk:
- pricing can diverge from variant truth,
- inventory can become inconsistent across warehouse projections,
- document posting can compute against the wrong granularity,
- reporting can remain article-centric when downstream consumers expect variant truth,
- and the implementation becomes difficult to reason about because it is neither fully legacy nor fully migrated.

The goal of this PRD is to formalize the recovery path so the commerce model becomes stable, coherent, and testable without losing the parent/catalog role of `article`.

## Solution

We will complete the transition to a variant-centric operational model while preserving article-level navigation and aggregation where it remains useful.

The solution has six parts:

1. **Lock the domain model**
   - Keep `article` as the parent/catalog object.
   - Treat `article_variant` as the operative unit for pricing, inventory, and document lines.
   - Treat `inventory_item` as the booking anchor and `inventory_level` as the location projection.

2. **Stabilize the schema**
   - Ensure variant entities are first-class and indexed for lookup, uniqueness, and helper-registry usage.
   - Remove or quarantine article-centric operational truth where it conflicts with variant truth.
   - Keep legacy article fields only where they are explicitly transitional or analytical.

3. **Finish the migration path**
   - Default variant backfill for articles without variants.
   - Variant generator for option axes and combinations.
   - Controlled compatibility for legacy rows during migration.
   - No silent dual-truth behavior after cutover.

4. **Make operational flows variant-aware**
   - Price resolution must resolve against the variant.
   - Posting and inventory updates must book against `inventory_item` and `variantId`.
   - Document line creation and validation must enforce variant selection for catalog lines.

5. **Keep article-level UX where it still helps**
   - Articles remain the primary navigation and parent grouping surface.
   - TriView and Inspector patterns may continue to navigate by article.
   - Lists and summaries may still aggregate by article, but not as the source of operational truth.

6. **Publish the model**
   - Update glossary terms in `CONTEXT.md`.
   - Preserve the architectural decision in ADR form.
   - Keep the migration visible to engineers so future work does not reintroduce article-centric assumptions.

## User Stories

- As a product owner, I want the commerce model to be explicit about which entity is operational truth so that future work does not accidentally reintroduce article-centric stock or pricing logic.
- As a merchandiser, I want to manage articles as parent catalogs and variants as sellable items so that price and stock are correct per SKU.
- As a user, I want variant-specific pricing so that the selected sellable unit always resolves to the correct price.
- As a user, I want document lines to require a variant for catalog items so that posted documents match the actual sold unit.
- As a user, I want inventory to be booked against the sellable variant so that stock and reservation numbers are accurate.
- As a user, I want inventory projected per warehouse or location so that availability reflects the real operating context.
- As a user, I want article-level browsing to remain available so that I can navigate the catalog without losing the parent grouping model.
- As a user, I want article aggregations in search and reporting so that I can still analyze the catalog as a whole.
- As a user, I want the system to create a default variant when an article has no explicit variant axes so that operational flows still have a sellable unit.
- As a user, I want bulk variant actions such as archive, activation, and price updates so that I can manage large assortments efficiently.
- As an administrator, I want sync mappings to support variant entities directly so that external commerce platforms can be synchronized without ambiguity.
- As an administrator, I want helper-registry lookups to show SKU and option summaries instead of UUIDs so that variant selection is usable in the UI.
- As a support user, I want clear legacy/transitional behavior during migration so that I can identify which parts of the system are still article-centric.
- As a reporter, I want facts to retain variant references so that downstream analytics can roll up by variant and article when needed.

## Implementation Decisions

- `article` stays as the parent/catalog entity and should not be deleted from the commerce model.
- `article_variant` is the sellable unit and must remain unique per article and option combination.
- `inventory_item` is the stock booking anchor; `inventory_level` stores location-specific stock projection.
- `document_line` requires `variantId` for catalog lines.
- `price_list_item` should be variant-first and should not rely on article as the operative pricing key.
- `fact_sales_event` may keep `articleId` during transition, but `variantId` must become the primary operational reference.
- `external_sync_mapping` must support variant entities as first-class sync targets.
- The UI may still navigate by article, but all selection, pricing, and stock actions must resolve to variant truth behind the scenes.
- Compatibility code is allowed only as an explicit migration bridge, not as a permanent second truth.

## Testing Decisions

- Verify that articles without variants receive exactly one default variant and one inventory item.
- Verify that variant generation is idempotent and safe under concurrent calls.
- Verify that document lines of type `article` fail validation when `variantId` is missing.
- Verify that price resolution returns variant-specific price data and does not depend on article as the operational price source.
- Verify that inventory posting writes to `inventory_item` / `variantId` paths and does not create article-only stock truth.
- Verify that reporting events preserve variant references and can still be aggregated at article level.
- Verify that lookup metadata presents SKU and option summaries for variant selection.
- Verify that migration and legacy compatibility paths do not produce duplicate variants, duplicate stock anchors, or conflicting pricing rows.

## Out of Scope

- A full rewrite of the entire commerce subsystem.
- Replacing the existing article navigation model in the UI.
- Changing unrelated platform contracts such as tenant isolation, command handling, or the generic entity-first architecture.
- Removing all article-level reporting immediately.
- Reworking non-commerce modules that are not part of pricing, stock, document lines, or sync mapping.
- Designing new external commerce connectors beyond the stabilization of the existing sync mapping foundation.
- Making every legacy path disappear in a single step.

