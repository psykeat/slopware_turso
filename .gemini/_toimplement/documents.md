# PRD: Belegerfassung & Verbuchung

## Problem Statement

Sachbearbeiter müssen täglich Geschäftsvorgänge — Angebote, Aufträge, Lieferscheine, Rechnungen, Bestellungen, Wareneingänge und Lagerbuchungen — erfassen, weiterverarbeiten und buchen. Heute gibt es dafür keine durchgängige Lösung im System: Belege können nicht angelegt werden, Nummernkreise fehlen, Wandlungen (z.B. Angebot → Auftrag) sind nicht möglich, und Buchungseffekte auf Lager und Statistik werden nicht ausgelöst. Der gesamte Belegfluss ist manuell und fehleranfällig.

## Solution

Ein prozessorientierter Beleg-Arbeitsbereich, in dem Belege entlang einer Belegkette fließen. Der Sachbearbeiter erfasst Positionen schnell per Tastatur, Preise und Steuern werden kontextabhängig vorbesetzt, und das Buchen eines Belegs löst automatisch alle Lager- und Statistikeffekte aus. Gleichzeitig werden diese Ableitungen direkt im Artikel- und Adressstamm sichtbar: als Lagerbestandstabelle im Artikel-Dialog und als Beleghistorie + Jahresumsatz im Adress-Dialog.

## User Stories

### Navigation & Übersicht

1. Als Sachbearbeiter möchte ich in der Sidebar einen dreistufigen Belegbaum sehen (Warenausgang → Belegart → Beleggruppe), damit ich direkt zur richtigen Belegliste navigieren kann.
2. Als Sachbearbeiter möchte ich Lagerbuchungen (Inventur, Zubuchung, Entnahme, Umlagerung) in einem eigenen eingeklappten Sidebar-Bereich finden, damit sie den Hauptbelegfluss nicht stören.
3. Als Sachbearbeiter möchte ich eine Belegliste mit Suche, Sortierung und serverseitiger Filterung nach Richtung, Typ und Gruppe sehen, damit ich schnell den richtigen Beleg finde.
4. Als Sachbearbeiter möchte ich einen Beleg per Klick in einer Detail-Pane öffnen, damit ich genug Platz für Header-Felder und Positionstabelle habe.

### Belege anlegen

5. Als Sachbearbeiter möchte ich einen neuen Beleg vom Typ meiner Wahl anlegen, damit der Geschäftsvorgang im System erfasst wird.
6. Als Sachbearbeiter möchte ich beim Anlegen eine Beleggruppe wählen, damit Nummernkreis, Standardlager, Standardsteuer und Wandlungsvorschlag automatisch vorbesetzt werden.
7. Als Sachbearbeiter möchte ich, dass die Belegnummer beim Anlegen sofort automatisch vergeben wird (z.B. AUF-00042), damit der Beleg sofort referenzierbar und druckbar ist.
8. Als Sachbearbeiter möchte ich eine Adresse per Autocomplete (Nummer + Name) auswählen, damit ich nicht die UUID kennen muss.
9. Als Sachbearbeiter möchte ich, dass die Währung aus der Adresse oder dem Firmenstamm vorbesetzt wird, damit ich sie nicht manuell eingeben muss.
10. Als Sachbearbeiter möchte ich das Standardlager aus der Beleggruppe im Header übernehmen können, aber bei Bedarf überschreiben, damit Sonderfälle möglich sind.

### Positionserfassung

11. Als Sachbearbeiter möchte ich Positionen per Artikel-Autocomplete erfassen, damit ich schnell den richtigen Artikel finde ohne die Nummer zu kennen.
12. Als Sachbearbeiter möchte ich, dass beim Auswählen eines Artikels der Preis aus der Preisliste der Adresse vorbesetzt wird, damit ich ihn nicht manuell eingeben muss.
13. Als Sachbearbeiter möchte ich, dass beim Auswählen eines Artikels der Steuersatz aus der Steuermatrix (Artikel-Steuerklasse × Kunden-Steuerklasse × Land) automatisch aufgelöst wird, damit ich keine Steuer manuell suchen muss.
14. Als Sachbearbeiter möchte ich Zeilensummen, Netto-Gesamtsumme, Steuer und Bruttobetrag in Echtzeit sehen, damit ich den Belegwert jederzeit kenne.
15. Als Sachbearbeiter möchte ich Mengen und Preise direkt in der Tabelle bearbeiten, damit ich nicht zwischen Feldern hin- und herspringen muss.
16. Als Sachbearbeiter möchte ich einem Artikel pro Zeile ein anderes Lager zuweisen als im Header, damit Umlagerungen und gemischte Lagerbuchungen möglich sind.
17. Als Sachbearbeiter möchte ich Kommentarzeilen (ohne Artikel) einfügen können, damit ich Zwischenüberschriften oder Freitext in der Positionsliste habe.
18. Als Sachbearbeiter möchte ich Positionen per Tastatur navigieren und erfassen können (Tab-Durchlauf), damit die Erfassung ohne Maus möglich ist.

