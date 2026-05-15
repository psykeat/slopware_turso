# PRD: Firmenstamm & Einstellungen

## Problem Statement

Tenant-Administratoren haben keine strukturierte Möglichkeit, firmenstammbezogene Einstellungen (Firmenname, Adresse, Steuernummer, Bankverbindung etc.) sowie die 19 Stammdaten-Entitäten (Zahlungsbedingungen, Versandarten, Artikelgruppen, Länder usw.) direkt im Workspace zu verwalten. Der bestehende "Einstellungen"-Workspace ist ein Platzhalter ohne nutzbare Oberfläche. Die Settings-Entitäten sind weder im Entity-Registry registriert noch haben sie geseedete Felder in der Metadaten-Infrastruktur.

## Solution

Der "Einstellungen"-Workspace erhält eine dedizierte `SettingsView`-Komponente mit einem klassischen 2-Spalten-Layout: links eine gruppierte Sidebar-Navigation, rechts der jeweilige Content-Bereich.

- **Firmenstamm** (Firmenstammdaten) rendert als Inline-Formular via `CrudDialog` mit `inline={true}` im permanenten Edit-Modus auf der ersten aktiven `company`-Row des Tenants (Pseudo-Singleton).
- **Alle anderen 19 Entitäten** rendern als `DataTable` (direkt, ohne `ListPanelAdapter`) kombiniert mit `CrudDialog` für Create/Edit/Delete-Operationen.
- Die gesamte Formularinfrastruktur (Validator, Inline-Designer via Ctrl+Shift+F2, Tenant-Felder) bleibt unverändert wiederverwendet.

## User Stories

