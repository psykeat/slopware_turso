# Article Group Defaults and Unit Foreign Keys Implementation Plan

## Objective
Enhance the `articleGroup` and `article` schemas to simplify article creation. When a new article is created and an `articleGroupId` is selected, fields such as `taxClassId`, `baseUnitId`, `salesUnitId`, `purchaseUnitId`, `trackingMode`, and `bomType` will automatically pre-fill based on the selected group. Additionally, the unit fields on the `article` entity will be upgraded from plain text to proper UUID foreign keys referencing the `unit` table, ensuring the generic UI automatically renders them as standard dropdowns.

## Key Files & Context
- `packages/db/src/schema/app.schema.ts`: Database schema definitions for `articleGroup` and `article`.
- `packages/ui/components/entity-mask.tsx`: Generic CRUD mask that requires an extension to expose an `onFieldChange` callback.
- `apps/web/src/routes/_auth/app/articles.tsx`: The Article CRUD entity where the auto-fill logic will be implemented.
- `packages/db/src/services/` & `packages/db/src/scripts/seed.ts`: Various services and seed scripts that currently reference the text-based `baseUnit`.

## Proposed Solution
1.  **Schema Migration**: Add default fields (`taxClassId`, `baseUnitId`, `salesUnitId`, `purchaseUnitId`, `trackingMode`, `bomType`) to `articleGroup`. Migrate `baseUnit`, `salesUnit`, and `purchaseUnit` in `article` from `text` to `uuid` foreign keys pointing to `unit.unitId` (renaming them to `baseUnitId`, `salesUnitId`, `purchaseUnitId`).
2.  **EntityMask Reactivity**: Introduce an optional `onFieldChange` callback to `EntityMaskProps` so parent components can intercept user input and mutate the internal `formData`.
3.  **ArticlesModule Logic**: Utilize the new `onFieldChange` callback inside the `articles.tsx` creation mask. When `articleGroupId` is selected, fetch the associated group data and populate the form's unit, tracking, and BOM fields.

## Implementation Steps

### Phase 1: Database Schema & Type Migration
1.  Modify `packages/db/src/schema/app.schema.ts`:
    *   In `articleGroup`: Add `taxClassId`, `baseUnitId`, `salesUnitId`, `purchaseUnitId`, `trackingMode`, and `bomType`.
    *   In `article`: Rename `baseUnit`, `salesUnit`, `purchaseUnit` to `baseUnitId`, `salesUnitId`, `purchaseUnitId` and change their type to `uuid` with `.references(() => unit.unitId)`.
2.  Refactor usages of `baseUnit` across the repository (e.g., in `document-service.ts`, `import-service.ts`, `seed.ts`, `bom-editor.tsx`, `articles.tsx`, etc.) to align with the new `baseUnitId` foreign key.

### Phase 2: Generic Form Enhancements
1.  Update `packages/ui/components/entity-mask.tsx`:
    *   Add `onFieldChange?: (key: string, value: any, formData: Record<string, any>, setFormData: React.Dispatch<React.SetStateAction<Record<string, any>>>) => void` to `EntityMaskProps`.
    *   In the internal `handleChange` function, invoke `onFieldChange` immediately after calculating the new state so the parent can perform side effects (like fetching and applying defaults).

### Phase 3: Article UI Auto-fill Logic
1.  Update `apps/web/src/routes/_auth/app/articles.tsx`:
    *   In the `<EntityMask mode="create">` instance, implement `onFieldChange`.
    *   If `key === "articleGroupId"`, fetch the group using `/api/data/articleGroup/${value}`.
    *   Use `setFormData` to apply `taxClassId`, `baseUnitId`, `salesUnitId`, `purchaseUnitId`, `trackingMode`, and `bomType` if they are not already manually set by the user.
    *   Ensure data grid columns map `baseUnitId` appropriately or rely on generic display columns.

## Migration & Rollback
*   **Migration**: The schema change transforms `text` columns to `uuid`. A custom Drizzle migration or SQL script must be provided to map existing text units (like "pcs") to their corresponding `unitId` from the `unit` table.
*   **Rollback**: The standard Drizzle down-migration strategy applies, reverting `uuid` columns back to `text` and dropping the newly added columns on `articleGroup`.

## Verification & Testing
*   Verify that `pnpm db generate` and `pnpm lint` succeed after renaming the unit columns.
*   Verify the Drizzle migration correctly updates existing articles by linking their string units to the UUID.
*   In the UI, test creating a new Article. Verify that selecting an Article Group triggers an API call and correctly fills the dropdowns (Unit, Tracking, BOM, Tax).
*   Verify that the Unit fields now render correctly as generic Lookups/Dropdowns without requiring manual `type: "select"` overrides.

