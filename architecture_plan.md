# Basisdokumentation: Turso DB + TanStack Start ERP

## Zielbild

Diese Basisdokumentation beschreibt einen schlanken, agentennahen Architekturansatz für ein komplexes Geschäftsprojekt auf Basis von **Turso DB** und **TanStack Start**. Ziel ist eine zentrale, konsistente und für Menschen wie KI-Agenten gut nutzbare Struktur für Implementierung, Dokumentation, Tests und Weiterentwicklung.

Der Fokus liegt auf folgenden Anforderungen:

- multi-tenantfähige Geschäftslogik (physische Trennung per Turso-Group/Database-per-Tenant),
- metadata- und registry-getriebene Oberflächen (TypeScript-first),
- datenbanknahe Posting- und Statistiklogik (Immutable Ledger),
- agentennahe Entwicklung mit möglichst wenig verteiltem Kontext,
- niedrige Dokumentations- und Exploration-Kosten.

---

## Architekturprinzipien

### Ein Modell, mehrere Projektionen

Fachobjekte wie `address`, `article`, `document` und `documentLine` werden nur **einmal fachlich beschrieben** (in der Metadaten-Registry). Daraus werden verschiedene Interfaces abgeleitet:

- CRUD-API,
- Masken & Formulare (TanStack Form),
- Tabellenansichten (TanStack Table),
- Lookup-Dialoge,
- Import-/Export-Mappings,
- Zod-Validierungsschemata,
- Testfälle,
- agentennahe Capability-Endpunkte.

Das Ziel ist, Schemainformationen nicht mehrfach in Backend, Frontend, Tests und KI-Tools zu duplizieren.

### Registry- und Metadaten-Ansatz (TypeScript-first)

Das System basiert auf einer zentralen Registry mit Metadaten für:

- Entities,
- Felder & Feldtypen,
- Relationen,
- Projektionen (`list`, `form`, `lookup`, `api`),
- Capabilities/Aktionen,
- tenant-spezifische Overlays,
- Testspezifikationen.

Dadurch können UI, API und Agenten-Tools dieselben Kerninformationen nutzen.

#### Beispiel-Struktur für die Registry:

```typescript
// packages/registry/src/types.ts
export interface FieldDefinition<T = any> {
  name: string;
  label: string;
  type: "string" | "number" | "date" | "boolean" | "json";
  required: boolean;
  projections: {
    list: { visible: boolean; sortable: boolean };
    form: { component: string; readOnly?: boolean; validation?: any };
    lookup: { searchKey: boolean };
    api: { exposed: boolean };
    ai: { description: string; extractable: boolean };
  };
}

export interface EntityDefinition {
  name: string;
  pluralName: string;
  fields: FieldDefinition[];
  relations?: Record<string, { type: "one" | "many"; target: string }>;
}
```

---

## Wahl des Technologiepfads

### Warum Turso DB

Turso ist ideal für diesen Ansatz, weil es mehrere Eigenschaften kombiniert:

- **SQLite-nahe Einfachheit** bei extrem hoher Performance und niedriger Latenz.
- **Physical Multi-Tenancy (Database-per-Tenant)** über Turso Groups.
- **Scale-to-Zero**: Inaktive Tenant-Datenbanken kosten keinen RAM im Leerlauf.
- **Zentraler Knowledge-Layer**: SQLite's native Vector-Extensions ermöglichen die Speicherung von Embeddings, AI-Memory und Caches direkt in der Tenant-DB.
- **Konfigurationspflicht für Latenz & Sperren**: Zur Absicherung von concurrent writes (z. B. Webshop-Importe parallel zu LLM-Aktionen) muss zwingend ein `busy_timeout` von mindestens 5.000 ms im libSQL-Client konfiguriert werden.

### Warum TanStack Start

TanStack Start passt hervorragend, weil die Anwendung stark TypeScript-zentriert gedacht ist und ein sauberer Full-Stack-Ansatz benötigt wird:

- klare Route- und Loader-Strukturen,
- typisierte Server-Funktionen für die Agenten-API,
- enge Kopplung zwischen UI, Datenzugriff und Geschäftslogik,
- komponentenbasierte Oberflächen mit wiederverwendbaren Masken- und Tabellenbausteinen auf Basis der Registry.

---

## Multi-Tenant-Ansatz (Physical Isolation)

Wir setzen primär auf die physische Trennung über **Database-per-Tenant (Turso Groups)** mit einer zentralen Konfigurationsdatenbank:

1. **Zentrale Konfigurations-Datenbank**:
   - Speichert globale Metadaten, Mandantenverzeichnis, globale Registry-Overlays, User-Credentials und Routing-Informationen (welcher Tenant verweist auf welche Turso-DB-URL).
2. **Mandanten-Datenbanken (Tenant DBs)**:
   - Jeder Mandant besitzt eine eigene physikalische libSQL/SQLite-Datenbank.
   - Alle Mandanten-DBs befinden sich in einer Turso-Group und teilen sich dasselbe Basisschema.
   - Dynamische DB-Verbindungsauswahl im API-Gateway / TanStack Start Loader per Tenant-ID (z. B. aus Subdomain oder Header).

---

## Datenmodell und Erweiterbarkeit

### Stabile Kernfelder plus Erweiterungsbereiche

Für Kerntabellen gilt:

- feste Spalten für IDs, Status, Referenzen, Datumswerte, Mengen, Preise und alle relevanten Filter- oder Join-Felder,
- ein kontrollierter Erweiterungsbereich für tenant- oder kundenspezifische Zusatzfelder (über JSON-Spalten oder dynamisch generierte Spalten),
- Metadaten in der Registry, die diese Felder für Formulare, Tabellen, API und Agenten beschreiben.

### Drizzle SQLite Bulk-Schreiblimit (Best Practice)

SQLite/libSQL limitiert die Anzahl der maximalen SQL-Variablen in einem Statement (`SQLITE_LIMIT_VARIABLE_NUMBER`, standardmäßig max. 32.766).
Bei der Nutzung von Drizzle-Bulk-Inserts (`db.insert().values()`) müssen Datensätze daher in Chunks von **maximal 2.000 Zeilen** aufgeteilt werden, um Abstürze zu verhindern (2.000 Zeilen × Spaltenanzahl < Limit).

---

## Posting- und Ledger-Logik (Immutable Ledger)

### Grundprinzip

Eine Belegzeile ist **nicht** selbst die Buchung. Stattdessen erzeugt eine Posting-Logik aus fachlichen Vorgängen unveränderliche Buchungszeilen.

- `document` und `documentLine` als fachliche Quelle,
- `posting_batch` als Verbuchungseinheit,
- `posting_entry` als unveränderliche Ledger-/Journal-Zeile,
- Statistik- und Exportsichten als Projektionen daraus.

### Unveränderlichkeit (Immutability)

Bereits verbuchte Zeilen werden nicht physisch gelöscht oder geändert.

- Änderungen erfolgen ausschließlich über Stornierungen und Gegenbuchungen.
- Durchsetzung über SQLite Triggers (Datenbankschutzklausel):
  ```sql
  CREATE TRIGGER lock_ledger_entries
  BEFORE UPDATE OR DELETE ON posting_entry
  BEGIN
      SELECT RAISE(ABORT, 'Ledger entries are immutable');
  END;
  ```

### Statistik-Views und Materialisierung

Da komplexe Berechnungen (z.B. Lagerbestände, Umsätze) nicht ad hoc bei jedem Request berechnet werden sollen, nutzen wir:

- **Inkrementelle Materialisierung per Trigger**: SQLite-Trigger aktualisieren aggregierte Zustandstabellen (z.B. `inventory_balance`) bei jedem Insert in `posting_entry` atomar und extrem performant.
- Sobald stabil verfügbar, Migration auf native **libSQL Live Materialized Views** mit **Incremental View Maintenance (IVM)**.

