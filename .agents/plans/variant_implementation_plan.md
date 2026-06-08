# Variant Model Implementation Plan

Based on our `/grill-me` session, we have agreed on the following strict E-Commerce variant model.

## 1. Data Model Changes (`packages/db/src/schema/app.schema.ts`)

- **`inventory_item`**: Make `variantId` `NOT NULL`. Remove `articleId`.
- **`inventory_level`**: Create a new table mapping `inventory_item_id` and `warehouse_id` to stock levels (`on_hand_qty`, `reserved_qty`, `available_qty`, `incoming_qty`).
- **`price_list_item`**: Make `variantId` `NOT NULL` (except potentially for custom non-catalog lines, though schema-wise we will enforce `variantId` for catalog products). We might keep it nullable if custom lines exist, but enforce it at the application layer, or add a constraint that standard items must have `variantId`.
- **`document_line`**: Same as `price_list_item`—require `variantId` for catalog lines.

## 2. Default Variant Strategy

- A system-generated **"Default" variant** will be automatically created for any `article` that lacks explicit axes.
- This ensures all operational records (`inventory_item`, `price_list_item`, `document_line`) can strictly reference a `variant_id` without relying on `article_id`.

## 3. Variant Generator RPC

- Build a server-side **RPC command** (`generateVariants`) that takes an `articleId` and `axes`, computes the cartesian product, filters out existing `option_value_hash` combinations, and incrementally creates missing `article_variant` and `inventory_item` records.

## 4. Execution Strategy

1. **Schema Update**: Update `app.schema.ts` to reflect the strict model.
2. **Backfill Migration**: Write a manual SQL script to generate default `article_variant` rows for existing `article` records, and update existing operational rows to point to these new variants.
3. **Generate Migrations**: Run `drizzle-kit generate` to capture the schema changes.
4. **Implement Service Logic**: Add the generator RPC and update existing hooks.
