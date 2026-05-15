# Document Module — Implementation Backlog

Cross-referenced against `agents/documents_line_current.md` and current source.
Items marked ✅ in postDokument.md were already implemented — this file lists only genuine gaps.

---

## Status Correction (postDokument.md was stale)

Already implemented, not needed:

- Posting engine (L, b, l, V, Z, E, U, R, G, r, g, A) — `posting-command.ts` lines 227–565
- Reservation type A — lines 544–564
- Serial/batch tracking — lines 165–211, 697–804
- fact_sales_event / fact_purchase_event — lines 567–694
- listDocumentTreeFn — real DB query, not mock (`server-functions.ts:584`)

---

## P0 — Seed Data Fix (30 min)

**Problem**: `seed-document-defaults.ts` inserts wrong names and prefixes (N="Lieferschein" instead of "Angebot", etc.).

**File**: `packages/domain/src/commands/seed-document-defaults.ts`

Fix the name/prefix table to match the PRD:

| Code | Name            | Prefix |
| ---- | --------------- | ------ |
| N    | Angebot         | ANG-   |
| A    | Auftrag         | AUF-   |
| L    | Lieferschein    | LIS-   |
| R    | Rechnung        | RE-    |
| G    | Gutschrift      | GU-    |
| b    | Bestellung      | BES-   |
| l    | WE-Lieferschein | WEL-   |
| r    | WE-Rechnung     | WER-   |
| g    | WE-Gutschrift   | WEG-   |
| V    | Inventurbuchung | INV-   |
| Z    | Zubuchung       | ZUB-   |
| E    | Entnahme        | ENT-   |
| U    | Umlagerung      | UMB-   |

**Note**: Existing company data will have wrong document_no prefixes. This only fixes new companies.

---

## P0 — available_qty missing for type "b" (10 min)

**File**: `packages/domain/src/commands/posting-command.ts` lines 311–321

Type "b" (Bestellung) upserts `expected_purchase_qty` but omits `available_qty`.

Fix: add `available_qty = inventory_balance.on_hand_qty - inventory_balance.reserved_qty` to the ON CONFLICT clause.

---

## P1 — Broader Storno: reverse A and L (2–3 h)

**File**: `packages/domain/src/commands/document-convert-storno.ts`

`stornoDocument()` currently guards to R/r only. Extend to:

| Type                     | Reversal action                                                                                                                                      |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| A (Auftrag, posted)      | Decrease `reserved_qty` in `inventory_balance` per line; set `available_qty = on_hand - (reserved - qty)`                                            |
| L (Lieferschein, posted) | Insert `inventory_movement` with `qty_delta = +qty` (return); increase `on_hand_qty`, recalc `available_qty`; update serial status `sold → in_stock` |

Steps:

1. Remove type guard (`docType !== "R" && docType !== "r"` check)
2. Add `STORNO_REVERSAL_MAP`: `A → null` (no new doc type, just reverse), `L → null`, `R → G`, `r → g`
3. After creating the storno document, run the appropriate reversal side-effect based on `docType`
4. For A: upsert `inventory_balance` decrementing `reserved_qty` per line
5. For L: insert `inventory_movement` + upsert `inventory_balance` incrementing `on_hand_qty`

**New error codes**: `STORNO_NOT_SUPPORTED`, `STORNO_ALREADY_REVERSED`

---

## P1 — applyDeltaEffect (3–4 h)

Needed for: quantity correction on a posted document without a full storno.

**New file**: `packages/domain/src/commands/apply-delta-effect.ts`

```ts
export interface ApplyDeltaParams {
  documentLineId: string;
  qtyDelta: number; // positive = increase, negative = decrease
  userId: string;
}
export interface ApplyDeltaResult {
  success: boolean;
  errorCode?: string;
}
```

Logic:

1. Fetch line + parent document (type, status, warehouse, tenant)
2. Guard: `status === 'posted'`
3. Insert `inventory_movement` with `qty_delta` (signed per direction)
4. Upsert `inventory_balance` accordingly
5. For R/r lines: insert `fact_sales_event` / `fact_purchase_event` with `event_type = 'correction'`
6. Update `document_line.quantity += qtyDelta`, recalc `line_total_net`
7. Recalculate document totals (`total_net`, `total_tax`, `total_gross`)

**Server function**: add `applyDeltaEffectFn` to `server-functions.ts`

---

## P2 — Production Types q and p (4–6 h)

### DB / Seed