#### Pragmatismus: Index-First vor Materialisierung

Unsere Benchmarks zeigen:

- Ein gut gesetzter Index (`CREATE INDEX`) ermöglicht ad-hoc Aggregationen (`SUM()`) auf SQLite-Ebene bis 50.000 Zeilen in unter **5 ms**.
- Materialisierung (Trigger) verbessert dies auf **< 1 ms**, erzeugt aber beim Schreiben einen **Overhead von ca. 43%** (Schreib-Performance halbiert sich fast).
- **Entwurfs-Regel**: Zuerst auf Indizes setzen. Materialisierung per Trigger erst dann einführen, wenn das Lese-Volumen extrem hoch ist oder die Datenmenge pro SKU 50.000 Zeilen dauerhaft überschreitet.

---

## Agentennahe Wissensarchitektur

Turso dient als Knowledge Layer für KI-Agenten:

- **Code Indexing**: Semantische Suche über Code-Strukturen und Dokumentation mittels libSQL Vector Search.
- **AI Memory**: Persistente, kontextbezogene Erinnerungen des Agenten direkt in der Tenant-Datenbank.
- **Content Caching**: Hash-basierte Datei-Speicherung zur Reduzierung von Lese- und Tokenkosten.

---

## Empfohlene Projektstruktur im Monorepo

```text
/home/joerg/erp/
  ├── apps/
  │    └── web/                  # TanStack Start Web-Anwendung (Routing, UI, Pages)
  ├── packages/
  │    ├── db/                   # Turso / Drizzle Konfiguration, Schemata und Migrationen
  │    ├── registry/             # Zentrales Metadaten- und Projektions-System
  │    ├── business/             # Kernlogik (Posting-Engine, Validierungen, Berechnungen)
  │    └── ui/                   # Gemeinsame Primitives, Tabellen- & Formulargeneratoren
  ├── docs/                      # Zentrales Wissens-Repository
  │    ├── adr/                  # Architecture Decision Records
  │    └── domain/               # Domänenmodelle & Fachkonzepte
  └── AGENTS.md                  # Einstiegspunkt und Verhaltensregeln für KI-Agenten
```

---

## Agentenfreundliche API

Anstelle von direktem SQL-Zugriff interagieren Agenten über fachliche Capabilities (TanStack Start Server Functions):

- `discoverEntities()`: Listet verfügbare Entitäten und deren Metadaten auf.
- `resolveProjection(entity, type)`: Liefert die Definition für Formulare, Tabellen oder Lookups.
- `validatePayload(entity, payload)`: Prüft Daten vor dem Speichern.
- `executeAction(action, payload)`: Führt ERP-Geschäftslogik aus (z.B. Beleg buchen).
- `explainConstraint(errorId)`: Erklärt fachliche Fehlerursachen.
- `generateFixture(entity)`: Erzeugt synthetische Testdaten.

---

## Das ideale Metamodell (TypeScript-first DSL)

Als zentrale _Single Source of Truth_ (SSOT) des ERP-Systems dient ein deklaratives, TypeScript-basiertes Metamodell. Es ersetzt redundante JSON-Konfigurationen und relationale Datenbank-Datensätze vollständig.

### Die 6 Schichten des Metamodells

1. **Entity**: Globale Tabellenmetadaten (z. B. Name, Schlüssel, Mandantenbindung, Versionierung, Soft-Delete-Strategie).
2. **Fields**: Feld-Definitionen (Feldtyp, Pflichtfeld, Standardwerte, Lookups, Indizes, UI-Formatierung, Zod-Validierung).
3. **Relations**: Beziehungen zwischen Entitäten (z. B. `belongsTo`, `hasMany`, hierarchische Baumstrukturen, Beleg-zu-Zeilen-Kaskaden).
4. **Behaviors**: Geschäfts- und Zustandslogik (Finite State Machines (FSM), Buchungs-Trigger, LLM-Extraktionsregeln).
5. **UI (Projektionen)**: Deklarative Layouts für Masken, Tabellenspalten, Filter und Detailansichten.
6. **Tests**: Generische, automatisch generierte Testfälle (CRUD-Tests, Zod-Fehlerszenarien, Validierungs-Smoke-Tests), die das Metamodell zur Laufzeit ausliest.

