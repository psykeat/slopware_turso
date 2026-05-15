# Feature Slice: Beleggruppen-Redesign (Document Group Redesign)

## Zielbild

Beleggruppen werden von einer losen Konfigurationstabelle zu einer klar strukturierten, hierarchischen Navigationseinheit. Jede Gruppe ist genau einem Belegtyp zugeordnet, erhält eine eindeutige 2-stellige Nummer (X00–X99) und dient als primäre Navigationseinheit im Triview-Grid. X00-Gruppen bilden den garantierten Basis-Tree pro Typ — konfigurierbar, aber nicht löschbar.

---

## Architektur & Datenmodell

### Schema-Änderungen `document_group`

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| `document_type` | `varchar(1)` | Belegtyp-Code (N/A/L/R/G/b/l/r/g/V/Z/E/U/q/p) |
| `group_number` | `integer CHECK(0-99)` | 0 = Basis (nicht löschbar), 1–99 = frei definierbar |
| `direction` | `varchar(20)` | Auto-derived: OUTBOUND/INBOUND/ADJUSTMENT/PRODUCTION |
| `next_group_id` | `uuid FK → document_group (nullable)` | Wandlungsziel übersteuern (Soft-Constraint) |

**Entfernte Spalten:** `code` (varchar), `document_type_old`, `group_no_old`, `active_old`

**Neue UNIQUE Constraint:** `(tenant_id, document_type, group_number)`

**X00-Schutz:** `DELETE` auf Gruppen mit `group_number = 0` wird serverseitig geblockt (nicht per DB-Constraint).

### Direction-Ableitung (hartkodiert, auto-gesetzt beim Speichern)

```
OUTBOUND:   N, A, L, R, G
INBOUND:    b, l, r, g
ADJUSTMENT: V, Z, E, U
PRODUCTION: q, p
```

### Neuer Belegtyp U = Umbuchung

| Feld | Wert |
|------|------|
| Code | `U` |
| Label DE | Umbuchung |
| Direction | ADJUSTMENT |
| Sequenzposition | nach E |

**Lager-zu-Lager-Transfer:** Buchung schreibt zwei `inventory_movement`-Zeilen in einer Transaktion — Entnahme aus `warehouse_id` (bestehendes Feld), Zugang in `target_warehouse_id` (neues Feld).

#### Neues Feld auf `document`

```sql
ALTER TABLE document ADD COLUMN target_warehouse_id uuid REFERENCES warehouse(warehouse_id);
```

Sichtbar im UI und in der Erfassung **ausschließlich bei `document_type = 'U'`**.

#### Verbuchungs-Matrix Erweiterung

| Code | Belegart | `on_hand_qty` (Quelle) | `on_hand_qty` (Ziel) | `movement_type` |
|------|----------|:---:|:---:|:---:|
| U | Umbuchung | **−qty** (warehouse_id) | **+qty** (target_warehouse_id) | `transfer` |

### Typ-Sequenz (hartkodiert für Sortierung & Wandlung)

```
OUTBOUND:   N=1, A=2, L=3, R=4, G=5
INBOUND:    b=1, l=2, r=3, g=4
ADJUSTMENT: V=1, Z=2, E=3, U=4
PRODUCTION: q=1, p=2
```

Primärsortierung: Typ-Sequenz → Sekundär: `group_number` (0–99 natürlich aufsteigend).

### Wandlungslogik mit next_group_id

1. `next_group_id` gesetzt → direkt zur Zielgruppe wandeln (kein Dialog)
2. `next_group_id` null + genau eine Gruppe des nächsten Typs → X00 des nächsten Typs als Default
3. `next_group_id` null + mehrere Gruppen des nächsten Typs → Auswahl-Dialog zeigt alle Gruppen des Zieltyps

UI-Soft-Constraint: Im `next_group_id`-Picker werden nur Gruppen des nächsten Typs in der Sequenz angeboten; DB erzwingt dies nicht per CHECK.

### FK-Umkehr: document_type → document_group

**Entfernt:** `document_type.document_group_id` (UUID FK)

**Neu:** `document_group.document_type` (varchar(1), direkte Code-Referenz, kein UUID-Join nötig)

---

## Migration