### Speichern & Aktionen

19. Als Sachbearbeiter möchte ich den Beleg explizit speichern, damit versehentliche Teilspeicherungen während der Erfassung vermieden werden.
20. Als Sachbearbeiter möchte ich einen Beleg mit einem Klick auf "Buchen" verbuchen, damit Lager- und Statistikeffekte ausgelöst werden.
21. Als Sachbearbeiter möchte ich einen Beleg mit einem Klick auf "Wandeln" in den nächsten Belegtyp überführen (z.B. Angebot → Auftrag), damit der Geschäftsvorgang weiterläuft ohne Daten neu einzugeben.
22. Als Sachbearbeiter möchte ich, dass beim Wandeln die Beleggruppe aus dem "Wandlungsvorschlag" der Quellgruppe vorgeschlagen wird, damit ich nicht manuell suchen muss.
23. Als Sachbearbeiter möchte ich eine gebuchte Rechnung stornieren (→ Gutschrift), damit fehlerhafte Rechnungen korrekt rückgängig gemacht werden können.
24. Als Sachbearbeiter möchte ich, dass die Aktionsbuttons (Buchen, Wandeln, Stornieren) nur sichtbar sind wenn der Status sie erlaubt, damit ich keine ungültigen Aktionen ausführen kann.

### Löschregeln

25. Als Sachbearbeiter möchte ich einen Beleg (außer R, r, G, g) jederzeit löschen können, damit Fehlerfassungen beseitigt werden können.
26. Als Sachbearbeiter möchte ich, dass Rechnungen, Eingangsrechnungen, Gutschriften und Eingangsgutschriften nicht gelöscht werden können, damit die Buchungsintegrität gewahrt bleibt.

### Verbuchungseffekte

27. Als Lagermitarbeiter möchte ich, dass beim Buchen eines Lieferscheins (L) der Lagerbestand reduziert und die Reservierung aufgehoben wird, damit der Bestand immer aktuell ist.
28. Als Lagermitarbeiter möchte ich, dass beim Buchen eines WE-Lieferscheins (l) der Lagerbestand erhöht und die offene Bestellmenge reduziert wird.
29. Als Lagermitarbeiter möchte ich, dass beim Buchen einer Bestellung (b) die erwartete Zugangsmenge erhöht wird, damit ich sehe was noch einzutreffen hat.
30. Als Lagermitarbeiter möchte ich, dass beim Buchen eines Auftrags (A) eine Reservierung angelegt wird, damit der Bestand nicht doppelt verkauft wird.
31. Als Lagermitarbeiter möchte ich, dass beim Buchen einer Umlagerung (U) der Bestand im Quelllager reduziert und im Ziellager erhöht wird.
32. Als Lagermitarbeiter möchte ich, dass beim Buchen einer Inventurbuchung (V) der Bestand auf den erfassten Sollwert gesetzt wird, nicht addiert.
33. Als Sachbearbeiter möchte ich, dass ein Beleg nur einmal gebucht werden kann, damit Doppelbuchungen verhindert werden.
34. Als Sachbearbeiter möchte ich, dass stornierte Belege nicht gebucht werden können.

### Lagerbestand im Artikel-Dialog

35. Als Lagermitarbeiter möchte ich im Artikel-Dialog eine Lagerbestandstabelle sehen (Bestand, Reserviert, Verfügbar pro Lager), damit ich den aktuellen Stand direkt am Stammdatum ablesen kann.
36. Als Lagermitarbeiter möchte ich bei mehreren Lagern eine Gesamtsummenzeile sehen, damit ich den Gesamtbestand auf einen Blick habe.
37. Als Lagermitarbeiter möchte ich, dass reservierte Mengen amber und verfügbare Mengen grün dargestellt werden, damit kritische Bestände sofort erkennbar sind.

