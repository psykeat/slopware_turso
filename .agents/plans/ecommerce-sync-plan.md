# E-Commerce Sync & Variant Stabilization Plan

**Status:** Validiert gegen aktuelle Codebase (`db/src/schema/app.schema.ts` und `db/src/services/article-variant-generator.ts`). Entities wie `articleVariant`, `externalSyncMapping`, und `connectorDefinition` existieren bereits als Basis.

Dieser Plan überführt das vorgeschlagene Feature-Slice-Modell in eine flache Übersicht von vertikalen Issues, bereit zur Umsetzung. Die Issues folgen den Vorgaben des `to-issues` Skills (HITL/AFK Kategorisierung, Akzeptanzkriterien, Abhängigkeiten), ohne Epic- oder Milestone-Hülle.

---

## Slice 1: Variant Domain Hardening

- **Kategorie:** `AFK`
- **What:** Produktivsetzung der Varianten-Implementierung durch Backfills, Constraints und Idempotenz-Sicherstellung.
- **Acceptance Criteria:**
  - [ ] Default-Varianten-Backfill ist abgeschlossen (kein Artikel ohne Variante).
  - [ ] DB-Constraints für `document_line`, Preise und Lager auf `variant_id` sind aktiv.
  - [ ] Hard-Delete-Guards und Archivierungslogik (`archived: true`) sind finalisiert.
  - [ ] Idempotenz-/Concurrency-Tests für den Variantengenerator laufen erfolgreich (keine Dubletten).
- **Blocked by:** Keine

## Slice 2: UI Registration & Generic Integration

- **Kategorie:** `HITL` (wegen UI/UX Review)
- **What:** Einhängen der Varianten-Entities in die Plattform-Architektur.
- **Acceptance Criteria:**
  - [ ] Helper-Registry-/Introspection-Einträge für `article_variant`, `article_option`, `article_option_value`, `inventory_item`, `inventory_level` sind vorhanden.
  - [ ] Lookup-Anzeigen zeigen `sku` + `option summary` + `stock` anstatt UUIDs.
  - [ ] Commands (`generateVariants`, `archiveVariants`, `suggestVariantSkus`, `bulkUpdateVariantPrices`) sind registriert und in ActionBar/Lookups kontextsensitiv verfügbar.
  - [ ] Artikelmodul und Belegeditor nutzen die finalen Standard-Komponentenverdrahtungen.
- **Blocked by:** Slice 1

## Slice 3: Operational Model Cleanup

- **Kategorie:** `AFK`
- **What:** Migration von artikelzentrierten Altpfaden auf variantenzentrierte Logik.
- **Acceptance Criteria:**
  - [ ] `document_line` ist vollständig variant-aware.
  - [ ] `price_list_item` ist auf `variant_id` umgestellt.
  - [ ] Bestandslogik ist von `articleid` auf `inventory_item`/Variante migriert.
  - [ ] Reporting-Tabellen (`factsalesevent`) sind um `variant_id` erweitert.
  - [ ] Legacy-Fallbacks sind markiert/entfernt, neue Writes gehen über Variantenanker.
- **Blocked by:** Slice 2

## Slice 4: External Sync Mapping Foundation

- **Kategorie:** `AFK`
- **What:** Einführung der zentralen Mapping-Tabelle für den E-Commerce Sync.
- **Acceptance Criteria:**
  - [ ] Tabelle `externalsyncmapping` existiert mit Unique Constraints (intern + extern pro Entity/Sales Channel eindeutig).
  - [ ] Standardfelder (`externalId`, `externalParentId`, `payloadSnapshot`, `syncStatus`, `lastSyncAt`, `tombstones`) sind vorhanden.
  - [ ] Repository/Service für idempotente Mapping-Lookups und konfliktfeste Upserts ist implementiert.
- **Blocked by:** Slice 3

## Slice 5: Ownership & Sync Rules