# Address Category Extension and Schema Cleanup Implementation Plan

## Objective
Extend the `addressCategory` schema with `taxClassId`, `paymentTermId`, and `currencyId` to enable automatic pre-filling of these values when a category is selected in the Address UI. Additionally, remove the redundant `addressType` column from the `address` schema and perform a global cleanup of its references.

## Key Files & Context
- `packages/db/src/schema/app.schema.ts`: Schema for `addressCategory` and `address`.
- `packages/ui/components/entity-mask.tsx`: Generic mask component where reactivity for field changes will be added.
- `apps/web/src/routes/_auth/app/addresses.tsx`: Address CRUD where pre-fill logic will be implemented.
- `packages/db/src/services/import-service.ts` & `packages/db/src/scripts/seed.ts`: Files containing logic/data that references `addressType`.

## Proposed Solution
1.  **Schema Migration**: Add `taxClassId`, `paymentTermId`, and `currencyId` to `addressCategory`. Remove `addressType` from `address` and drop its index.
2.  **EntityMask Callback**: Extend `EntityMask` with an `onFieldChange` (or `onChangeHook`) callback to allow side-effects when form values change.
3.  **Address UI Integration**: Implement the pre-fill logic in `addresses.tsx`. When `addressCategoryId` is changed, fetch the category defaults and update the form fields if they are currently empty.

## Implementation Steps

### Phase 1: Database Schema Updates
1.  Modify `packages/db/src/schema/app.schema.ts`:
    *   In `addressCategory`: Add `taxClassId` (FK), `paymentTermId` (FK), and `currencyId` (char 3).
    *   In `address`: Remove the `addressType` field and its corresponding index `idx_address_type`.
2.  Generate and apply the migration: `pnpm db generate && pnpm db migrate`.

### Phase 2: Code Cleanup
1.  Remove all references to `addressType` in:
    *   `packages/db/src/scripts/seed.ts`: Sample address objects.
    *   `packages/db/src/services/import-service.ts`: Address insertion/upsert logic.
    *   `packages/db/src/services/tenant.ts`: Base tenant creation.
    *   `apps/web/src/routes/_auth/app/addresses.tsx`: DataGrid columns and InspectorPanel fields.

### Phase 3: Generic UI Enhancement
1.  Update `packages/ui/components/entity-mask.tsx`:
    *   Add `onFieldChange` to `EntityMaskProps`.
    *   Call it within `handleChange` to pass the new value and a state updater to the parent.

