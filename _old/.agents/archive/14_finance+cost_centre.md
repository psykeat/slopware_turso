# 14 — Finance & Kostenstellen

**Status**: Teilweise implementiert (2026-05-16)

Domäne: Finanzbuchhaltung, Kontenrahmen, Kostenstellen, Steuercodes, Fiskalperioden und Buchungsexport.

---

## Design-Entscheidungen

| #   | Thema                         | Entscheidung                                                                                                                                   |
| --- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Buchungshoheit                | Nur `postDocument()` schreibt Journal-Einträge — kein direktes CRUD auf `journal_entry`/`journal_line`                                         |
| 2   | Derived Data                  | `journal_entry`/`journal_line` sind abgeleitete Daten; kein UI-Masken-Editing                                                                  |
| 3   | Export-Idempotenz             | `accounting_export_batch` hat UNIQUE auf `(tenant_id, fiscal_period_id, company_id)` — doppelter Export ist DB-seitig blockiert                |
| 4   | Rebuild-Sperre                | `rebuildBatch` schlägt fehl sobald `status = 'exported'` — Lock ist permanent                                                                  |
| 5   | Kontenfindung                 | `account_determination_rule` — Lookup über `(posting_context, article_group_id, tax_code_id)` mit Fallback-Hierarchie (spezifisch → generisch) |
| 6   | Kostenstellen auf Zeilenebene | `cost_center_id` liegt auf `document_line` (nicht `document`) — je Belegzeile zuweisbar                                                        |
| 7   | Steuerlogik                   | `tax_code` definiert den Steuersatz; `tax_class` auf dem Artikel klassifiziert nur — Kontenfindung braucht `tax_code_id`                       |
| 8   | GL-Account-Typen              | `account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense', 'tax')` — kein freies Format                                           |
| 9   | Fiskalperioden                | `generateFiscalPeriods()` erzeugt Perioden automatisch; kein manuelles UI-Anlegen von Einzelperioden nötig                                     |
| 10  | Offene Posten                 | AR/AP wird über `document.is_paid` / `paid_at` / `paid_amount` geführt; kein separates Debitoren-/Kreditoren-Modul                             |
| 11  | Währung                       | `currency_id` auf Export-Zeile; Beleg-Währung stammt aus `document.currency_id` (wenn vorhanden) oder Tenant-Default                           |
| 12  | Mandantentrennung             | Alle Finanz-Tabellen sind `tenant_id` + `company_id` dual-scoped — Settings gelten pro Gesellschaft                                            |

---

## Schema-Übersicht (Finance-Tabellen)

Alle Tabellen existieren bereits in der Datenbank (Migrationen angewendet).

### Konten & Kostenstellen

```
gl_account
  gl_account_id uuid PK
  tenant_id, company_id
  account_no varchar(20) UNIQUE per company
  name varchar(200)
  account_type: 'asset'|'liability'|'equity'|'revenue'|'expense'|'tax'
  is_active boolean
  archived timestamp (kein hard delete)

cost_center
  cost_center_id uuid PK
  tenant_id, company_id
  code varchar(20) UNIQUE per company
  name varchar(200)
  is_active boolean
  archived timestamp
```

### Buchungsregeln

```
account_determination_rule
  rule_id uuid PK
  tenant_id, company_id
  article_group_id uuid FK (nullable — Fallback wenn NULL)
  tax_code_id uuid FK (nullable — Fallback wenn NULL)
  posting_context varchar(50)        -- 'sales_revenue', 'sales_tax', 'cogs', 'purchase', ...
  gl_account_id uuid FK NOT NULL
  INDEX (tenant_id, posting_context, article_group_id, tax_code_id)
```

### Journal (derived, kein CRUD)

```
journal_entry
  journal_entry_id uuid PK
  tenant_id, company_id
  posting_date date
  source_document_id uuid FK
  description text

journal_line
  journal_line_id uuid PK
  tenant_id, company_id
  journal_entry_id uuid FK
  gl_account_id uuid FK
  cost_center_id uuid FK (nullable)
  tax_code_id uuid FK (nullable)
  debit_amount numeric(18,4)
  credit_amount numeric(18,4)
  CHECK: (debit_amount > 0) XOR (credit_amount > 0)
```

### Fiskalperioden & Steuercodes

```
fiscal_period
  fiscal_period_id uuid PK
  tenant_id, company_id
  fiscal_year integer
  period_no integer (1–12 oder 1–13)
  start_date date, end_date date
  is_closed boolean

tax_code
  tax_code_id uuid PK
  tenant_id
  code varchar(10)
  description varchar(200)
  tax_rate numeric(5,4)   -- z. B. 0.2000 = 20%
  is_active boolean
  archived timestamp
```

### Export-Batch