### Kundenstatistik im Adress-Dialog

38. Als Vertriebsmitarbeiter möchte ich im Adress-Dialog die letzten 10 Belege des Kunden sehen (Datum, Belegnummer, Typ, Status, Brutto), damit ich den aktuellen Beziehungsstatus kenne.
39. Als Vertriebsmitarbeiter möchte ich im Adress-Dialog die Jahresumsätze des Kunden (Menge + Nettobetrag pro Jahr) sehen, damit ich die Kundenentwicklung beurteilen kann.
40. Als Vertriebsmitarbeiter möchte ich, dass die Jahresumsatz-Sektion nur erscheint wenn bereits Rechnungen gebucht wurden, damit der Dialog bei neuen Kunden nicht leer wirkt.

### Onboarding

41. Als Systemadministrator möchte ich, dass beim Anlegen einer neuen Company automatisch Nummernkreise, Beleggruppen und Belegarten angelegt werden, damit sofort mit der Erfassung begonnen werden kann.

## Implementation Decisions

### Schema Changes (Drizzle-managed)

- `number_sequence` bekommt eine neue Spalte `document_type char(1)` mit einem neuen UNIQUE-Constraint auf `(tenant_id, company_id, document_type)`. Die bisherige Prefix-basierte Eindeutigkeit bleibt bestehen.
- `address` bekommt eine neue Spalte `price_list_id uuid` (nullable FK auf `price_list`), damit die Preislistenzuordnung pro Adresse möglich ist.

### Custom SQL Migration

- PostgreSQL-Funktion `next_sequence_no(p_tenant_id, p_company_id, p_doc_type)` als einzige DB-seitige Businesslogik. Sie führt ein atomisches `UPDATE ... RETURNING` auf `number_sequence` aus und gibt die formatierte Belegnummer zurück (Präfix + zero-padded Zähler). Keine Concurrency-Probleme durch optimistisches Locking.

### Belegarten & Nummernkreis-Präfixe

Dreizehn Belegarten mit Ein-Zeichen-Codes. Großbuchstaben = Warenausgang, Kleinbuchstaben = Wareneingang, Sonderzeichen = Lagerbuchungen:

| Code | Richtung   | Bezeichnung     | Präfix |
| ---- | ---------- | --------------- | ------ |
| N    | OUTBOUND   | Angebot         | ANG-   |
| A    | OUTBOUND   | Auftrag         | AUF-   |
| L    | OUTBOUND   | Lieferschein    | LIS-   |
| R    | OUTBOUND   | Rechnung        | RE-    |
| G    | OUTBOUND   | Gutschrift      | GU-    |
| b    | INBOUND    | Bestellung      | BES-   |
| l    | INBOUND    | WE-Lieferschein | WEL-   |
| r    | INBOUND    | WE-Rechnung     | WER-   |
| g    | INBOUND    | WE-Gutschrift   | WEG-   |
| V    | ADJUSTMENT | Inventurbuchung | INV-   |
| Z    | ADJUSTMENT | Zubuchung       | ZUB-   |
| E    | ADJUSTMENT | Entnahme        | ENT-   |
| U    | ADJUSTMENT | Umlagerung      | UMB-   |

Produktionsbelege (q = Produktionsauftrag, p = Produktion Abgeschlossen) sind im Schema reserviert, aber out of scope für diesen Slice.

### Onboarding-Command `seedDocumentDefaults(tenantId, companyId)`

Wird beim Anlegen einer neuen Company aufgerufen. Legt pro Tenant an:

- 13 `document_type`-Rows mit `next_document_type_id`-Verknüpfungen (N→A→L→R, b→l→r; G/g/V/Z/E/U ohne Nachfolger)
- 13 `document_group`-Rows (je eine "Standard"-Gruppe, Gruppenummer 0)
- 13 `number_sequence`-Rows mit den definierten Präfixen

Kein statischer DB-Seed — jeder Mandant bekommt eigene Nummernkreise.

### Domain-Schicht

