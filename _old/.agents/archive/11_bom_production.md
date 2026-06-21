# 11 — Stücklisten: Handelsstücklisten (H) & Produktionsstücklisten (P)

**Status**: Implementiert (2026-05-16)

---

## Design-Entscheidungen (Grill-Session)

| #   | Thema                | Entscheidung                                                                                                                                         |
| --- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | K-Zeilen editierbar  | K-Komponenten sind individuell editierbar, aber eine H/P-Mengenänderung setzt alle K-Zeilen zurück (manuelle Edits gehen verloren)                   |
| 2   | H-Mengenänderung     | **Reset** auf `H-Menge × BOM-Menge × (1 + scrap% / 100)` — kein proportionales Skalieren                                                             |
| 3   | Auflösung in Belegen | `sales_bom_header` (H) in **N, A, L, R, G**; `production_output` (P) in **p, q**                                                                     |
| 4   | Wandeln N→A→L        | H + K Zeilen werden **unverändert übernommen** — keine Neuauflösung beim Wandeln                                                                     |
| 5   | p→q                  | Via bestehendem Wandeln-Mechanismus; K-Zeilen werden mitübernommen                                                                                   |
| 6   | Scrap-Percentage     | Wird **eingerechnet**: `K-Menge = H-Menge × BOM-Menge × (1 + scrap% / 100)`                                                                          |
| 7   | line_type Mapping    | `sales_bom_header` (NEU) = H; `production_output` (bestehend) = P; `bom_component` (bestehend) = K für beide; `production_input` deprecated/entfernt |
| 8   | Gruppen-Identifier   | `bom_group_id uuid` auf `document_line` — shared UUID für H/P + alle K-Zeilen; kein FK-Pointer; Application-level Cascade beim Löschen               |
| 9   | K-Zeilen Preis       | Immer `net_price = 0`, `line_total = 0`                                                                                                              |
| 10  | Druck                | Alle K-Zeilen immer andrucken (H-K in NALRG, P-K in p/q)                                                                                             |
| 11  | Sortierung BOM       | `sort_order integer` im `article_bom` Stamm — explizite Reihenfolge, kein `created_at`                                                               |

---

## Bestandslogik je Belegart

| Belegart                    | H/P-Zeile                   | K-Zeile                  |
| --------------------------- | --------------------------- | ------------------------ |
| N, A, R, G (H-Artikel)      | keine Lagerbewegung         | abbuchen beim Verbuchen  |
| L (H-Artikel, Lieferschein) | keine Lagerbewegung         | abbuchen                 |
| L, R etc. (P-Artikel)       | abbuchen (normaler Artikel) | keine K-Zeilen vorhanden |
| q (Fertigmeldung)           | **zubuchen** (+qty)         | **abbuchen** (−qty)      |
| p (Produktionsauftrag)      | kein Posting (Planung)      | kein Posting             |

---

## Schema-Änderungen

**Migration**: `20260516072847_slippery_black_tarantula`

### `article_bom` — neues Feld

```sql
ALTER TABLE article_bom ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
```

### `document_line` — neues Feld

```sql
ALTER TABLE document_line ADD COLUMN bom_group_id uuid;
```

### `document_line` — `line_type` CHECK-Constraint

`production_input` entfernt, `sales_bom_header` hinzugefügt:

```sql
line_type IN ('article', 'comment', 'production_output', 'sales_bom_header', 'bom_component')
```

---

## Implementierte Dateien

### `packages/db/src/schema/app.schema.ts`

- `articleBom`: `sortOrder: integer("sort_order").notNull().default(0)` (vor `createdAt`)
- `documentLine`: `bomGroupId: uuid("bom_group_id")` (nullable, nach `lineType`)
- `documentLine` CHECK-Constraint: `production_input` → `sales_bom_header`

### `packages/db/src/services/document-service.ts`

In `postDocument()`:

1. `q` aus dem Blanket-Skip entfernt — Fertigmeldungen werden jetzt verbucht
2. `sales_bom_header`-Skip: `if (line.lineType === 'sales_bom_header') continue`
3. `q`-Block vor dem allgemeinen Switch:
   - `production_output` → `+qty` auf `inventory_balance`, `inventoryMovement` mit `movementType = 'q'`, AVCO-Update
   - `bom_component` → `−qty` auf `inventory_balance`, `inventoryMovement` mit `movementType = 'q'`, kein AVCO (netPrice = 0)
   - Block endet mit `continue` → fällt nie in allgemeinen Switch
4. NALRG + `bom_component`: bestehende Abgangslogik greift automatisch (articleId + qty vorhanden)

### `apps/web/src/routes/api/articles/$articleId/bom.ts`

- **GET**: Komponenten mit Join auf `article` (component), gefiltert nach `tenantId`, `headerArticleId`, `archived = false`, `isActive = true`, sortiert nach `sortOrder ASC`
- **POST**: Neue Komponente anlegen, `sortOrder` auto = `MAX(sortOrder) + 10` falls nicht angegeben

### `apps/web/src/routes/api/articles/$articleId/bom/$bomId.ts` (NEU)

- **PATCH**: `quantity`, `scrapPercentage`, `sortOrder` aktualisieren
- **DELETE**: `archived = true` (kein hard delete)

### `apps/web/src/routes/api/articles/search.ts`

- `bomType: article.bomType` zum SELECT hinzugefügt — Frontend weiß ob Artikel eine Stückliste hat

### `packages/ui/components/document-editor.tsx`

- `LineRow` um `lineType` und `bomGroupId` erweitert
- `ArticleResult` um `bomType` erweitert
- `bomCacheRef` — `useRef<Record<string, BomComponent[]>>` für BOM-Daten-Cache
- **`handleArticleSelect`** (2a + 2e): Bei `bomType !== 'none'` und passendem Belegtyp → `bomGroupId = crypto.randomUUID()`, `lineType` setzen, BOM fetchen, K-Zeilen direkt nach H-Zeile splicen
- **`commitEdit`** (2b): Bei Mengenänderung auf H/P-Zeile → K-Zeilen aus Cache neu berechnen
- **`deleteLine`** (2c): H/P-Zeile löschen → alle K-Zeilen mit gleicher `bomGroupId` mitlöschen
- **Tab-Flow** (2d): `bom_component`-Zeilen überspringen Preis + Rabatt
- **Visuelles Styling** (2d): `CornerDownRightIcon`, `pl-4`, `text-muted-foreground`, `opacity-80`
- Save-Mutation: `lineType` + `bomGroupId` in Request-Body

### `packages/ui/components/bom-editor.tsx` (NEU)

Stücklisten-Pflegekomponente für den Artikelstamm:

- Tabellarische Anzeige: Nr. | Bezeichnung | Menge | Ausschuss% | Sort. | Löschen
- **Doppelklick** auf Zeile → Inline-Edit (Menge, Ausschuss%, Sortierung)
- **Neue Komponente**: Artikel-Suche (`/api/articles/search`), Menge, Ausschuss%, Sortierung (auto = MAX+10)
- **Löschen**: DELETE → `archived = true`

### `apps/web/src/routes/_auth/app/articles.tsx`

- Import `BomEditor`
- Neuer Tab "Stückliste" in `dependentTabs` — nur sichtbar wenn `selectedArticle?.bomType !== 'none'`

### `apps/web/src/routeTree.gen.ts`

- Import + Route-Definitionen für `/api/articles/$articleId/bom/$bomId`
- Import + Route-Definitionen für `/api/documents/$documentId/duplicate` (pre-existing file, fehlte in Tree)
- Alle Interface-Einträge (FileRoutesByFullPath, FileRoutesByTo, FileRoutesById, FileRouteTypes, RootRouteChildren, declare module) aktualisiert

---

## Nächste offene Punkte

- `bom_type`-Feld im Artikelstamm via EntityMask editierbar machen (derzeit nur via generischem PATCH — kein dediziertes UI-Feld)
- Drucklogik: K-Zeilen in PDF-Templates berücksichtigen (andrucken je nach `lineType`)
- Wandlungsmaske (10_wandlung.md) für p→q: Bestätigung analog zu N→A