```sql
-- 1. Neue Spalten hinzufügen
ALTER TABLE document_group
  ADD COLUMN document_type varchar(1),
  ADD COLUMN group_number  integer CHECK(group_number BETWEEN 0 AND 99),
  ADD COLUMN direction     varchar(20),
  ADD COLUMN next_group_id uuid REFERENCES document_group(document_group_id);

-- 2. Daten aus Legacy-Spalten übernehmen
UPDATE document_group SET
  document_type = document_type_old,
  group_number  = COALESCE(group_no_old, 0),
  direction     = CASE
    WHEN document_type_old IN ('N','A','L','R','G') THEN 'OUTBOUND'
    WHEN document_type_old IN ('b','l','r','g')     THEN 'INBOUND'
    WHEN document_type_old IN ('V','Z','E','U')     THEN 'ADJUSTMENT'
    WHEN document_type_old IN ('q','p')             THEN 'PRODUCTION'
  END;

-- 3. Gruppen ohne gültigen Typ deaktivieren (statt fehlschlagen)
UPDATE document_group SET is_active = false
  WHERE document_type IS NULL;

-- 4. UNIQUE Constraint + NOT NULL
ALTER TABLE document_group
  ALTER COLUMN document_type SET NOT NULL,
  ALTER COLUMN group_number  SET NOT NULL,
  ADD CONSTRAINT uq_document_group_tenant_type_no
    UNIQUE (tenant_id, document_type, group_number);

-- 5. Legacy-Spalten entfernen
ALTER TABLE document_group
  DROP COLUMN code,
  DROP COLUMN document_type_old,
  DROP COLUMN group_no_old,
  DROP COLUMN active_old;

-- 6. Alte FK auf document_type entfernen
ALTER TABLE document_type DROP COLUMN document_group_id;

-- 7. target_warehouse_id auf document
ALTER TABLE document ADD COLUMN target_warehouse_id uuid REFERENCES warehouse(warehouse_id);

-- 8. Seed: X00-Gruppen für alle Typen sicherstellen (je Tenant)
-- (Im Migrations-Seed für neue Tenants; bestehende Tenants via Update oben abgedeckt)

-- 9. Typ U in document_type/number_sequence Seed eintragen
```

---

## Backend

### `packages/api/src/lib/documents.ts`

- Neuen Typ `U` zu `DOCUMENT_TYPES_ADJUSTMENT` hinzufügen
- `TYPE_SEQUENCE`-Map exportieren (wird für Sortierung + Wandlungs-Default genutzt)
- `getDirection()` um `U` erweitern

### `packages/api/src/lib/posting/service.ts`

- `INVENTORY_RULES` um Typ `U` erweitern:
  ```ts
  U: { onHandDelta: -1, targetOnHandDelta: +1, movementType: 'transfer' }
  ```
- `bookInventory()` für U-Typ: zwei separate `inventory_movement` Inserts + zwei `inventory_balance` Upserts (Quelle: `warehouse_id`, Ziel: `target_warehouse_id`)

### API-Routen

- `GET /api/admin/document-groups` — liefert Gruppen sortiert nach Direction + Typ-Sequenz + group_number
- `POST /api/admin/document-groups` — setzt `direction` auto-derived, blockiert DELETE auf group_number=0
- `DELETE /api/admin/document-groups/:id` — 409 wenn `group_number = 0`
- Triview-Query: `document_group_id` als primärer Filter statt `document_type_id`; `document_type` wird intern aus Gruppe gelesen

### `GET /api/entities/document` Filter-Änderung

Vorher: `?document_direction=OUTBOUND&document_type_id=<uuid>`
Nachher: `?document_group_id=<uuid>` — API leitet `document_type` und `direction` intern ab

---

## Frontend

### Admin: Beleggruppen-Tabelle

- Section-Headers nach Direction: **Warenausgang** / **Wareneingang** / **Lager** / **Produktion**
- Innerhalb jeder Section: Zeilen sortiert nach Typ-Sequenz → group_number
- Angezeigte Spalten: Code (z.B. "N00"), Name, Nummernkreis, Aktiv
- X00-Zeilen: Löschen-Button disabled + Tooltip "Basisgruppe kann nicht gelöscht werden"

### Admin: Gruppe anlegen / bearbeiten (EntityMask)

- Typ-Picker: flache Liste mit Section-Headers (gleiche Direction-Gruppierung)
- Direction-Feld: read-only, auto-befüllt nach Typ-Auswahl
- `next_group_id`-Picker: zeigt nur Gruppen des nächsten Typs in der Sequenz (Soft-Constraint)
- `target_warehouse_id` auf Dokument: nur sichtbar wenn `document_type = 'U'`

### Triview-Navigation

- URL-Parameter: `/$tenantSlug/$companyNo/warenausgang/$documentGroupId` (statt `$documentTypeId`)
- Sidebar-Baum: Gruppen gruppiert nach Direction-Section, sortiert nach Typ-Sequenz + group_number
- DocumentGrid-Query: leitet `document_type` aus gewählter Gruppe ab

### Wandlungs-Dialog

- Fall 1 (`next_group_id` gesetzt): direkte Wandlung, kein Dialog
- Fall 2 (eine Zielgruppe): X00 des nächsten Typs, kein Dialog
- Fall 3 (mehrere Zielgruppen): Modal mit Liste der verfügbaren Gruppen des Zieltyps

---

## Implementierungsreihenfolge

1. **Migration** — Schema-Änderungen, Datenmigration, Typ-U-Seed
2. **Backend** — Typ U in documents.ts + INVENTORY_RULES, direction-Derivation, document-group API-Routen
3. **Admin-UI** — Beleggruppen-Tabelle mit Section-Headers, Typ-Picker, X00-Schutz
4. **Triview** — URL-Parameter-Umstellung, Sidebar-Baum, DocumentGrid-Query-Anpassung
5. **Wandlung** — next_group_id-Logik, X00-Fallback, optionaler Auswahl-Dialog