- **Kategorie:** `HITL` (wegen fachlicher Regeldefinition)
- **What:** Festlegung der Mastership-Regeln (wer führt welches Feld).
- **Acceptance Criteria:**
  - [ ] Ownership-Matrix ist als Code-konfigurierbare Policy implementiert (Push/Pull/Bidirectional).
  - [ ] Konfliktverhalten (ERP-master, Shop-master, Snapshot-only) ist definiert und greift in den Sync-Services.
  - [ ] Eindeutige Mastership-Regel pro Feld (Artikel, Varianten, Bestand, Dokumente, Kunden).
- **Blocked by:** Slice 4

## Slice 6: Canonical Payload Builders

- **Kategorie:** `AFK`
- **What:** Transformer für die Übersetzung interner Entitäten in standardisierte E-Commerce Payloads.
- **Acceptance Criteria:**
  - [ ] Builder für `article`, `articlevariant`, `inventoryitem`, `inventorylevel`, `document`, `documentline` existieren.
  - [ ] Variantensnapshot ist als normalisierte Optionsstruktur verfügbar.
  - [ ] Payloads sind deterministisch (für Diffing/Debugging) und testbar.
- **Blocked by:** Slice 5

## Slice 7: Connector Runtime Skeleton

- **Kategorie:** `AFK`
- **What:** Aufbau des generischen Connector-Interfaces und der Batch-Verarbeitung.
- **Acceptance Criteria:**
  - [ ] `connectordefinition`, `tenantconnector`, `tenantconnectormapping` sind produktiv nutzbar.
  - [ ] Basis-Interface (authenticate, fetch delta, push/pull entity, ack webhook) ist definiert.
  - [ ] Batch-/Retry-/Error-Modell ist an `importbatch` und `importrow` angeschlossen.
  - [ ] Logging/Observability für Sync-Läufe ist implementiert.
- **Blocked by:** Slice 6

## Slice 8: Shopify Connector MVP

- **Kategorie:** `HITL` (wegen externer API-Integration/Tests)
- **What:** Push von Produkten/Beständen und Import von Bestellungen für Shopify.
- **Acceptance Criteria:**
  - [ ] Authentifizierung & Shop-Konfiguration für Shopify funktioniert.
  - [ ] Push von `article` + `articlevariant` erfolgreich.
  - [ ] Push von `inventorylevel` erfolgreich.
  - [ ] Import von Shopify Orders zu `document` + `documentline` funktioniert.
  - [ ] Externe IDs werden korrekt in `externalsyncmapping` gespeichert.
- **Blocked by:** Slice 7

## Slice 9: Webhook & Delta Sync

- **Kategorie:** `AFK`
- **What:** Event-basierter Near-Time Sync für Shopify.
- **Acceptance Criteria:**
  - [ ] Webhook-Endpunkte für Shopify-Ereignisse (orders/create, products/update, inventory) existieren.
  - [ ] Delta-Queue/Job-Verarbeitung ist aktiv.
  - [ ] Idempotente Verarbeitung ohne Dubletten-Erstellung bei Re-Deliveries.
- **Blocked by:** Slice 8

## Slice 10: Backoffice Monitoring & Repair Tools

- **Kategorie:** `HITL` (UI Implementation)
- **What:** UI-Ansichten zur Fehleranalyse und Behebung von Sync-Problemen.
- **Acceptance Criteria:**
  - [ ] Grid/Inspector für `externalsyncmapping`, `importbatch`, `importrow` ist verfügbar.
  - [ ] Commands (`retrySync`, `rebuildPayloadSnapshot`, `relinkExternalId`, `markAsResolved`) sind nutzbar.
  - [ ] Fehlerbilder sind nachvollziehbar in der Standard-UI dargestellt (kein SQL-Zugriff nötig).
- **Blocked by:** Slice 7, Slice 8

---

## Future Slices (Out of scope for initial plan)

- Slice 11: Shopware Connector MVP
- Slice 12: WooCommerce Connector
- Slice 13: PrestaShop Connector
- Slice 14: Erweiteter Sync (Medien, Kategorien, Kunden, Fulfillment)
