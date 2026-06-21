# Plan: Fix UI Persistence and Data Loss in TriView Modules

The user reports that related data (contacts, delivery addresses, documents, articles, inventory movements, etc.) flashes briefly during scrolling and disappears when switching tabs in the lower frame of the grid view. This issue affects the Addresses, Articles, and Documents modules.

## Analysis

The issue is caused by **selection theft** and **circular dependencies** in the focus management:

1.  **Global Focus Conflict:** The `DataGrid` component automatically updates the global `focusState.recordId` on mount and on row selection.
2.  **Sub-grid Mounting:** When a user switches tabs in the `ContextTabs` (e.g., from "Details" to "Contacts"), a new `DataGrid` for the sub-entity is mounted. This sub-grid immediately takes focus and updates the global `focusState.recordId` to the ID of its first row (e.g., a contact ID).
3.  **Parent Data Corruption:** The parent modules (`AddressesModule`, etc.) use the global `focusState.recordId` as the primary key for their dependent data queries (e.g., `contacts` query for the selected address). When the focus moves to a contact, the query tries to fetch "contacts for contact ID X", which returns no data, causing the UI to clear.
4.  **UI Flashing:** Frequent focus updates during arrow-key scrolling cause the queries to re-fetch. Without a stability mechanism, the UI clears while waiting for the new data.

## Proposed Strategy

### 1. Pin Primary Entity ID in Modules

In `addresses.tsx`, `articles.tsx`, and `documents.tsx`, I will introduce a pinned "Active ID" state that only tracks the ID of the primary entity (e.g., `addressId`). This state will be used for all dependent queries and computed values in the lower frame.

### 2. Update Queries to Use Pinned ID

All `useQuery` hooks and dependent logic (like `selectedAddress`) will be updated to use the pinned ID instead of the volatile global `focusState.recordId`.

### 3. Implement Data Stability (Anti-Flash)

I will add `placeholderData: keepPreviousData` to the dependent queries. This ensures that while scrolling or switching records, the previous data remains visible until the new data is loaded, preventing the "flashing" effect.

## Affected Files:

- `apps/web/src/routes/_auth/app/addresses.tsx`
- `apps/web/src/routes/_auth/app/articles.tsx`
- `apps/web/src/routes/_auth/app/documents.tsx`

## Detailed Implementation Steps

### Addresses Module

1.  Import `keepPreviousData` from `@tanstack/react-query`.
2.  Add `activeAddressId` state and `useEffect` to track the last address ID.
3.  Update `addressStats`, `contacts`, and `deliveryAddresses` queries to use `activeAddressId` and `keepPreviousData`.
4.  Update `selectedAddress` computed value to use `activeAddressId`.
5.  Update `InspectorPanel` to use `activeAddressId`.

### Articles Module

1.  Import `keepPreviousData` from `@tanstack/react-query`.
2.  Add `activeArticleId` state and `useEffect` to track the last article ID.
3.  Update `movements` and `articleStats` queries to use `activeArticleId` and `keepPreviousData`.
4.  Update `selectedArticle` computed value to use `activeArticleId`.
5.  Update `InspectorPanel`, `StockLedgerTable`, etc., to use `activeArticleId`.

### Documents Module

1.  Import `keepPreviousData` from `@tanstack/react-query`.
2.  Add `activeDocumentId` state and `useEffect` to track the last document ID.
3.  Update `lines` query to use `activeDocumentId` and `keepPreviousData`.
4.  Update `selectedDocument` computed value to use `activeDocumentId`.
5.  Update `InspectorPanel` to use `activeDocumentId`.

## Verification Plan

### Manual Verification:

1.  **Addresses Module:**
    - Open Addresses.
    - Click an address, verify "Details" tab shows data.
    - Switch to "Contacts" tab. Verify data is visible.
    - Use arrow keys to scroll through the main grid. Verify the contacts list updates smoothly without disappearing.
    - Switch between "Contacts" and "Delivery Addresses". Verify data persists.
2.  **Articles Module:**
    - Repeat similar steps for Articles, verifying Inventory and Statistics tabs.
3.  **Documents Module:**
    - Repeat similar steps for Documents, verifying Document Lines tab.

### Automated Verification:

- Run `pnpm lint` to ensure no regressions in type safety or hooks rules.