### Phase 4: Address Prefill Logic
1.  Update `apps/web/src/routes/_auth/app/addresses.tsx`:
    *   Pass the `onFieldChange` hook to `EntityMask`.
    *   If `key === "addressCategoryId"`, fetch the category details and apply `taxClassId`, `paymentTermId`, and `currencyId` to the form state if those fields are currently empty (or always if it's a new record).

## Verification & Testing
*   Verify `pnpm db generate` and `pnpm lint` pass.
*   Verify in the UI that selecting an Address Category correctly populates Tax Class, Payment Terms, and Currency.
*   Verify that `addressType` is no longer visible in the Address grid or details panel.

# Remove bankAccountId from Address Entity

## Objective
Remove the deprecated `bankAccountId` field from the `address` table, as bank accounts are now handled via a separate `bank_account` table with a one-to-many relationship.

## Key Files & Context
- `packages/db/src/schema/app.schema.ts`: Contains the schema definition for the `address` table.

## Implementation Steps
1. **Schema Update:** Open `packages/db/src/schema/app.schema.ts` and remove the `bankAccountId: uuid("bank_account_id"),` line from the `address` table definition.
2. **Generate Migration:** Run `pnpm db generate --name remove_address_bank_account_id` to generate the SQL migration file.
3. **Apply Migration:** Run `pnpm db migrate` to apply the changes to the local development database.

## Verification & Testing
- Run `pnpm lint` and ensure there are no TypeScript errors, confirming the field is not accessed anywhere in the codebase.
- Verify the `bank_account_id` column is successfully dropped from the `address` table in the database.

# Plan: EntityMask Compact Redesign

**Objective:**
Redesign the `EntityMask` generic CRUD component to adopt the tight, compact layout and styling of the `AddressPickerField`'s manual editing block, replacing the large inputs, wide gaps, thick padding, and heavy shadows with a minimal, "hairline-input" border styling.

**Key Files & Context:**
- `packages/ui/components/entity-mask.tsx`

**Implementation Steps:**

1. **Update `inputBase` classes:**
   - Change `h-9` to `h-7`.
   - Change `rounded-md` to `rounded`.
   - Change `px-3` to `px-2.5`.
   - Change `text-[13px]` to `text-[12px]`.

2. **Update Grid and Gap Spacing:**
   - Change the fields wrapper gap from `flex-col gap-6` to `flex-col gap-2`.
   - Change the grid gap from `gap-x-6 gap-y-5` to `gap-1.5`.
   - Change the individual field stack from `gap-1.5` to `gap-0.5` or `gap-1`.

3. **Update Default and Loading Container Styles:**
   - Replace `rounded-xl border border-hairline bg-canvas p-6 shadow-lg` with `w-full rounded border px-3 py-2 text-left text-[12px] transition-colors border-hairline-input bg-canvas`.
   - For the standalone default return, retain `mx-auto my-8 max-w-2xl` for overall page placement but apply the new border/padding.

4. **Adjust Titles and Footer:**
   - Change main title `text-[18px]` to `text-[14px]`.
   - Change hint texts from `text-[13px]` to `text-[11px]`.
   - Adjust the footer spacing from `mt-6 pt-5` to a more compact `mt-2 pt-2`.
   - Reduce button sizes from `h-7 px-4 text-[13px]` to `h-6 px-3 text-[11px]` to match the new compact form.

**Verification & Testing:**
- Launch the application and navigate to any page that renders an `EntityMask` (e.g., creating a new article, adding an address).
- Verify the container has a thin border, no heavy shadow, and tight padding.
- Verify the inputs are `h-7` and tightly packed (`gap-1.5`).
- Ensure no layout breaks occur when rendered within an embedded or inline context.
# Tree Navigation Enhancement

## Objective
Add keyboard navigation (Ctrl+Up/Down) to the trees in the articles and addresses table views, mirroring the existing behavior in documents and settings. Additionally, add a top-level "All" item to these trees to allow selecting all articles/addresses, and remove non-compliant ad hoc keydown handlers from `NavigationTree`.

## Key Files & Context
- `apps/web/src/routes/_auth/app/articles.tsx`: Handles article groups and tree rendering.
- `apps/web/src/routes/_auth/app/addresses.tsx`: Handles address categories and tree rendering.
- `packages/ui/components/navigation-tree.tsx`: The shared tree component implementation.

## Implementation Steps
1.  **Remove ad hoc keyboard handler**: In `packages/ui/components/navigation-tree.tsx`, remove the `useEffect` that attaches a `keydown` listener to the `window`. This complies with the project rule: "All keyboard shortcuts go through `CommandProvider`. No ad hoc `keydown` business logic."
2.  **Add "All" option and commands to Articles**:
    -   In `articles.tsx`, derive a `treeNodes` array by prepending `{ id: "ALL", label: t("tree.all") }` to the `groups` array.
    -   Pass `treeNodes` to `NavigationTree` instead of `groups`.
    -   In the `onSelect` handler, map `"ALL"` to `null` for `selectedGroupId`.
    -   Register `Ctrl+ArrowDown` and `Ctrl+ArrowUp` commands within `ArticlesModule` using `registerCommand` (from `useCommands`), calculating the next/previous node in `treeNodes` and updating `selectedGroupId` and `subCrumb` accordingly.
3.  **Add "All" option and commands to Addresses**:
    -   In `addresses.tsx`, apply the exact same pattern: prepend `{ id: "ALL", label: t("tree.all") }` to `categories`, creating a `treeNodes` array.
    -   Update `NavigationTree` to use `treeNodes`.
    -   In the `onSelect` handler, map `"ALL"` to `null` for `selectedCategoryId`.
    -   Register `Ctrl+ArrowDown` and `Ctrl+ArrowUp` commands within `useAddressCommands` (or `AddressesModule`) to navigate through `treeNodes`.

## Verification & Testing
-   Open the Articles module and verify that an "All" node appears at the top of the tree.
-   Select the "All" node and verify that the grid shows all articles.
-   Use `Ctrl+ArrowDown` and `Ctrl+ArrowUp` in the Articles module and verify that the tree selection and grid change accordingly.
-   Repeat the same verification steps for the Addresses module.
-   Ensure no other global keyboard shortcuts are broken.
-   Run `pnpm lint` to validate changes.
