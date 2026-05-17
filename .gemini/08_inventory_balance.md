# Feature Slice 08: Inventory Balance & Posting Ledger

**Status: Implemented** (2026-05-16)

## Problem Statement
The current inventory system needs a robust, audit-safe, and consistent way to handle stock movements across the document chain (**Offer -> Order -> Delivery -> Invoice**). Direct CRUD on stock levels is forbidden; all changes must be derived from a controlled domain process (Posting) to prevent double-counting, orphaned reservations, and data drift.

## Solution: The Posting Ledger Strategy
A **command-driven posting service** using an immutable ledger approach combined with a line-level allocation tracker.

### 1. Single Source of Truth: `inventoryMovement`
- Every stock change writes a delta or absolute value to `inventoryMovement`.
- This table is **immutable** (no updates/deletes — reversal writes a new opposing row).
- `inventoryBalance` is a **materialized projection** (cache) of the sum of movements.
- **Rebuild Capability:** The balance can be fully re-derived by summing movements.

### 2. Chain Integrity: `documentLineAllocation`
- Created on every `convertDocument` call, linking source line → target line with `allocatedQty`.
- Cleaned up (deleted) on `deletePostedDocument` so the source document can be re-converted.
- Source document is **archived immediately** on conversion and **un-archived** if the derived document is deleted.

### 3. Storno & Deletion Rules
- **Formal Storno (`R`, `r`, `G`, `g`):** Invoice-family only. Creates a mirror credit note document, posts it immediately, and marks the original as `cancelled`.
- **Direct Deletion (all other types):** `deletePostedDocument` creates reversal movements in the ledger, cleans up allocations, restores the parent document to `draft`, and marks the document `cancelled`. Draft documents are cancelled without any ledger writes.

---

## Schema

### `document_line_allocation` (added)
| Column | Type | Notes |
|---|---|---|
| `allocation_id` | uuid PK | uuidv7 |
| `tenant_id` | uuid FK | tenant isolation |
| `source_document_line_id` | uuid FK → `document_line` | the origin line (e.g. Order line) |
| `target_document_line_id` | uuid FK → `document_line` | the derived line (e.g. Delivery line) |
| `allocated_qty` | numeric | quantity consumed from source |
| `created_at` | timestamptz | |

Unique constraint: `(source_document_line_id, target_document_line_id)`.

### `inventory_balance` / `inventory_movement` — pre-existing, unchanged

---

## Movement Types & Balance Effects

| Type | Label | `onHand` | `reserved` | `expectedPurchase` | Notes |
|---|---|---|---|---|---|
| **A** | Auftrag | — | `+qty` | — | Reservation created |
| **L** | Lieferschein | `−qty` | `−qty` | — | Physical outflow; releases A reservation |
| **R** | Rechnung | `−qty` | — | — | Direct invoice (no prior L); neutral if derived |
| **G** | Gutschrift | `+qty` | — | — | Reversal of invoice reduction |
| **b** | Bestellung | — | — | `+qty` | Expected inbound created |
| **l** | Wareneingang | `+qty` | — | `−qty` (GREATEST 0) | Physical inflow; releases b expectation |
| **V** | Inventur | absolute | — | — | Sets onHand to fixed value |
| **U** | Umbuchung | `−qty` src / `+qty` tgt | — | — | Warehouse transfer (2 movements) |
| **r** | Eingangsrechnung | `+qty` | — | — | Vendor invoice receipt; AVCO updated |
| **g** | Eingangsgutschrift | `−qty` | — | — | Vendor credit note |
| **Z** | Zugang | `+qty` | — | — | Manual adjustment in |
| **E** | Entnahme | `−qty` | — | — | Manual adjustment out |

---

## Domain Service (`packages/db/src/services/document-service.ts`)

### `postDocument(documentId, userId, tenantId)`
- Acquires a `FOR UPDATE` row lock on the document to prevent concurrent double-posting.
- Guards: status must be `"draft"`.
- Writes `inventoryMovement` row(s) per line, then upserts `inventoryBalance`.
- For `r`: also computes AVCO and writes `factPurchaseEvent`.
- For `R` / `L`: writes `factSalesEvent`.
- Emits `pg_notify('stats_refresh', tenantId)`.
- Sets status → `"posted"`.

### `convertDocument(documentId, userId, tenantId, targetGroupId)`
- Guards: source status must be `"draft"`.
- Copies all lines to a new document of the target type.
- Inserts `documentLineAllocation` rows linking source lines → target lines.
- Archives the source document (status → `"archived"`).
- Returns `{ newDocumentId }`.

### `getConversionCandidates(documentId, tenantId)`
- Resolves the next document group(s) in the chain.
- Returns `{ mode: "direct", targetGroupId }` or `{ mode: "select", candidates[] }`.

### `deletePostedDocument(documentId, tenantId)`
- Guards: rejects `R` and `r` (must use storno); rejects already-cancelled.
- **Draft:** sets status → `"cancelled"` with no ledger writes.
- **Posted:** for each existing movement, writes a new reversal movement with negated `qtyDelta`; applies type-aware reverse balance update (see table above for `l` which also restores `expectedPurchaseQty`).
- Deletes `documentLineAllocation` rows targeting this document's lines.
- Un-archives parent document (if `parentDocumentId` points to an `"archived"` doc → reset to `"draft"`).
- Emits `pg_notify('stats_refresh', tenantId)`.

### `stornoDocument(documentId, userId, tenantId)`
- Guards: status must be `"posted"`; type must be in `["R", "r", "G", "g"]`.
- Creates a mirror document with reversed type (`R→G`, `r→g`, etc.) and immediately posts it.
- Sets original document status → `"cancelled"`.
- Returns `{ stornoDocumentId }`.

---

## API Routes (`apps/web/src/routes/api/documents/$documentId/`)

| File | Method | Calls |
|---|---|---|
| `post.ts` | POST | `svc.postDocument()` |
| `storno.ts` | POST | `svc.stornoDocument()` |
| `convert.ts` | POST | `svc.convertDocument()` or `getConversionCandidates()` |
| `delete.ts` | POST | `svc.deletePostedDocument()` |
| `delta.ts` | POST | `svc.applyDeltaEffect()` (line-level correction on posted docs) |

---

## UI (`packages/ui/components/document-editor.tsx`)

Action buttons in the footer, gated by document status and type:

| Button | Visible when | Action |
|---|---|---|
| Buchen | `status === "draft"` | POST `.../post` |
| Umwandeln | `status === "draft"` | POST `.../convert` |
| Stornieren | `status === "posted"` AND type in `R/r/G/g` | POST `.../storno` |
| Löschen | not cancelled/archived AND not posted invoice | POST `.../delete` (with confirm dialog) |

Line rows: delete icon when draft; "Korrektur" delta input when posted.

---

## Out of Scope
- Financial GL posting (`journalEntry`) is triggered by `postDocument` but implemented separately.
- Batch/serial tracking validation — Feature Slice 09.
- Partial deliveries (one A → multiple L) — requires relaxing the archive-on-convert constraint; deferred.
