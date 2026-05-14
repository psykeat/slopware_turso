# Slopware — Core Architecture

Dieses Dokument definiert die unveränderlichen Kernregeln der Plattform. Es beschreibt die Zielarchitektur für eine metadata-getriebene, mehrsprachige, split-panel-fähige Multi-Tenant-Business-Plattform mit modernisierter App-Schicht und bewusst erhaltenem datenbankzentriertem Kern.

## 1. Zielplattform

| Bereich                   | Ziel                                                                          |
| ------------------------- | ----------------------------------------------------------------------------- |
| Runtime & Package Manager | Node.js + pnpm Workspaces                                                     |
| App Runtime               | TanStack Start mit React, Vite, Middleware, Loadern, Server Functions und SSR |
| Styling                   | Tailwind v4 + modulare UI-Komponenten                                         |
| Identity & Session        | Better Auth                                                                   |
| Integration Service       | Always-on Node.js Service für Connectors, Staging und Cron-Scheduling         |
| Primäre Datenbank         | PostgreSQL 16+ / 17 / 18                                                      |
| SQL-Zugriff               | Typsichere SQL-Zugriffsschicht, z. B. Drizzle oder Kysely                     |
| Architekturprinzip        | App-modernisiert, aber datenbankzentriert                                     |

Slopware ist keine reine UI-Anwendung, sondern eine metadata-getriebene Multi-Tenant-Business-Plattform. Die wichtigsten Invarianten dürfen nicht nur in Frontend oder losem Server-Code existieren, sondern müssen in Datenmodell, Datenbankarchitektur und kontrollierten Domain-Modulen verankert sein.

Daraus folgen vier Grundsätze:

1. Die App darf modernisiert werden, ohne die Datenkernlogik zu entkoppeln.
2. Framework-Logik ersetzt keine DB-Invarianten.
3. Generische Plattformfunktionen wie Imports, Upserts, Metadata-Auflösung, Split-Panel-Workspaces und AI-gestützte Schreibpfade müssen auf einer robusten relationalen Basis aufsetzen.
4. Externe Integrationen laufen über einen isolierten Integration Service mit verschlüsselten Credentials und Staging-Pipeline.

## 2. Wenn du nur 5 Regeln liest

- PostgreSQL, Constraints, RLS und effektive Views bleiben die autoritative Wahrheit.
- Inter-Panel-Navigation läuft über Intents; Mutationen ausschließlich über Commands oder validierte Create/Patch/Upsert-Pfade.
- Generic-first: Neue fachliche Oberflächen nutzen zuerst `ListPanelAdapter`/`DetailPanelAdapter` + Grid (`components/grid/`) statt Spezial-UI.
- Spezialpanel sind Ausnahmefälle und müssen einen echten fachlichen oder ergonomischen Mehrwert haben.
- Bevor neue Registries, Metadatenachsen oder Paneltypen entstehen, muss zuerst geprüft werden, ob der bestehende Kern reicht.

## 3. Begriffe

- **Organization** = Besitz- und Rechteeinheit oberhalb eines oder mehrerer Tenants.
- **Tenant** = Isolations- und Rechteeinheit für Datenzugriff.
- **Company** = fachliche Untereinheit innerhalb eines Tenants.
- **Base Tenant** = systemweiter Sonder-Tenant für globale Metadaten; keine operativen Daten.
- **Metadata** = Felddefinitionen, Layouts, Rules, Settings, Registries und UI-nahe Konfiguration.
- **Schema Annotation** = Business-Namen, Beschreibungen und Data-Class-Metadaten für DB-Objekte.
- **Master Data** = änderbare fachliche Stammdaten, nicht hart löschbar (UI-Begriff: Deactivate/Archive).
- **Transaction Data** = fachliche Bewegungsdaten, nach Posting unveränderlich.
- **Derived Data** = rekonstruierbare Ableitungen aus Transaktionen.
- **Workspace** = adressierbarer Arbeitskontext innerhalb der App.
- **Panel** = standardisierte UI-Einheit innerhalb eines Workspaces, z. B. Liste, Detail, Baum, Lookup, Belegzeilen oder Editor.
- **Connector** = Externe Datenquelle/-senke (z. B. Shopify, XRechnung) mit Mapping und Staging.

## 4. Stabile System-Konstanten

Diese UUIDs sind systemweit festgelegt und dürfen nicht geändert werden:

| Konstante        | UUID                                   | Beschreibung                      |
| ---------------- | -------------------------------------- | --------------------------------- |
| `SYSTEM_ORG_ID`  | `00000000-0000-0000-0000-000000000001` | System-Organization               |
| `BASE_TENANT_ID` | `00000000-0000-0000-0000-000000000002` | Base Tenant für globale Metadaten |

## 5. Kerninvarianten

### K1 — PostgreSQL ist Source of Truth

Alle operativen Daten, Metadaten, Import-Staging-Daten und abgeleiteten Daten liegen primär in PostgreSQL. Die App darf keine alternative autoritative Persistenzschicht für Kernobjekte einführen.

### K2 — TanStack Start ist App-Runtime, nicht Datenkern

TanStack Start steuer Routing, Loader, SSR, Middleware, Server Functions, Pending-/Error-UI und Workspace-Komposition. TanStack Start ersetzt weder RLS noch Constraints noch effektive Metadata-Resolver.

### K3 — Better Auth ist Identity-Layer, nicht Fachrechtesystem

Better Auth verwaltet Session-Cookies, User Identity und Login-Flows. Tenant-Membership, Rollen, System-Admin-Kontext und fachliche Rechte bleiben Teil der eigenen Domänenschicht.

### K4 — Multi-Tenancy wird hart erzwungen

Tenant-Isolation wird auf Datenbank- und Server-Ebene erzwungen. Tenant-Kontext darf niemals frei aus Client-Body, Query-Parametern oder Workspace-Panel-State übernommen werden, außer in explizit geschützten System-Admin-Flows.

### K5 — RLS bleibt Pflicht für tenant-scoped Tabellen

Jede tenant-scoped Tabelle muss RLS aktiviert haben. Jede solche Tabelle benötigt passende Policies und mindestens einen Index auf `tenant_id`.

### K6 — Composite Tenant-Sicherheit bleibt erlaubt und gewünscht

Wo fachlich relevant, bleiben zusammengesetzte Schlüssel und Foreign Keys mit `tenant_id` Teil der Integritätsstrategie, um Cross-Tenant-Referenzen technisch zu verhindern.

### K7 — Effective Metadata bleibt die einzige gültige Sicht

Frontend, Backend, Imports und AI-Agenten lesen niemals rohe Metadata-Tabellen direkt. Konsumiert wird ausschließlich die aufgelöste effektive Sicht, insbesondere `effective_fields`, `effective_layout`, `effective_rules` und `effective_settings`.

### K8 — JSONB bleibt nur für klar begrenzte Erweiterungen erlaubt

JSONB ist erlaubt für i18n-Werte, Labels, Hilfetexte, optionale UI-Konfiguration, Rules, Layoutdaten und additive tenant-spezifische Zusatzattribute. JSONB ist nicht erlaubt für Kernbeziehungen, Posting-Logik, Rechte, Tenant-Isolation oder Statusmaschinen.

### K9 — Generische Plattformpfade bleiben Kernfunktion

Das System muss standardisierte Read-, Update-, Patch-, Upsert-, Import- und Command-Schnittstellen auf Tabellen- oder Entitätsebene unterstützen. Diese Pfade sind kein Ausnahmefall, sondern Kernfunktion der Plattform.

### K10 — Große Datenmengen sind ein Kern-Use-Case

Import großer Dateien, Massen-Upserts, Lookup-Listen, Virtualisierung großer Grid-Datenmengen und asynchrone Staging-Commit-Prozesse sind primäre Architekturziele. Die Plattform darf nicht auf kleine Einzelmutationen als dominantes Datenmodell optimiert werden.

### K11 — AI schreibt nie roh auf Tabellen

AI-gestützte Schreibzugriffe erfolgen ausschließlich über kontrollierte Domain-Commands, Registry-gesteuerte Table-Interfaces, Import-Pipelines oder Assistant-Services mit Tenant-, Rollen-, Validierungs- und Audit-Prüfung.

### K12 — Posting und Derived Data bleiben streng getrennt

Derived Data wie Lagerstände, Ledger oder Statistikfakten dürfen nur über definierte fachliche Posting- und Rebuild-Pfade entstehen. Direkte CRUD-Zugriffe auf Derived Data sind untersagt.

### K13 — Kein Hard Delete für Master Data

Hard Delete ist für fachliche Master Data plattformweit verboten; UI-Begriff ist Deactivate/Archive.

### K14 — Tracking-Vollständigkeit ist Posting-Bedingung