1. Als Tenant-Administrator möchte ich den Firmennamen, die Adresse und die Steuernummer direkt im Einstellungen-Workspace bearbeiten, ohne ein modales Overlay öffnen zu müssen.
2. Als Tenant-Administrator möchte ich Bankverbindungsdaten (IBAN, BIC, Bankname) meiner Firma hinterlegen, damit diese auf Ausgangsbelegen erscheinen.
3. Als Tenant-Administrator möchte ich die Zahlungsbedingungen (z.B. „Netto 30 Tage") verwalten, damit sie auf Belegen und Kunden-Stammdaten auswählbar sind.
4. Als Tenant-Administrator möchte ich Versandarten anlegen und bearbeiten, damit sie im Verkaufsprozess zugeordnet werden können.
5. Als Tenant-Administrator möchte ich Preislisten verwalten, damit unterschiedliche Preisstrukturen für Kundengruppen abgebildet werden.
6. Als Tenant-Administrator möchte ich Rabattgruppen anlegen, damit Mengen- oder Kundenrabatte strukturiert hinterlegt werden.
7. Als Tenant-Administrator möchte ich Adresskategorien verwalten (z.B. Kunde, Lieferant, Interessent).
8. Als Tenant-Administrator möchte ich Beleggruppen anlegen, damit Belege kategorisiert werden können.
9. Als Tenant-Administrator möchte ich Branchen-Stammdaten verwalten, die Adressen zugeordnet werden.
10. Als Tenant-Administrator möchte ich Einheiten (kg, Stück, Liter) verwalten, damit Artikel und Belege korrekt berechnet werden.
11. Als Tenant-Administrator möchte ich Artikelgruppen anlegen und bearbeiten.
12. Als Tenant-Administrator möchte ich Lagerorte verwalten, die im Lagerprozess verwendet werden.
13. Als Tenant-Administrator möchte ich Steuerklassen definieren, die Artikeln zugewiesen werden.
14. Als Tenant-Administrator möchte ich Steuerschlüssel anlegen (z.B. USt 20%, USt 10%), die Steuerklassen zugeordnet werden.
15. Als Tenant-Administrator möchte ich Kostenstellen verwalten, damit Buchungen und Belege zugeordnet werden können.
16. Als Tenant-Administrator möchte ich Sachkonten (GL-Konten) anlegen und bearbeiten.
17. Als Tenant-Administrator möchte ich Währungen verwalten, damit internationale Belege korrekt verarbeitet werden.
18. Als Tenant-Administrator möchte ich Länderstammdaten einsehen und ergänzen.
19. Als Tenant-Administrator möchte ich das PLZ-Ort-Verzeichnis einsehen und pflegen.
20. Als Tenant-Administrator möchte ich Nummernkreise (für Belege, Artikel, Adressen) konfigurieren.
21. Als Tenant-Administrator möchte ich über eine strukturierte Sidebar-Navigation zwischen den Settings-Bereichen wechseln, ohne den Workspace verlassen zu müssen.
22. Als Tenant-Administrator möchte ich, dass die Sidebar nach thematischen Gruppen gegliedert ist (Organisation, Vertrieb, Lager & Artikel, Finanzen, Geodaten), damit ich schnell den richtigen Bereich finde.
23. Als Tenant-Administrator möchte ich beim Firmenstamm-Formular Felder in thematischen Sektionen sehen (Allgemein, Adresse, Steuer & Zoll, Bank), damit das Formular übersichtlich bleibt.
24. Als Power-User möchte ich im Inline-Designer-Modus (Ctrl+Shift+F2) Felder der Settings-Entitäten ein-/ausblenden und Tenant-spezifische Felder hinzufügen.
25. Als Entwickler möchte ich, dass alle Settings-Entitäten über dieselbe `CrudDialog`- und `DataTable`-Infrastruktur bedient werden, damit Bugfixes und Erweiterungen zentral wirken.

## Implementation Decisions

### 1. SettingsView — dediziertes Custom-View

`SettingsView` ist eine eigenständige React-Komponente mit internem 2-Spalten-Layout. Sie ist nicht Teil des generischen Panel/Pane-Systems, sondern wird direkt im "Einstellungen"-Workspace gerendert. Die Komponente managed ihren eigenen State: welche Entität gerade selektiert ist.

### 2. CrudDialog — `inline` Prop

`CrudDialog` erhält eine optionale `inline`-Prop (boolean). Wenn `inline={true}`:

- Kein `fixed inset-0` Overlay-Wrapper, kein Backdrop
- Kein Cancel-Button
- Rendert direkt im umgebenden Container-Fluss
- Alle anderen Mechanismen bleiben identisch: Validator, Inline-Designer, Tenant-Felder, Mutationen

### 3. Firmenstamm — Pseudo-Singleton

Der Firmenstamm zeigt kein separates `CrudDialog` modal, sondern ein permanentes Inline-Formular (`inline={true}`, `mode="edit"`) auf der ersten aktiven `company`-Row des aktuellen Tenants. Es gibt keinen "Neu"-Button. Der Unique-Constraint in der DB liegt auf `(tenant_id, company_id)`, nicht auf `tenant_id` allein — das Datenmodell unterstützt Multi-Company, die UI abstrahiert das als Singleton.

Das Formular ist in vier Sektionen gegliedert (keine Tabs):

- **Allgemein**: Name, Legal Name, Company No, E-Mail, Homepage, Telefon, Mobilnummer, GLN, EORI, DUNS
- **Adresse**: Adresszeile 1 & 2, PLZ, Ort, Ländercode
- **Steuer & Zoll**: Steuernummer, Steueramt, USt-ID, Geschäftsjahresbeginn, Währung
- **Bank**: Bankname, IBAN, BIC

### 4. Entity Registry — Erweiterung

`ENTITY_REGISTRY` in `workspace.tsx` erhält zwei neue optionale Felder:

- `category?: "settings"` — markiert Settings-Entitäten
- `group?: "organisation" | "vertrieb" | "lager_artikel" | "finanzen" | "geodaten"` — steuert Sidebar-Gruppierung

Die 20 Settings-Entitäten werden eingetragen. Sidebar-Reihenfolge der Gruppen ist fix: Organisation → Vertrieb → Lager & Artikel → Finanzen → Geodaten.

**Entity-zu-DB-Tabelle-Mapping:**

| Sidebar-Label       | Entity Key         | DB-Tabelle         |
| ------------------- | ------------------ | ------------------ |
| Firmenstamm         | `company`          | `company`          |
| Bankverbindungen    | `bank_account`     | `bank_account`     |
| Nummernkreise       | `number_sequence`  | `number_sequence`  |
| Zahlungsbedingungen | `payment_term`     | `payment_term`     |
| Versandarten        | `shipping_method`  | `shipping_method`  |
| Preislisten         | `price_list`       | `price_list`       |
| Rabattgruppen       | `discount_group`   | `discount_group`   |
| Adresskategorien    | `address_category` | `address_category` |
| Beleggruppen        | `document_group`   | `document_group`   |
| Branchen            | `industry`         | `industry`         |
| Einheiten           | `unit`             | `unit`             |
| Artikelgruppen      | `article_group`    | `article_group`    |
| Lagerorte           | `warehouse`        | `warehouse`        |
| Steuerklassen       | `tax_class`        | `tax_class`        |
| Steuerschlüssel     | `tax_code`         | `tax_code`         |
| Kostenstellen       | `cost_center`      | `cost_center`      |
| Sachkonten          | `gl_account`       | `gl_account`       |
| Währungen           | `currency`         | `currency`         |
| Länder              | `country`          | `country`          |
| PLZ-Ort Verzeichnis | `postal_code`      | `postal_code`      |

### 5. Listen-Entities — DataTable direkt

Für alle nicht-singleton Settings-Entitäten rendert `SettingsView` direkt `EntityDataTable` + `CrudDialog` (modal, kein inline). Kein `ListPanelAdapter`, kein Intent-Dispatch. State (Sorting, Pagination, Dialog-Mode) lebt lokal in `SettingsView` oder einem dedizierten `SettingsListContent`-Subkomponent.

### 6. DB-Migration — Effective Fields seeden

Eine neue Drizzle-Migration seedet die Basis-Felder für alle 20 Settings-Entitäten in `tenant_fields` mit `tenant_id = BASE_TENANT_ID` (globale Defaults). Für jede Entität werden alle relevanten DB-Spalten als visible Fields angelegt. Nach dem Seeden sind die Felder vollständig via Inline-Designer konfigurierbar (Visibility, Label, Reihenfolge, Tenant-spezifische Zusatzfelder).

### 7. Workspace-Routing

Das "Einstellungen"-Workspace in `workspace.tsx` bekommt seine Default-View von `setting:list` auf `settings:main` umgestellt. `settings:main` ist der View-Key der neuen `SettingsView`. Der selektierte Settings-Bereich (z.B. `company`, `payment_term`) wird als Sub-State innerhalb von `SettingsView` verwaltet — nicht als URL-Parameter.

## Testing Decisions

**Was gute Tests auszeichnet:** Tests validieren externes Verhalten (was der User sieht und kann), nicht Implementation Details (interne State-Variablen, Komponentenstruktur). Ein guter Test beschreibt eine User Story, keine Code-Zeile.

**Module mit Tests:**

- **DB-Migration / Seeding**: Verifizieren dass nach der Migration alle 20 Entitäten mit ihren erwarteten Feldern in `tenant_fields` vorhanden sind. Prior art: `packages/domain/src/__tests__/`.
- **CrudDialog `inline` Prop**: Unit-Test dass bei `inline={true}` kein Overlay-Wrapper im DOM ist, bei `inline={false}` schon.
- **Firmenstamm Pseudo-Singleton**: Integrations-Test dass `SettingsView` mit Entity `company` exakt eine Row lädt (erste aktive) und ein Formular im Edit-Modus rendert — kein Create-Button.

**Kein Test nötig für:** `SettingsView` Sidebar-Rendering (reine Konfigurationslogik), Entity-Registry-Einträge (statische Daten).

## Out of Scope

- Multi-Company-Verwaltung (mehrere Firmen pro Tenant in der UI auswählbar)
- Mahnwesen / Dunning-Levels (separates Feature)
- Logo-Upload für Firmenstamm
- Steuerregel-Konfiguration (`tax_rule`, `account_determination_rule`)
- Fiskalperioden-Verwaltung
- Incoterms-Stammdaten
- Import/Export von Settings-Daten

## Further Notes

- `company` hat keinen Unique-Constraint auf `tenant_id` allein — die Pseudo-Singleton-Logik (`ORDER BY created_at LIMIT 1 WHERE is_active = true`) muss serverseitig in `entity-ops.server.ts` als Spezialfall behandelt werden, damit der richtige Record gepatch wird.
- Länder und PLZ-Ort-Verzeichnis sind global vorbesetzt (via `SYSTEM_ORG_ID`-Seeding). Tenants können einträge hinzufügen, aber die globalen Einträge sind read-only (RLS-Policy).
- Der Inline-Designer ist per Tastenkürzel (Ctrl+Shift+F2) zugänglich — das muss auch im Inline-Modus funktionieren.
- Die `--sw-*` Design-Token-Konventionen gelten auch für `SettingsView` — keine Tailwind-Klassen innerhalb von `.sw-root`.
