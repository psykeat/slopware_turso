# Document Editor Enhancements (BOM & Tracking)

## 1. BOM Auto-Explosion
- **Trigger**: BOM explosion is triggered immediately upon article selection in the `ArticleSearchCell`.
- **UX**: As soon as an article with a BOM is selected, the system fetches components from `/api/articles/:id/bom` and inserts them as `bom_component` lines.
- **Benefit**: Users see the full structure of the set/production output while still entering the quantity for the header line.

## 2. Tracking Interstitial (Focus Automation)
- **Trigger**: Tabbing or pressing Enter on the last field (`discountPercentage`) of a line that requires serial or batch tracking.
- **Logic**: 
  - The system performs a background commit of the line to ensure a `documentLineId` is assigned.
  - Focus is automatically moved into the `TrackingEditor` input for that specific row.
- **Completion**: Keyboard navigation ("Tab" or "Enter") from the tracking input only advances to a new or next document line once the required quantity (`trackingSum >= lineQty`) has been satisfied.
- **Benefit**: Provides a seamless, keyboard-first flow for tracked articles without manual mouse interaction.

## Implementation Details
- Main logic resides in `packages/ui/components/document-editor.tsx`.
- Tracking UI and input logic resides in `packages/ui/components/tracking-editor.tsx`.

---

## 3. Bank Account Inline CRUD for Addresses

### Problem
Users could select bank accounts from a dropdown in the Address mask, but there was no way to create new ones within that context.

### Solution (Lean Implementation)
Add a "Bank Accounts" section to the Address entity mask using the platform's `InlineEditGrid` pattern in the side panel (`childSection`). 

### UX Flow
1. Open Address Edit mask (**F2**).
2. Use the side panel to add/edit Bank Accounts directly.
3. Once created, the bank accounts are linked to the current `addressId`.

### Implementation Path
- Update `apps/web/src/routes/_auth/app/addresses.tsx` to include the `InlineEditGrid` for the `bankAccount` entity in the `childSection`.
- Configure grid columns for `iban`, `bic`, `bankName`, and `isDefault`.
