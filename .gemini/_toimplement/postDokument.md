# Document Module — Implementation Reference

Describes what is implemented. Use this as ground truth when extending the document module.

---

## Document Types & Seed

`packages/domain/src/commands/seed-document-defaults.ts`

Called once per company on creation. Seeds 15 document types, one group each, one number sequence each.

| Code | Name (DE)          | Prefix | Direction | requiresWarehouse |
| ---- | ------------------ | ------ | --------- | ----------------- |
| N    | Angebot            | ANG-   | —         | false             |
| A    | Auftrag            | AUF-   | outbound  | true              |
| L    | Lieferschein       | LIS-   | outbound  | true              |
| R    | Rechnung           | RE-    | outbound  | false             |
| G    | Gutschrift         | GU-    | outbound  | false             |
| b    | Bestellung         | BES-   | inbound   | false             |
| l    | WE-Lieferschein    | WEL-   | inbound   | true              |
| r    | WE-Rechnung        | WER-   | inbound   | false             |
| g    | WE-Gutschrift      | WEG-   | inbound   | false             |
| V    | Inventurbuchung    | INV-   | —         | true              |
| Z    | Zubuchung          | ZUB-   | —         | true              |
| E    | Entnahme           | ENT-   | —         | true              |
| U    | Umlagerung         | UMB-   | —         | true              |
| q    | Produktionsauftrag | PRO-   | inbound   | true              |
| p    | Produktionsbuchung | PRB-   | outbound  | true              |

Groups: one group per type, `group_number = 1` (except system-critical groups which use `group_number = 0` and are protected). Number sequences carry the prefix above.

---

## Posting Command

`packages/domain/src/commands/posting-command.ts`

### Inventory balance maintenance

Every `inventory_balance` upsert keeps `available_qty` current:

```sql
available_qty = on_hand_qty - reserved_qty
```

This is maintained manually on every write — `available_qty` is not a generated column.
Type **b (Bestellung)** also maintains `expected_purchase_qty`.

### Reservation (Type A — Auftrag)

`RESERVATION_TYPES = new Set(["A"])`

When posting type A, each line creates/updates a reservation:

```sql
INSERT INTO inventory_balance (tenant_id, company_id, warehouse_id, article_id,
  on_hand_qty, reserved_qty, available_qty)
VALUES ($1, $2, $3, $4, 0, $qty, -$qty)
ON CONFLICT (tenant_id, warehouse_id, article_id)
DO UPDATE SET
  reserved_qty = inventory_balance.reserved_qty + $qty,
  available_qty = inventory_balance.on_hand_qty
                  - (inventory_balance.reserved_qty + $qty),
  as_of_at = NOW()
```

### Production Posting (Type q, p)

`PRODUCTION_TYPES = new Set(["q", "p"])`

- `line_type = 'production_output'`: Increases `on_hand_qty` (stock in).
- `line_type = 'bom_component'` or `'production_input'`: Decreases `on_hand_qty` (stock out).
- Inserts `inventory_movement` records for each stock-affecting line.

### Storno / Reversal

Extended storno logic in `document-convert-storno.ts`:

| Type                 | Reversal action                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A** (Auftrag)      | Decreases `reserved_qty` in `inventory_balance`.                                                                                                       |
| **L** (Lieferschein) | Returns items to stock via `inventory_movement` (`qty_delta = +qty`); updates `inventory_balance.on_hand_qty`; resets serial status `sold → in_stock`. |
| **R / r**            | Cancels original, creates mirror document (G / g).                                                                                                     |

---

## Delta Corrections

`packages/domain/src/commands/apply-delta-effect.ts`

Allows quantity corrections on posted documents without a full storno.

- Checks if fiscal period is open.
- Inserts `inventory_movement` with signed delta.
- Upserts `inventory_balance`.
- For sales/purchase types, inserts `fact_sales_event` / `fact_purchase_event` with `event_type = 'correction'`.
- Updates `document_line.quantity` and recalculates document totals.

---

## BOM Explosion

`packages/domain/src/commands/explode-bom.ts`

- Expands articles where `bom_type = 'production'` into their components from `article_bom`.
- Only available for **draft** documents.
- Creates new lines with `line_type = 'bom_component'`, inherits warehouse and other settings from the header article line.
- Renumbers all lines to maintain sequence.

---

## System Protection

`packages/domain/src/commands/entity-command-service.ts`

- **X00 Protection**: Guards in `patchEntity`, `deleteEntity`, and `deactivateEntity` prevent modification or deletion of document groups with `group_number = 0`.

---

## UI Architecture

### View layer (thin wrappers)

**`document-detail-view.tsx`**

- `isNew` → renders `<DocumentHeaderForm />`
- existing doc → renders `<DetailPanelAdapter />`

**`DocumentHeaderForm`**

- **Auto-prefill**: Detects selected type/group from `docFilter` (Tree).
- **Auto-layout**: Switch to 3-pane layout (`applyLayout("3")`) on success.
- **Workflow**: Auto-selects new document to trigger immediate line entry.

**`document-lines-view.tsx`**

- Renders `<LinesPanelAdapter />`
- Includes a **"BOM auflösen"** (Explode BOM) button in the toolbar (via `renderExtraActions`) when the document is in `draft` status. Calls `explodeDocumentBomFn`.

### LinesPanelAdapter

`apps/web/src/features/workspace/components/panels/lines-panel-adapter.tsx`

Full-featured lines editor with high-efficiency keyboard workflow.

- **Auto-focus**: First field auto-focused and selected on edit start.
- **Keyboard Chaining**: `Enter` moves focus: `Article -> Qty -> Price -> Discount -> Confirm & New Line`.
- **Search**: `Enter` in article search picks first result if dropdown visible.

**Updated Props**:

```ts
interface LinesPanelAdapterProps {
  panel: LinesPanel;
  ctx: PaneCtx;
  onSave?: (lines: SaveLine[]) => Promise<void>;
  headerWarehouseId?: string;
  renderExtraActions?: () => React.ReactNode; // For custom toolbar buttons
}
```

---

## Technical Implementation Details

- **Transaction Resilience**: Commands in `document-commands.ts` check for `sql.begin` to handle both raw pool and active transaction objects safely.
- **Data Integrity**: Manual SQL operations explicitly include `tenant_id` to satisfy RLS constraints.
- **Lookup Registry**: `document_type` and `app_user` added to `helper_table_registry` for metadata-driven dropdowns.

---

## Server Functions

All in `apps/web/src/server/server-functions.ts`.

| Function                  | Purpose                                        |
| ------------------------- | ---------------------------------------------- |
| `listDocumentsFn`         | Paginated document list with filters.          |
| `listDocumentTreeFn`      | Returns sidebar tree from real DB query.       |
| `updateDocumentFn`        | Updates document header + replaces all lines.  |
| `postDocumentFn`          | Books a document, triggers posting engine.     |
| `stornoDocumentFn`        | Performs reversal logic or creates storno doc. |
| `applyDeltaEffectFn`      | Applies quantity delta to a posted line.       |
| `explodeDocumentBomFn`    | Triggers BOM expansion for a draft document.   |
| `resolveArticlePricingFn` | Resolves price + tax for article/address/date. |

---

## What is NOT yet implemented

- applyDeltaEffect UI trigger (logic and server function exist, button needed in UI)
- Bill of materials: Production orders (prodord) full lifecycle (beyond basic posting support)
- Journal entries / Payment tracking (flagged as out of scope)