```
accounting_export_batch
  batch_id uuid PK
  tenant_id, company_id, fiscal_period_id
  status: 'pending'|'exported'|'failed'
  row_count integer DEFAULT 0
  created_at, exported_at timestamp
  created_by uuid FK (user)
  UNIQUE (tenant_id, fiscal_period_id, company_id)

accounting_export_row
  row_id uuid PK
  batch_id uuid FK
  tenant_id, company_id
  posting_date date
  gl_account_id, cost_center_id, tax_code_id (nullable FKs)
  debit_amount, credit_amount numeric(18,4)
  currency_id varchar(3)
  source_document_id uuid FK
  source_document_no varchar(50)
```

---

## Implementiert

### A — Buchungsjournal in `postDocument()`

`packages/db/src/services/document-service.ts`

- Für Belegtypen **R** (Ausgangsrechnung) und **G** (Ausgangsgutschrift): schreibt `journal_entry` + `journal_line` mit `posting_context = 'sales_revenue'` / `'sales_tax'` / `'cogs'`
- Für Belegtypen **r** (Eingangsrechnung) und **g** (Eingangsgutschrift): schreibt `journal_entry` + `journal_line` mit `posting_context = 'purchase'`
- Kontenfindung via `account_determination_rule` (Lookup-Fallback: spezifisch → generisch)
- `cost_center_id` und `tax_code_id` werden von `document_line` in `journal_line` übernommen

### B — AccountingExportService

`packages/db/src/services/accounting-export-service.ts`

| Methode                                                          | Funktion                                                                                                                      |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `createExportBatch(tenantId, companyId, fiscalPeriodId, userId)` | Anlage, UNIQUE-Constraint schützt vor Duplikaten                                                                              |
| `buildExportRows(batchId, tenantId)`                             | Aggregiert `journal_line` nach `(gl_account_id, cost_center_id, tax_code_id, posting_date)`, schreibt `accounting_export_row` |
| `rebuildBatch(batchId, tenantId)`                                | Löscht bestehende Rows, baut neu auf — nur wenn `status != 'exported'`                                                        |
| `markBatchExported(batchId, tenantId)`                           | Setzt `status = 'exported'`, `exported_at = now()`                                                                            |
| `generateCsv(batchId, tenantId)`                                 | Gibt CSV-String zurück (Semikolon-getrennt, UTF-8)                                                                            |

### C — API-Routen

| Methode | Route                                      | Funktion                 |
| ------- | ------------------------------------------ | ------------------------ |
| `GET`   | `/api/accounting/batches`                  | Alle Batches des Tenants |
| `POST`  | `/api/accounting/batches`                  | Neuen Batch anlegen      |
| `POST`  | `/api/accounting/batches/:batchId/build`   | Rows aufbauen            |
| `POST`  | `/api/accounting/batches/:batchId/rebuild` | Rows neu aufbauen        |
| `POST`  | `/api/accounting/batches/:batchId/export`  | Als exportiert markieren |
| `GET`   | `/api/accounting/batches/:batchId/csv`     | CSV-Download             |

### D — Accounting-Modul UI

`apps/web/src/routes/_auth/app/accounting.tsx`

- DataGrid mit Batch-Liste (Status, Fiskalperiode, Zeilenanzahl, Datum)
- Dialog zum Anlegen: Gesellschaft wählen → Fiskalperiode wählen
- Commands: F3 (Neu), F9 (Aufbauen), Als exportiert markieren, Neu aufbauen, CSV herunterladen
- Fehleranzeige inline

### E — FiscalPeriodGenerator

`packages/db/src/services/fiscal-period-generator.ts`

- `generateFiscalPeriods(tenantId, companyId, fiscalYear, periodsPerYear)` — legt 12 oder 13 Perioden an
- `resolveFiscalPeriodId(tenantId, companyId, date)` — findet die zugehörige Periode zu einem Datum

---

## Noch nicht implementiert

### F1 — GL-Konto-Stamm (Settings)

Das `gl_account`-Schema existiert, aber es gibt kein UI zur Pflege. Derzeit nur via generischer Data-API (`/api/data/gl_account`) und direktem DB-Zugriff zugänglich.

**Umfang:**

- Settings-Entity `gl_account` mit EntityMask (account_no, name, account_type, is_active)
- Account-Type als Dropdown (5 feste Werte)
- Lokalisierungen: `settings.gl_account.*`

### F2 — Kostenstellen-Stamm (Settings)

Analog zu GL-Konten — Schema existiert, kein UI.

**Umfang:**

- Settings-Entity `cost_center` mit EntityMask (code, name, is_active)
- Zuweisung auf Belegzeilen: Kostenstellen-Auswahl in `document-editor.tsx` → `LineRow.costCenterId`
- Filter im Belegeditor nur auf aktive, nicht-archivierte Kostenstellen

### F3 — Kontenfindungs-Regeln (Settings)

`account_determination_rule` hat kein UI. Buchhalter müssen Regeln direkt in der DB anlegen.

**Umfang:**

