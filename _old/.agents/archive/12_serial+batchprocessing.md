# 12 — Serien- & Chargennummern (Serial & Batch Tracking)

**Status**: Implementiert (2026-05-16)

---

## Design-Entscheidungen

| #   | Thema                      | Entscheidung                                                                                            |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| 1   | Erfassungszeitpunkt        | Inline im Dokumenten-Editor vor dem Buchen — Accordion-Panel unterhalb der Zeile                        |
| 2   | SN Eingang                 | Freitext-Eingabe → neuer `serial_number`-Eintrag beim Buchen (`status='in_stock'`, `createdMovementId`) |
| 3   | SN Ausgang                 | Combobox-Lookup auf `serial_number WHERE status='in_stock' AND article_id=?`                            |
| 4   | SN Status Auftrag (A)      | `status='reserved'` beim Buchen des Auftrags; kein Movement                                             |
| 5   | SN Status Lieferschein (L) | `status='sold'` + `consumedMovementId` beim Buchen                                                      |
| 6   | Chargennummer              | Freitext; beim Ausgang Combobox aus vorhandenen Chargen mit aktuellem Saldo                             |
| 7   | Tracking-Steuerung         | `article.trackingMode` ('serial'                                                                        | 'batch' | null) ist Basis; `document_group.require_*_tracking` kann übersteuern (im UI noch nicht als Override implementiert) |
| 8   | Qty-Vollständigkeit        | Nur Warnung — `sum(tracking.qty) ≠ line.qty` zeigt Badge, blockiert nicht                               |
| 9   | Batch-Saldo                | Live aus `inventory_movement` via `idx_inventory_movement_batch_balance` — kein separates Balance-Table |
| 10  | Keyboard                   | Enter/Tab = neue Zeile bestätigen · Escape schließt nichts (Elternteil steuert Accordion)               |

---

## Schema (bereits vorhanden — keine Migration nötig)

| Tabelle                  | Relevante Felder                                                                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `article`                | `tracking_mode TEXT CHECK IN ('serial','batch') OR NULL`                                                                                 |
| `document_line_tracking` | `tracking_id`, `document_line_id`, `serial_number_id OR batch_no` (Check-Constraint XOR), `qty`                                          |
| `serial_number`          | `serial_number_id`, `article_id`, `serial_no`, `status IN ('in_stock','reserved','sold')`, `created_movement_id`, `consumed_movement_id` |
| `inventory_movement`     | `serial_number_id`, `batch_no` — werden beim Buchen aus `document_line_tracking` propagiert                                              |
| `document_group`         | `require_serial_tracking BOOL`, `require_batch_tracking BOOL` — Override-Flags (noch nicht im UI ausgewertet)                            |

Index für Batch-Saldo: `idx_inventory_movement_batch_balance ON (tenant_id, warehouse_id, article_id, batch_no)`

---

## Neue Dateien

| Datei                                                                                 | Funktion                                                                         |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `apps/web/src/routes/api/articles/$articleId/serial-numbers.ts`                       | GET: verfügbare SNs, Query-Param `?status=in_stock`                              |
| `apps/web/src/routes/api/articles/$articleId/batches.ts`                              | GET: Chargen mit Live-Saldo (`SUM(qty_delta) > 0`), filterbar nach `warehouseId` |
| `apps/web/src/routes/api/documents/$documentId/lines/$lineId/tracking.ts`             | GET + POST: Tracking-Rows lesen/anlegen                                          |
| `apps/web/src/routes/api/documents/$documentId/lines/$lineId/tracking/$trackingId.ts` | DELETE: Tracking-Row hard-delete (Draft-Daten)                                   |
| `packages/ui/components/tracking-editor.tsx`                                          | Inline-Accordion-Komponente mit SN/Batch-Erfassung und Tastaturnavigation        |

---

## Geänderte Dateien

### `packages/db/src/services/document-service.ts`

**`postDocument`** — nach jedem `inventoryMovement.insert(...).returning()` (alle Bewegungstypen außer N, p):