**File**: `packages/domain/src/commands/seed-document-defaults.ts`

Add two entries:

| Code | Name               | Prefix | Direction | requiresWarehouse |
| ---- | ------------------ | ------ | --------- | ----------------- |
| q    | Produktionsauftrag | PRO-   | —         | true              |
| p    | Produktionsbuchung | PRB-   | —         | true              |

Schema CHECK constraints already include q, p.

### Posting logic

**File**: `packages/domain/src/commands/posting-command.ts`

Add sets:

```ts
const PRODUCTION_OUTPUT_TYPES = new Set(["q"]); // finished goods in
const PRODUCTION_INPUT_TYPES = new Set(["p"]); // component consumption out
```

q posting:

- Lines with `line_type = 'production_output'`: `on_hand +qty`, `inventory_movement` insert
- Lines with `line_type = 'bom_component'` (auto-exploded): `on_hand -qty`, `inventory_movement` insert

p posting:

- Lines with `line_type = 'production_input'`: `on_hand -qty`

---

## P3 — BOM Explosion (6–8 h)

Schema already exists: `article_bom` table in `packages/db/src/schema/master.ts:408`.

### Domain function

**New file**: `packages/domain/src/commands/explode-bom.ts`

```ts
export async function explodeDocumentBom(
  sql: SqlClient,
  params: { documentId: string; tenantId: string },
): Promise<{ success: boolean; linesAdded: number }>;
```

Logic:

1. Fetch all lines where `article.bom_type = 'production'`
2. For each such line, query `article_bom` for components
3. Insert `document_line` rows with `line_type = 'bom_component'`, `article_id = component`, `quantity = line.quantity × bom.quantity`
4. Renumber `line_no` to keep order

**Server function**: `explodeDocumentBomFn` in `server-functions.ts`

**UI trigger**: Button in `document-lines-view.tsx` ("BOM auflösen") — visible when doc has bom_type='production' lines and status='draft'

### Entity registry

`features/workspace/registry.tsx` — add `article_bom` entity for the BOM management view.

---

## P4 — Document Group Redesign (2–3 h)

Schema already has all needed columns (`group_number`, `next_group_id`, `require_serial_tracking`, `require_batch_tracking`).

### X00 Protection

**File**: `packages/domain/src/commands/entity-command-service.ts` (or a new guard)

When `deleteEntity` or `patchEntity` is called on `document_group`:

- Guard: if `group_number = 0`, reject with 403 `GROUP_PROTECTED`

**Alternative**: DB trigger — simpler, enforced at all layers.

### next_group_id Conversion Flow

**File**: `packages/domain/src/commands/document-convert-storno.ts` `convertDocument()`

Already reads `dg.next_group_id` from the source group (line 32). The flow is wired; just needs UI to set `next_group_id` when configuring groups.

No code change needed — the conversion already uses it. Only needs a form field in the group CRUD dialog (`CrudDialog` → `tenant_fields` metadata for `document_group`).

### require_serial_tracking enforcement

Already enforced in `posting-command.ts` lines 149–163. No code change — already reads from `document_group`.

---

## Summary Table

| Item                     | File(s)                                                  | Effort | Priority |
| ------------------------ | -------------------------------------------------------- | ------ | -------- |
| Seed names/prefixes fix  | `seed-document-defaults.ts`                              | 30 min | P0       |
| available_qty for type b | `posting-command.ts`                                     | 10 min | P0       |
| Broader storno (A, L)    | `document-convert-storno.ts`                             | 3 h    | P1       |
| applyDeltaEffect         | new `apply-delta-effect.ts` + `server-functions.ts`      | 4 h    | P1       |
| Production types q, p    | `seed-document-defaults.ts` + `posting-command.ts`       | 6 h    | P2       |
| BOM explosion            | new `explode-bom.ts` + `server-functions.ts` + UI button | 8 h    | P3       |
| Document group X00 guard | `entity-command-service.ts` or DB trigger                | 2 h    | P4       |

**Total**: ~24 h of focused implementation.

---

## Non-Issues (already implemented or out-of-scope)

- listDocumentTreeFn — real DB query, confirmed
- Serial/batch tracking — fully implemented
- Posting matrix — complete
- Storno R→G, r→g — implemented
- document_group.next_group_id — already wired in convertDocument()
- require_serial_tracking — already enforced in posting-command
- Journal entries — explicitly out of scope per PRD
- Payment tracking — columns exist, flagged as out of scope