Wenn ein Artikel oder eine Beleggruppe Tracking (Seriennummern/Chargen) erfordert, muss die Erfassung vor dem Posting vollständig sein. Unvollständige Tracking-Daten verhindern das Posting (409).

### K15 — Integration-Credentials sind verschlüsselt

Credentials für externe Connectoren werden at-rest mit AES-256-GCM verschlüsselt. Der Klartext verlässt den Integration Service niemals in Richtung UI.

### K16 — Staging vor Posting für Imports

Externe Daten landen zunächst in `import_row` (Staging). Die Übernahme in den operativen Kern erfolgt erst nach Mapping und Validierung.

## 6. Lean Guardrails

- Keine neue Registry, wenn eine bestehende Konstante, Konfiguration oder Zuordnung ausreicht.
- Kein neues Spezialpanel, wenn die bestehenden Panel-Adapter (`ListPanelAdapter`, `DetailPanelAdapter`, `LinesPanelAdapter`) oder das Grid (`components/grid/`) genügen.
- Keine neue Metadata-Achse für einmalige fachliche Sonderfälle.
- Keine neue Entity, wenn ein gefilterter Workspace auf bestehender Entity denselben Zweck erfüllt.
- Keine parallelen generischen UI-Systeme neben dem festgelegten Standardpfad.

## 7. App- und UX-Architektur

Kerninvarianten: adressierbare split-panel Workspaces (1–3 Panes), URL-/Search-Param-getriebener State (bookmarkbar, reload-stabil), Inter-Panel-Navigation über Intents, Mutationen nur über Commands. Generic UI (`ListPanelAdapter`, `DetailPanelAdapter`, Grid `components/grid/`) ist Leitprinzip — Spezialpanels sind begründungspflichtige Ausnahmen. Mehrsprachigkeit über JSONB `{de, en}` in Metadaten-Labels und `i18n-string`-Feldtyp.

### View-Routing (Convention over Configuration)

Views folgen einer strikten Dateikonvention. Der View-Key `[prefix]:[suffix]` leitet den Dateipfad deterministisch ab:

```
views/[prefix]/[prefix]-[suffix]-view.tsx
```

Beispiele: `document:lines` → `views/document/document-lines-view.tsx`, `meta:admin` → `views/meta/meta-admin-view.tsx`.

Schlüsselmodule:

- **`view-registry.ts`** — `VIEW_REGISTRY` mit Feldern `key`, `kind: "generic"|"custom"|"dashboard"`, `entity?`, `panelType?` und Labels
- **`view-resolver.tsx`** — löst `key → React.ReactNode` per `import.meta.glob`; wirft Startup-Fehler für fehlende `kind: "custom"`-Dateien; rendert `EntityDataTable` generisch für `kind: "generic"`
- **`workspace-context.tsx`** — `WorkspaceContext` + `useWorkspaceContext()`; ersetzt Prop-Drilling in allen View-Komponenten
- **`workspace-presets.ts`** — Workspace-Presets (Layout, Panes) ausgelagert aus `workspace.tsx`

Alle Custom-Views sind `export default`-Komponenten ohne Props; State kommt ausschließlich über `useWorkspaceContext()`.

→ Vollständige Spezifikation: `.agents/02_workspace_architecture.md`, Implementierungsregeln: `.agents/04_implementation_patterns.md`

## 8. Schichtenmodell

### 8.1 App-Schicht

Die App-Schicht basiert auf TanStack Start. Sie enthält Routen, Layouts, Middleware, Loader, Server Functions, SSR, route-spezifische Pending-/Error-UI und die generische Business-Oberfläche.

Die App-Schicht orchestriert und rendert, aber sie ersetzt nicht den Domain-Layer.

### 8.2 Auth-Schicht

Better Auth liefert Sessions, Cookies und User Identity. Die aktive Locale, User-Session und grundlegende Anmeldung werden hier verankert. Tenant-Auswahl, Membership, Rollenmodell und System-Admin-Kontext werden darüber hinaus in der eigenen Domänenschicht geführt.

### 8.3 Integration-Schicht (Service)

Ein isolierter Node.js-Service verwaltet:

- Connector-Cron-Scheduling und manuelle Trigger.
- Staging-Pipeline (`import_batch`, `import_row`).
- Credential-Verschlüsselung.
- Kommunikation mit der Haupt-API via tenant-scoped JWT.