Zwei neue Domain-Module:

**Document Commands** (CRUD + convert + storno):

- `createDocument(sql, payload)` — ruft `next_sequence_no` auf, setzt `status = 'draft'`, speichert Header und Zeilen sequenziell innerhalb einer Transaktion (sequenziell wegen Postgres.js Numeric-Handling bei Batch-Inserts)
- `updateDocument(sql, id, payload)` — nur für Draft-Belege
- `deleteDocument(sql, id)` — blockiert für R, r, G, g; erlaubt für alle anderen Typen unabhängig vom Status
- `convertDocument(sql, id, targetGroupId?)` — liest Wandlungsziel aus hardcoded Map + optionalem `document_group.next_group_id`-Override, erstellt Zielbeleg, kopiert Zeilen, setzt Quellbeleg auf `status = 'archived'`
- `stornoDocument(sql, id, userId)` — nur für posted R/r; erstellt G/g mit gleichen Mengen (positiv), setzt `storno_document_id` auf Quell-ID, setzt Quellbeleg auf `status = 'cancelled'`, `cancelled_at`

**Document Posting** (Verbuchungslogik):

- `postDocument(sql, docId, userId)` — Einstiegspunkt; prüft Guards (404/409), verzweigt bei V in `bookInventoryCorrection`, alle anderen durch `bookInventory` + `bookSalesFact`, setzt abschließend `status = 'posted'`, `posted_at`, `posted_by` — alles atomar in derselben `withTenant()`-Transaktion

### Verbuchungs-Matrix

| Code |      `on_hand_qty`      | `reserved_qty` | `expected_purchase_qty` | `inventory_movement` | `fact_sales_event` |
| ---- | :---------------------: | :------------: | :---------------------: | :------------------: | :----------------: |
| N    |            —            |       —        |            —            |          —           |         —          |
| A    |            —            |      +qty      |            —            |          —           |         —          |
| L    |          −qty           |      −qty      |            —            |       `issue`        |         —          |
| R    |            —            |       —        |            —            |          —           |     `original`     |
| G    |          +qty           |       —        |            —            |       `return`       |    `correction`    |
| b    |            —            |       —        |        **+qty**         |          —           |         —          |
| l    |          +qty           |       —        |        **−qty**         |      `receipt`       |         —          |
| r    |            —            |       —        |            —            |          —           |         —          |
| g    |          −qty           |       —        |            —            |       `return`       |         —          |
| V    |      SET Zielwert       |       —        |            —            |     `correction`     |         —          |
| Z    |          +qty           |       —        |            —            |      `receipt`       |         —          |
| E    |          −qty           |       —        |            —            |       `issue`        |         —          |
| U    | −qty (src) / +qty (tgt) |       —        |            —            | `issue` + `receipt`  |         —          |

Wichtige Regeln:

- Positionen ohne `warehouse_id` oder `article_id` werden für Lagerbuchungen übersprungen
- `available_qty = on_hand_qty − reserved_qty` wird bei jedem Upsert manuell gepflegt (keine Generated Column)
- V trägt in der Zeile den Sollbestand (nicht Delta); Delta = `line.quantity − current_on_hand` und wird erst zur Buchungszeit berechnet
- U erzeugt zwei `inventory_balance`-Upserts: −qty am `warehouse_id`, +qty am `target_warehouse_id`
- b bucht auf `expected_purchase_qty` (nicht `reserved_qty`); l schließt die Erwartung: `on_hand +qty`, `expected_purchase −qty`
- Idempotenz-Guard: `posted_at IS NOT NULL` → 409
- Stornierte Belege können nicht gebucht werden → 409

### Wandlungskette

Hardcoded Fallback-Map: N→A, A→L, L→R, b→l, l→r. Wenn das Quell-Dokument eine Beleggruppe hat mit gesetztem `next_group_id`, wird der Zieltyp und die Zielgruppe aus dieser Gruppe gelesen (Override). Das erlaubt mandantenfähige Wandlungsvorschläge ohne Code-Deploy.

### Storno-Logik

Nur für R→G und r→g, nur für `posted`-Belege. Der neue G/g-Beleg:

- Kopiert alle Zeilen mit identischen (positiven) Mengen
- Bekommt `storno_document_id` gesetzt (zeigt auf Original-R/r)
- Startet als `status = 'draft'` und muss separat gebucht werden