### Vorteile dieses Ansatzes

- **Keine Redundanz**: Einmal definieren → automatische Generierung von Drizzle-Schemata, Zod-Validierern, UI-Elementen und Testfällen.
- **Volle Typensicherheit**: TypeScript-Features (Auto-Complete, Type-Checking) fangen Syntaxfehler im Compiler ab.
- **Kontext-Reduzierung für KI-Agenten**: Ein LLM liest zur Aufgabenbearbeitung ausschließlich die kompakte Definitionsdatei (z. B. `article.ts`) ein und erfasst sofort das gesamte Verhalten der Entität. Dies spart bis zu 90 % der Tokenkosten und verhindert agentische Falschprogrammierungen.

---

## Migrationsstatus: Postgres → Turso (Stand 2026-06-21)

### ✅ Abgeschlossen

- SQLite-Schema wird aus `app.schema.ts` generiert → `packages/db/src/schema/sqlite.schema.ts`
- `tenantId`, `tenant_id`, RLS-Policies und SQLite-inkompatible Defaults sind aus SQLite-Schema und SQLite-Migrationen entfernt
- `DataService` — Constructor ohne Parameter, keine Tenant-Filter, kein `tenantId` in Inserts
- `runEntityList` — `tenantId` Parameter entfernt, alle ~30 Capability-Module aktualisiert
- `document-service.ts` — alle privaten Hilfsfunktionen tenant-frei (7 Funktionen, 14 Call-Sites)
- Capability-Execution ohne Capability-RLS-Logik
- Capability-Module importieren `sqlite.schema.ts` statt `app.schema.ts`
- Registry und SDK neu generiert
- `@repo/db` TypeScript-Check: 0 Fehler

### 🔄 Verbleibende Restposten

- Public API `DocumentService`-Methodensignaturen: `tenantId: string` ist noch als erster Parameter vorhanden (wird intern nicht mehr für SQL genutzt, aber die öffentliche Signatur ist noch nicht bereinigt)
- `apps/web` Legacy-API-Routen: noch auf Postgres-Pfad (siehe Triage unten)
- `apps/web/src/routes/api/ai/$.ts`: AI-Memory/Session-Filter noch mit `eq(col.tenantId, ...)` — zukünftig zu bereinigen

---

## Web-Routen: tenantId-Triage

### Kategorie A — Routing-/Sitzungskontext (kein Handlungsbedarf)

Diese Routen verwenden `tenantId` ausschließlich als **Routing-Schlüssel** zur DB-Verbindungsauswahl oder als Sitzungs-Kontext. Das ist der korrekte Turso-Ansatz — `tenantId` wählt die Datenbankverbindung, nicht den SQL-Filter.

| Route                         | Verwendung                                                  |
| ----------------------------- | ----------------------------------------------------------- |
| `routes/_auth/app/route.tsx`  | UI: Tenant-Switcher, `tenantId` als Session-Key             |
| `routes/api/active-tenant.ts` | Setzt Tenant-Cookie für Datenbankrouting                    |
| `lib/capability-auth.ts`      | `ExecutionContext.tenantId` — Capability-Kontext-Weitergabe |
| `routes/api/ai/chat.ts`       | `ctx.tenantId` → LLM-Config-Lookup (korrekt)                |
| `routes/api/ai/execute.ts`    | `ctx.tenantId` → LLM-Config-Lookup (korrekt)                |
| `routes/api/me.ts`            | Tenant-Info für Sitzung                                     |
| `routes/api/tenants.ts`       | Tenant-Listing                                              |

### Kategorie B — Postgres-Legacy-Routen (werden mit Routenmigration ersetzt)