1. `SELECT * FROM document_line_tracking WHERE document_line_id = ?`
2. **Serial + Eingang** (`l, Z, b, r`): `UPDATE serial_number SET status='in_stock', created_movement_id=?`
3. **Serial + Ausgang** (`L, R, G, E, g`): `UPDATE serial_number SET status='sold', consumed_movement_id=?`
4. **Serial + Auftrag (A)**: `UPDATE serial_number SET status='reserved'` — kein Movement
5. **Alle**: `UPDATE inventory_movement SET serial_number_id=? / batch_no=?`

Alle `tx.insert(inventoryMovement).values(...)`-Calls in `postDocument` wurden auf `.returning()` umgestellt.

### `apps/web/src/routes/api/articles/search.ts`

`trackingMode` in den Response-Feldern ergänzt.

### `packages/ui/components/document-editor.tsx`

- `trackingMode?: string | null` zu `LineRow` und `ArticleResult` hinzugefügt
- `trackingMode` beim Artikel-Select aus API-Antwort übernommen
- `expandedTracking: Set<string>` State in `DocumentLinesEditor`
- `SlidersHorizontalIcon`-Toggle-Button pro Zeile (sichtbar wenn `line.trackingMode` gesetzt und Zeile gespeichert)
- `<TrackingEditor>` Accordion-Panel unterhalb jeder Zeile

---

## `TrackingEditor` — Komponentendetails

**Props:**

```ts
{
  documentId: string;
  documentLineId: string;
  trackingMode: 'serial' | 'batch';
  lineQty: number;
  documentType: string;       // für Inbound/Outbound-Logik
  articleId: string;
  warehouseId?: string | null;
  isPosted: boolean;
}
```

**Inbound-Typen** (SN/Charge anlegen): `l, Z, b, r`
**Outbound-Typen** (SN/Charge aus Bestand wählen): `L, R, G, E, g`

**Verhalten Inbound:**

- SN: Freitext → POST `tracking` mit `serialNumberId: undefined` (wird beim Buchen in `serial_number` erzeugt)
- Charge: Freitext + Menge → POST `tracking` mit `batchNo` + `qty`

**Verhalten Outbound:**

- SN: Combobox-Dropdown aus `GET /api/articles/:articleId/serial-numbers?status=in_stock`
- Charge: Combobox aus `GET /api/articles/:articleId/batches?warehouseId=` mit Saldo-Anzeige

**Warnung:** `sum(tracking.qty) < line.qty` → Amber-Badge `"x/y erfasst"` (kein Block)

---

## Serial-Status Lifecycle

```
(neu)
  └─ Wareneingang (l, Z, b, r) buchen  →  in_stock  (createdMovementId gesetzt)
       └─ Auftrag (A) buchen           →  reserved
            └─ Lieferschein (L) buchen →  sold       (consumedMovementId gesetzt)
```

Storno-Umkehr ist noch nicht implementiert (Storno setzt Status nicht zurück).

---

## Bekannte Lücken / Noch offen

- [ ] **Artikel-Editor**: `trackingMode` ist nur per SQL setzbar, kein UI-Feld im Artikel-Formular
- [ ] **document_group Override**: `require_serial_tracking` / `require_batch_tracking` werden im UI noch nicht ausgewertet — Accordion zeigt sich wenn Artikel ein `trackingMode` hat, unabhängig von der Gruppe
- [ ] **Storno-Umkehr**: Serial-Status wird bei Storno nicht zurückgesetzt (bleibt 'sold' / 'reserved')
- [ ] **Inbound SN → serial_number Anlage**: Beim Inbound-Tracking wird `serialNumberId` leer gesendet. Der `postDocument`-Service erwartet eine gültige UUID in `serial_number_id`. Es fehlt noch die Logik, die beim Buchen eines Inbound-Movements mit `serialNumberId IS NULL` aus `document_line_tracking.qty=1` und einem Freitext-SN eine neue `serial_number`-Row anlegt. **Dies ist ein bekannter Gap** — aktuell wird `batch_no` für Inbound korrekt propagiert, aber SN-Freitext-Inbound benötigt noch einen zusätzlichen Insert-Step im Service.
- [ ] **warehouseId in TrackingEditor**: wird derzeit immer `null` übergeben — Batch-Combobox filtert daher nicht nach Lager
- [ ] **`reserved`-Status freigeben**: wenn ein Auftrag (A) gelöscht/archiviert wird, sollten gebundene SNs zurück auf `in_stock`