### 8.4 Domain-Schicht

Die Domain-Schicht ist die zentrale serverseitige Anwendungslogik. Sie ist frameworkarm und darf von UI, Jobs, Imports und AI gleichermaßen verwendet werden.

Sie enthält:

- `queries/*` — Read-Logik (`entity-read-service.ts`: listEntity, getEntityById)
- `commands/*` — Write-Logik (`entity-command-service.ts`: createEntity, patchEntity, deleteEntity, deactivateEntity)
- `entities/*` — Entity-Registry (`registry.ts`: ENTITY_REGISTRY Map + helpers)
- `lookups/*` — Lookup-Logik (`helper-table-service.ts`: listHelperTables, getHelperTableItems)
- `metadata/*` — Effective-Metadata-Zugriff (`effective-service.ts`: getEffectiveFields, etc.)
- `runtime/*` — SqlClient, withTenant, SYSTEM_ORG_ID, BASE_TENANT_ID (`tenant-runtime.ts`)

Zukünftig erweiterbar um: `posting/*`, `assistant/*`

### 8.5 Datenbank-Schicht

Die Datenbank-Schicht enthält:

- Tabellen
- RLS-Policies
- Constraints
- Indizes
- effektive Views
- ggf. Trigger/Funktionen für Kerninvarianten

Wesentliche Integritätsregeln gehören in diese Schicht und dürfen nicht ausschließlich in TypeScript validiert werden.

## 9. Tenant Isolation und Security

→ Implementierungsdetails (withTenant, SET LOCAL, Drizzle-Schema): `.agents/tenant-context.md`

### 9.1 Tenant-Kontext

Jeder tenantbezogene Zugriff läuft innerhalb eines expliziten Tenant-Kontexts. Dieser wird aus Session, Membership und serverseitiger Autorisierung abgeleitet.

### 9.2 Verbotene Muster

Folgende Muster sind verboten:

- `tenant_id` frei aus Client-Payload übernehmen
- direkte SQL-Operationen ohne Tenant-Wrapper
- rohe Metadaten ohne Resolver lesen
- globale Metadaten ohne Admin-Kontext ändern
- Cross-Tenant-FKs ohne Tenant-Schutz zulassen
- Panel- oder Drag-and-drop-Zustände als Autorisierungsquelle verwenden

### 9.3 Base Tenant

Der Base Tenant enthält ausschließlich globale Metadaten. Operative Daten sind dort untersagt. Tenant-spezifische und organisationsspezifische Overrides werden auf Runtime-Ebene über effektive Resolver zusammengeführt.

## 10. Metadata-Modell

Metadaten bleiben in drei Scopes organisiert:

- `global`
- `organization`
- `tenant`

Die Auflösung erfolgt hierarchisch nach Priorität. Der spezifischste Scope gewinnt pro Artefakt. Frontend, Backend, Imports und Agenten arbeiten nur gegen die effektive Sicht.

## 11. Imports und Integrationen

Importe bleiben ein eigenes Subsystem mit Staging-Architektur.

Kernobjekte und Prinzipien:

- `import_batch` als Batch-Kopf
- `import_row` als Staging-Zeile
- Connector-Definitionen und tenant-spezifische Connectoren
- Mapping auf Zieltabellen und Zielspalten
- Validierung vor Commit
- Atomicity-Modi auf Datei-, Entity- oder Run-Ebene

Große Dateien dürfen über asynchrone Jobs, Worker oder Batch-Verarbeitung verarbeitet werden. PostgreSQL bleibt auch hier die autoritative Persistenzschicht.

## 12. AI- und Assistant-Integration

AI-Agenten dürfen nicht direkt auf Tabellen schreiben. Erlaubte Muster sind:

- `assistant.table.create`
- `assistant.table.patch`
- `assistant.table.upsert`
- `assistant.import.stage`
- `assistant.command.run`

Diese Pfade validieren mindestens:

- Tenant-Kontext
- Rollen
- effektive Metadaten
- Feldtypen
- Pflichtfelder
- i18n-Regeln
- Schreibrechte
- Audit-Logging

## 13. Priorität der Wahrheit

Bei Widerspruch gilt folgende Priorität:

1. Diese Core Architecture
2. Datenbank-Schema, Constraints, RLS und effektive Views
3. Metadata Spec
4. Implementation Patterns (SOP)
5. Abgeleitete Dokumente, Agenten-Artefakte oder UI-Implementierungen