Diese Routen importieren `@repo/db/schema` (Postgres-Schema) und filtern aktiv mit `eq(col.tenantId, ...)`. Sie laufen weiterhin auf dem Postgres-Pfad und blockieren aktuell nichts. Die tenantId-Filter sind dort bis zur vollständigen Routenmigration auf Turso-Capabilities korrekt und notwendig.

| Route                                                 | Zeilen mit Tenant-Filter                 |
| ----------------------------------------------------- | ---------------------------------------- |
| `routes/api/articles/$articleId/bom.ts`               | 4                                        |
| `routes/api/articles/$articleId/bom/$bomId.ts`        | 2                                        |
| `routes/api/articles/$articleId/images.ts`            | 4                                        |
| `routes/api/articles/$articleId/batches.ts`           | 1                                        |
| `routes/api/articles/$articleId/serial-numbers.ts`    | 1                                        |
| `routes/api/articles/$articleId/pricing.ts`           | —                                        |
| `routes/api/admin/document-groups/index.ts`           | 2                                        |
| `routes/api/admin/document-groups/$id.ts`             | 4                                        |
| `routes/api/delivery-addresses/$deliveryAddressId.ts` | 2                                        |
| `routes/api/me/company.ts`                            | 1                                        |
| `routes/api/setup/initialize.ts`                      | 1                                        |
| `routes/api/setup/year-end.ts`                        | 3                                        |
| `routes/api/stats/dashboard.ts`                       | 2                                        |
| `routes/api/stats/address/$addressId.ts`              | 1                                        |
| `routes/api/stats/addresses.ts`                       | —                                        |
| `routes/api/stats/article/$articleId.ts`              | —                                        |
| `routes/api/stats/articles.ts`                        | —                                        |
| `routes/api/metadata/$.ts`                            | 1                                        |
| `routes/api/import/bueroware/upload.ts`               | —                                        |
| `routes/api/import/profiles/$profileId/bootstrap.ts`  | —                                        |
| `routes/api/shopware/webhook.ts`                      | —                                        |
| `routes/api/storage/article-images/$imageId.ts`       | —                                        |
| `routes/api/documents/$documentId/print.tsx`          | —                                        |
| `routes/api/admin/data/$.ts`                          | Postgres-Admin-Route (Tenant-Management) |

**Migrationspfad:** Diese Routen werden schrittweise durch Capability-Aufrufe (`executeAction`, `runEntityList` etc.) ersetzt. Der Tenant-Filter entfällt automatisch, wenn die Route auf die Capability-Runtime umgestellt wird.

### Kategorie C — Turso-native Tabellen, noch mit tenantId-Filtern (⚠️ zu bereinigen)

`routes/api/ai/$.ts` enthält **sowohl** legitimes Routing-`tenantId` (LLM-Config, Sitzungskontext) **als auch** aktive SQL-Filter auf Turso-nativen Tabellen (`aiMemory`, `aiSession`, `emailThread`, `emailMessage`, `tenantLlmConfig`, `article`). Diese Filter sind mit dem Database-per-Tenant-Ansatz redundant und müssen bereinigt werden.

Betroffene Stellen in `routes/api/ai/$.ts`:

```
L133   eq(tenantLlmConfig.tenantId, tenantId)
L250   eq(emailThread.tenantId, tenantId)
L262   eq(emailMessage.tenantId, tenantId)
L292   eq(aiMemory.tenantId, tenantId)
L343   eq(aiSession.tenantId, tenantId)
L495   eq(company.tenantId, tenantId)
L505   eq(tenantLlmConfig.tenantId, tenantId)
L636   eq(company.tenantId, tenantId)
L813   eq(emailThread.tenantId, tenantId)
L1343  eq(article.tenantId, tenantId)
L1496  eq(aiMemory.tenantId, tenantId)
L1515  eq(aiMemory.tenantId, tenantId)
L1597  eq(aiMemory.tenantId, tenantId)
```