- Settings-Entity `account_determination_rule`
- Felder: posting_context (Dropdown fester Werte), article_group (nullable Suche), tax_code (nullable Suche), gl_account (Suche)
- Tabellarische Übersicht + Inline-Edit
- Validation: Duplikate verhindern (UNIQUE auf Kombination)
- Posting-Contexts: `'sales_revenue'`, `'sales_tax'`, `'cogs'`, `'purchase'`, `'purchase_tax'`, `'inventory_adjustment'`

### F4 — Journal-Viewer (Read-Only Ledger)

Buchhalter brauchen Einsicht in `journal_entry` + `journal_line` nach Verbuchen.

**Umfang:**

- Neuer Tab oder Sub-Screen im Accounting-Modul
- Filter: Fiskalperiode, GL-Konto, Kostenstelle, Belegart
- Spalten: Datum, Belegnr., Buchungstext, Soll, Haben, Saldo laufend
- Kein Editing — reine Anzeige
- API: `GET /api/accounting/journal?fiscalPeriodId=&glAccountId=&costCenterId=`

### F5 — Fiskalperioden-UI (Settings)

`generateFiscalPeriods()` existiert, aber es gibt kein UI zum Auslösen.

**Umfang:**

- Settings-Entity `fiscal_period` (read-only Liste + Generate-Action)
- Command: "Fiskalperioden generieren" → Dialog (Jahr wählen, 12/13 Perioden)
- `is_closed`-Toggle pro Periode (Sperre gegen Nachbuchungen)
- Beim Verbuchen: Prüfung ob `fiscal_period.is_closed = true` → Fehler

### F6 — Steuercode-UI (Settings)

`tax_code` existiert nur im Schema, kein Settings-Screen.

**Umfang:**

- Settings-Entity `tax_code` (code, description, tax_rate, is_active)
- Verknüpfung mit `article.tax_class_id` über `tax_code_id` im Kontenfindungs-Lookup
- Hinweis: `tax_class` (auf Artikel) ≠ `tax_code` — Mapping-Logik klären

### F7 — Offene Posten / AR+AP

`document.is_paid` / `paid_at` / `paid_amount` existieren, aber es gibt kein UI und keine automatische Fälligkeitslogik.

**Umfang:**

- `GET /api/stats/open-items?type=ar|ap` — offene Rechnungen nach Fälligkeit
- Tab "Offene Posten" in Adressen-Detailansicht (bereits Platzhalter in `addresses.tsx`)
- Manuelles Abbuchen: PATCH `{ isPaid: true, paidAt, paidAmount }` via Domain-Command (kein direktes CRUD)
- Aging-Berechnung: < 30 Tage / 30–60 / 60–90 / > 90 Tage

### F8 — MwSt.-Abrechnung (Export-Erweiterung)

Derzeit enthält der CSV-Export keine aggregierte Steuerzeilen-Übersicht.

**Umfang:**

- Zusätzliche Sektion im CSV: Steuercodes × Nettobetrag × Steuerbetrag
- API: `GET /api/accounting/batches/:batchId/vat-summary`

---

## Abhängigkeiten

```
F1 (GL-Konten)          ← Voraussetzung für F3 (Kontenfindung)
F2 (Kostenstellen)      ← Voraussetzung für F3 (Kontenfindung) und LineEditor
F3 (Kontenfindung)      ← Voraussetzung für korrekte Journal-Buchungen
F5 (Fiskalperioden-UI)  ← Nützlich für F4 (Journal-Filter) und F7 (Offene Posten)
F6 (Steuercodes)        ← Voraussetzung für vollständige Kontenfindung
F7 (Offene Posten)      ← Unabhängig, aber sinnvoll nach F4
F4 (Journal-Viewer)     ← Nützlich zu haben, nicht kritisch für Basisfunktion
```

**Empfohlene Implementierungsreihenfolge:** F1 → F2 → F6 → F3 → F5 → F4 → F7 → F8

---

## Migrations-Referenz

| Migration                                 | Inhalt                                                                                                                                                                      |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20260516054903_faithful_living_tribunal` | `accounting_export_batch`, `accounting_export_row`, `journal_entry`, `journal_line`, `gl_account`, `cost_center`, `account_determination_rule`, `fiscal_period`, `tax_code` |
| `20260516120000_mis_stat_views`           | Materialisierte Views (`mv_sales_period`, `mv_sales_period_customer`, `mv_sales_period_article`, ...)                                                                       |

---

## Nicht-Ziele

- Kein vollständiges Finanzbuchhaltungsmodul (kein DATEV-Vollabgleich, kein Kontenplan-Import)
- Keine manuelle Journal-Pflege via UI
- Keine Zahlungsabwicklung / Banking-Integration
- Keine Multi-Currency-Umrechnung (alle Beträge in Mandant-Standardwährung)
- Kein automatisches Steuermeldungsformular