Das Original-R/r bekommt `status = 'cancelled'` und `cancelled_at`. G/g können nicht gelöscht und nicht erneut storniert werden.

### Löschregeln

- **Löschbar**: N, A, L, b, l, V, Z, E, U — immer, unabhängig vom Status
- **Nicht löschbar**: R, r, G, g — generell gesperrt (R/r → nur Storno möglich, G/g sind Stornobelege)

### Tax-Auflösung

Volle Steuermatrix: `article.tax_class_id × address.tax_class_id × address.country_code → tax_rule (valid_from/valid_to) → tax_code.tax_rate`. Auflösung erfolgt eager im Artikel-Autocomplete-Response — zusammen mit der Preisauflösung in einem einzigen Server-Call. Der Aufruf bekommt `article_id + customer_id + document_date` als Kontext.

### Preis-Auflösung

`address.price_list_id → price_list_item` (Lookup auf Artikel + Gültigkeitsdatum). Kein Treffer → Feld leer, manuelle Eingabe. Preis und Steuer werden im selben Autocomplete-Call aufgelöst.

### Lager-Kaskade

`document_group.default_warehouse_id` → `document.warehouse_id` (überschreibbar) → `document_line.warehouse_id` (überschreibbar pro Zeile).

### Belegnummer-Vergabe

Wird bei Anlage (Draft) über die PL/pgSQL-Funktion `next_sequence_no` atomar vergeben. Lücken im Nummernkreis sind möglich wenn Drafts gelöscht werden — das ist für alle Belegtypen akzeptabel, da die buchungsrelevante Lückenfreiheit (bei Rechnungen) über das Storno-System (G als Gegenbuchung) sichergestellt wird, nicht durch Nummernlücken-Vermeidung.

### Frontend-Architektur

**Workspace-Routing**: Beleg-Listen werden über View-Identifier mit Typ und Gruppe kodiert: `?p=document-list:N:0`. Der `DocumentListAdapter` parst den Suffix und filtert serverseitig.

**Document Detail Pane**: Kein Modal-Dialog — dedizierte Detail-Pane im Workspace-Split. Voller vertikaler Raum für Header-Felder + Lines Editor + Kalkulationszeile. Aktionsbuttons (Buchen, Wandeln, Stornieren) im Pane-Header, statusabhängig sichtbar/ausgeblendet. Expliziter Save-Button (kein Auto-Save).

**DocumentLinesEditor**: Tabellarischer Editor mit einer Zeile pro Position. Artikel-Autocomplete löst in einem Call `net_price` + `tax_rate` + `tax_code_id` auf. Kommentarzeilen (ohne Artikel, nur Text) über "+ Kommentar"-Button. Mengen, Preise und Rabatte inline editierbar. Live-Kalkulation von `line_total_net`, `tax_amount`, Gesamtsummen.

**Sidebar-Erweiterung**: Dreistufiger Belegbaum (Warenausgang / Wareneingang / Lagerbuchungen). Lagerbuchungen standardmäßig eingeklappt. Dynamisch aus `document_type`-Metadata und `document_group`-Rows generiert.

**`childSection`-Prop auf `crud-dialog.tsx`**: Optionale Render-Prop `childSection?: (record) => ReactNode`, wird nach dem Formular im scrollbaren Dialog-Body gerendert (nur wenn Record vorhanden und nicht loading). Genutzt für:

- Artikel-Dialog: `InventoryBalanceTable` (Spalten: Lager, Bestand, Reserviert, Verfügbar; Reserviert = amber, Verfügbar = grün; Gesamt-Zeile wenn > 1 Lager)
- Adress-Dialog (nur wenn `is_customer = true`): `CustomerStatsSection` (letzte 10 Belege + Jahresumsätze; Jahresumsatz-Block nur wenn Daten vorhanden)

## Testing Decisions

Ein guter Test prüft das externe Verhalten eines Moduls — was kommt raus bei gegebenem Input — nicht wie es intern implementiert ist. Tests sollten keine privaten Hilfsfunktionen direkt aufrufen und nicht auf konkrete SQL-Strings prüfen.

### Module mit Tests

**Document Commands** (`document-commands.ts`):

