# Article Variants - Domain, UI, and Implementation Contract

This document captures the agreed article/variant model for the existing article CRUD and the follow-up implementation order.

## Purpose

The product must support a simple article entry flow for the common case while keeping the underlying sales model strictly variant-based.

## Domain Rules

- `Article` is the parent/catalog entity only.
- Every bookable article has at least one `Article variant`.
- If no explicit variant axes exist, exactly one `Default variant` exists.
- `Variant mode` is derived from data, not stored as a separate flag on `article`.
- The default variant is not a special exception in booking logic. It is the normal sellable row for a simple article.

## UI Rules

- The existing article CRUD remains the primary entry point.
- The left side of the article editor keeps the normal article form.
- A visible `Sales` block belongs on the left side of the form.
- The `Sales` block contains only:
  - price
  - EAN
  - weight
  - bookable status
  - tracking
- Stock is not edited in the sales block. It stays in the context area on the right.
- The right side keeps separate contextual tabs:
  - Langtexte
  - Bestand
  - Bilder
  - Varianten
- `Varianten` is its own tab.
- The `Varianten` tab is always present, but in the simple case it only shows a short explanation and a CTA to activate variants.
- `Variant mode` is activated explicitly by the user.
- When variants are activated, the existing default variant stays in place and becomes the first editable variant row.

## Data Contract

### Default variant creation

- A database-level mechanism must ensure that a bookable article gets a default variant.
- The mechanism may use an `AFTER INSERT` trigger on `article` or an equivalent server-side write-path guarantee.
- The mechanism must be idempotent.
- The mechanism must not depend on article name changes.

### Fields that are auto-derived or system-set

- `tenantId`
- `articleId`
- `isDefault`
- `isActive`
- `optionValueHash`
- `sku`

### Fields that are user-managed on the default variant

- `price`
- `ean`
- `weight`
- tracking-related settings if they are variant-specific in the final schema

### Fields that stay on `article`

- article number
- article name
- article texts and long texts
- descriptions
- category/group assignment
- media anchor data that is catalog-wide

### Fields that stay contextual / derived

- stock quantities
- stock movements
- balances
- reporting projections

## Implementation Order

1. Harden the data contract.
   - Ensure a default variant exists for every bookable article.
   - Backfill existing articles to the new model.
   - Keep `Variant mode` derived from persisted data only.

2. Align the write path.
   - Make the sales block write to the default variant.
   - Keep SKU stable across article name changes.
   - Keep stock out of the article master form.

3. Integrate the UI into the existing article CRUD.
   - Add the sales block to the left side of the current `EntityMask`.
   - Keep the right-side contextual tabs intact.
   - Surface `Varianten` as a dedicated tab with an activation CTA.

4. Keep the transition non-destructive.
   - Activating variants must preserve the default variant.
   - The default variant remains the first editable row.
   - No additional `article` flag should be introduced.

## Non-Goals

- Do not create a second editing model for simple articles.
- Do not force users into a variant drawer for the normal case.
- Do not store duplicate parent and variant truth for price, weight, or EAN.
- Do not make stock editable in the article sales block.

## Current Risk

The existing codebase already contains partial variant infrastructure, but the article CRUD still assumes a mixed model in some places. The implementation must avoid introducing a second truth source while the UI and write path are being aligned.

## File-by-File Implementation Checklist

### `packages/db/src/schema/app.schema.ts`

- Verify the final `article_variant` shape includes the fields needed for the default variant contract.
- Keep `isDefault` as a first-class semantic field.
- Make sure the unique constraints still support one default variant per simple article and one variant row per combination.
- Keep `price_list_item`, `document_line`, and inventory-facing tables variant-centric.

### Database migration / trigger layer

- Add the default-variant guarantee at the database level or the nearest equivalent server-side write-path guarantee.
- Make the rule idempotent.
- Make sure article name changes do not affect SKU generation.
- Ensure the backfill and trigger logic agree on the same default hash and default SKU strategy.

### `packages/db/src/services/default-variant-backfill.ts`

- Keep this as the repair/backfill path for existing data.
- Ensure it remains idempotent.
- Ensure it can be used independently of the UI.
- Use it to normalize legacy articles that lack a default variant.

### `packages/ui/components/entity-mask.tsx`

- Add a native `Sales` block to the form layout instead of a separate ad hoc editor.
- Keep the block part of the normal article entry flow.
- Wire the block so it reads and writes the default variant values.
- Keep stock out of this block.
- Preserve the generic mask behavior for other entities.

### `apps/web/src/routes/_auth/app/articles.tsx`

- Keep the existing article CRUD as the main workspace.
- Make the left-side form show the `Sales` block.
- Keep right-side tabs for `Langtexte`, `Bestand`, `Bilder`, and `Varianten`.
- Make `Varianten` visible as its own tab in all cases.
- In the empty/simple case, show a CTA to activate variants.
- When variants are active, keep the default variant as the first editable row.

### `packages/ui/components/article-image-strip.tsx`

- No structural change is required for the variant model itself.
- Only revisit this file if variant-specific media needs to be surfaced later.

### `packages/db/src/services/document-service.ts`

- Verify posting resolves truth from `variantId` only.
- Remove any remaining assumptions that a bookable article can be posted without a variant.
- Keep the default variant as the fallback for simple articles.

### Tests

- Add or extend tests so a simple bookable article gets exactly one default variant.
- Add or extend tests so the sales block values end up on the default variant.
- Add or extend tests so the article name can change without changing SKU.
- Add or extend tests so the variant mode remains derived from data.

## Recommended Patch Order

1. `packages/db/src/schema/app.schema.ts`
   - Lock the final variant semantics in the schema first.
   - Confirm the default-variant fields and constraints are aligned with the intended model.

2. Database migration / trigger layer
   - Add or adapt the default-variant guarantee.
   - Make the guarantee idempotent before touching the UI.

3. `packages/db/src/services/default-variant-backfill.ts`
   - Keep legacy data compatible with the new contract.
   - Make sure the backfill and trigger agree on the same defaults.

4. `packages/db/src/services/document-service.ts`
   - Remove any remaining non-variant posting assumptions.
   - Verify that posting always resolves a variant for catalog lines.

5. `packages/ui/components/entity-mask.tsx`
   - Add the native `Sales` block to the shared form system.
   - Keep it generic enough to avoid a one-off article-only fork.

6. `apps/web/src/routes/_auth/app/articles.tsx`
   - Wire the article CRUD to the new sales block and the `Varianten` tab behavior.
   - Keep the existing right-side context structure intact.

7. Tests
   - Cover the trigger/backfill path, the sales-block write path, and the stable SKU behavior.
   - Add tests for the derived variant-mode rule if there is any ambiguity left in the code.