- `createDocument`: Belegnummer wird vergeben, Status ist `draft`, Zeilen werden korrekt gespeichert
- `deleteDocument`: R/r/G/g werden abgelehnt, alle anderen Typen werden akzeptiert
- `convertDocument`: Quellbeleg wird `archived`, Zielbeleg hat gleiche Zeilen, `transaction_id` wird vererbt; `next_group_id`-Override wird korrekt angewendet
- `stornoDocument`: Nur für posted R/r; G bekommt `storno_document_id`, R bekommt `cancelled`; nicht-R-Typen werden abgelehnt

**Document Posting** (`document-posting.ts`):

- Idempotenz: bereits gebuchter Beleg → 409
- Stornierter Beleg → 409
- Für jeden Matrix-Eintrag: korrekte `inventory_balance`-Deltas nach dem Buchen
- V-Sonderfall: `on_hand_qty` wird auf Sollwert gesetzt, nicht addiert
- U-Sonderfall: zwei Lager-Upserts (Quelle −qty, Ziel +qty)
- b-Korrektheit: `expected_purchase_qty` wird erhöht (nicht `reserved_qty`)
- l-Korrektheit: `on_hand +qty` und `expected_purchase −qty` in einem Upsert

**`next_sequence_no` PL/pgSQL-Funktion**:

- Konkurrente Aufrufe erzeugen keine Duplikate (Concurrency-Test)
- Zähler wird korrekt hochgezählt, Ergebnis korrekt formatiert

**Prior Art**: `packages/domain/src/__tests__/commands.test.ts`, `queries.test.ts` — gleiche Vitest-Struktur, Tests gegen reale DB-Verbindung.

### Nicht getestet

- Frontend-Komponenten (DocumentLinesEditor, DetailPane)
- Server Functions (zu viel Integration-Surface)
- `InventoryBalanceTable`, `CustomerStatsSection` (reine Darstellungskomponenten)

## Out of Scope

- **Produktionsbelege** (q = Produktionsauftrag, p = Produktion Abgeschlossen) — eigener Slice
- **Zahlungsstatus** (`is_paid`, `paid_at`, `paid_amount`) — Payment-Tracking ist ein eigener Slice
- **Fibu-Integration** (`journal_entry`, `journal_line`) — Buchhaltungsintegration ist ein eigener Slice
- **Seriennummern-Tracking** (`serial_number`, `document_line_tracking`) — eigener Slice
- **Chargen-Tracking** (`batch_no`) — eigener Slice
- **Mehrere Wandlungsschritte gleichzeitig** (z.B. A direkt zu R ohne L) — nur Einzelschritte
- **Storno von L, A, b, l** — komplexere Lagerreversal-Logik; für diese Typen gilt Löschung als Korrektur
- **Fiskalperioden-Zuordnung** (`fiscal_period_id` in `fact_sales_event`) — wird vorerst null belassen
- **Rabattgruppen** (`discount_group`) — in diesem Slice nur manueller Rabatt per Zeile
- **Mehrwährungsbelege mit Kursdifferenzen** — Fremdwährung wird gespeichert, Kursrechnung out of scope
- **Druck / PDF-Export** — eigener Slice
- **E-Mail-Versand** — eigener Slice

## Further Notes

- **Postgres.js Numeric Handling**: Batch-Inserts mit numerischen Parametern können zu Parametervermischung führen. Zeilen werden deshalb sequenziell innerhalb einer Transaktion gespeichert.
- **`available_qty` ist keine Generated Column**: Obwohl semantisch ableitbar, wird `available_qty = on_hand_qty − reserved_qty` bei jedem Upsert explizit geschrieben. Das ist Absicht — eine Generated Column würde die Upsert-Performance bei der Buchungsmatrix verschlechtern.
- **V ist kein Delta-Typ**: Alle anderen Belegarten tragen Bewegungsmengen in den Zeilen. V trägt den Sollbestand. Der Delta wird erst zur Buchungszeit gegen den aktuellen `on_hand_qty` berechnet. Fehler hier erzeugen kumulative Saldenabweichungen.
- **Wandlungs-Archivierung**: Der Quellbeleg wird nach Wandlung auf `archived` gesetzt, nicht gelöscht. Die Belegkette bleibt über `parent_document_id` und `transaction_id` vollständig nachvollziehbar.
