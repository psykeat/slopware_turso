# Shop-Erweiterung — Shopware 6 Integration

Statusanalyse und Implementierungsplan fuer die Shopware-6-Anbindung. Ziel: Stammdaten (Kunden, Produkte, Kategorien, Bestaende, Preise) aus dem ERP in Shopware 6 pushen, perspektivisch Bestellungen zurueckholen.

---

## IST-Zustand (Stand 2026-06-18)

### Vollstaendig implementiert

| Bereich              | Datei                                                                   | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shopware6Adapter     | `packages/db/src/services/commerce-sync.ts`                             | OAuth2 Client-Credentials, Referenz-Aufloesung (Currency, Tax, CustomerGroup, PaymentMethod, SalesChannel, Salutation, Countries), Batch-Upsert via `POST /api/_action/sync`, Property-Group-Pre-Sync                                                                                                                                                                                                                                                   |
| CommerceSyncService  | gleiche Datei                                                           | Orchestrierung mit Batching, Step-Tracking, DLQ (5 Versuche, Exponential Backoff)                                                                                                                                                                                                                                                                                                                                                                       |
| Deterministische IDs | gleiche Datei                                                           | SHA-256-basiert, stabil ueber Sync-Laeufe (Namespaces: `article`, `article-variant`, `address`, `address-billing`, `option-group`, `option-value`, `configurator-setting`, `category`)                                                                                                                                                                                                                                                                  |
| Varianten-Optionen   | gleiche Datei                                                           | `article_option`→`property_group`, `article_option_value`→`property_group_option`, `configuratorSettings` am Parent, `options` an Children, Children bekommen `taxId`+`price` via `prepareProductPayload`                                                                                                                                                                                                                                               |
| 6 Sync-Capabilities  | `packages/db/src/capabilities/modules/commerce.sync.ts`                 | `commerce.commerceSyncRun.start/get/list/cancel`, `commerce.commerceSyncDeadLetter.list/retry` — HTTP + LLM                                                                                                                                                                                                                                                                                                                                             |
| Sync-Monitoring UI   | `apps/web/src/routes/_auth/app/settings/commerce-sync.tsx`              | KPIs, Live-Trigger, Verlauf (Filter + CSV), DLQ (Bulk-Retry), Auto-Refresh                                                                                                                                                                                                                                                                                                                                                                              |
| 6 SalesChannel-Caps  | `packages/db/src/capabilities/modules/commerce.sales-channel.ts`        | `commerce.salesChannel.list/get/create/update/archive/testConnection` — CRUD + OAuth2-Verbindungstest                                                                                                                                                                                                                                                                                                                                                   |
| Sales-Channel UI     | `apps/web/src/routes/_auth/app/settings/sales-channels.tsx`             | Master-Detail Settings-Route, Plattform-Select, Credential-Formular, Verbindungstest-Button                                                                                                                                                                                                                                                                                                                                                             |
| Schema               | `packages/db/src/schema/app.schema.ts`                                  | `sales_channel`, `external_sync_mapping`, `commerce_sync_run`, `commerce_sync_run_step`, `commerce_sync_dead_letter` mit Indizes + Constraints                                                                                                                                                                                                                                                                                                          |
| Docker               | `docker-compose.yml`                                                    | dockware/play auf Port 8080                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Credentials          | DB-Tabelle `sales_channel`                                              | `apiUrl` + `credentials` (clientId/secret) pro Kanal, gepflegt via Sales-Channel-UI (`/app/settings/sales-channels`). **Nicht** in `.env` — Service liest ausschliesslich aus der DB (`getSalesChannel()`). `client_secret` ist **verschluesselt** (AES-256-GCM via `services/secret-crypto.ts`, Key `ENCRYPTION_SECRET`); `clientId` bleibt im Klartext lesbar. Entschluesselung in `parseShopwareCredentials()` und den `salesChannel.get/list`-Caps. |
| Kategorie-Sync       | gleiche Datei                                                           | `mapCategoryToShopwareCategory()`, topologische Sortierung (Root-first), `buildCategoryItems()`, `loadArticleCategoryIds()` fuer Artikel→Kategorie-Zuordnung, Kategorien werden VOR Produkten gepusht                                                                                                                                                                                                                                                   |
| Delta-Sync           | gleiche Datei                                                           | Default inkrementell: `filterUnchangedItems()` / `loadSyncedPayloads()` ueberspringen Datensaetze, deren rohes Payload byteweise zum letzten erfolgreichen `external_sync_mapping.payloadSnapshot` passt (`stableStringify`-Diff). `forceFullSync` umgeht den Gate. Snapshot speichert rohes Payload.                                                                                                                                                   |
| Webhook-Empfaenger   | `commerce-webhook.ts`, `api/shopware/webhook.ts`, `commerce.webhook.ts` | Unauth. `POST /api/shopware/webhook`, HMAC-SHA256-Signatur via App-Secret, signaturbasierte Kanal-Auswahl, durable Event-Queue (`commerce_webhook_event`) mit Dedup, Processor: `checkout.order.placed`→Bestell-Import; `list`/`process`-Capabilities                                                                                                                                                                                                   |
| Tests                | `packages/db/src/services/commerce-sync.test.ts`                        | 13 Tests: Mapper (mit Options), Single-Variant (ohne Options), Preislisten Net→Gross, Preislisten Fallback, Kategorie-Mapper, Artikel-Kategorie-Referenz, Dry-Run (Address+Article), Dry-Run (Category+Article), Dry-Run (Price List), DLQ, Retry, Abandon, Capability-Discovery — alle gruen                                                                                                                                                           |

### Was gepusht werden kann

| Entity                  | Mapping                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Einschraenkung                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Adressen → Kunden       | addressNo→customerNumber, Name, Firma, Rechnungsadresse, USt-ID, Land→countryId, echte Email (Fallback synthetisch), Telefon in Custom Fields, Salutation-Mapping (Herr→mr, Frau→mrs)                                                                                                                                                                                                                                                                                                                                                                                                                   | Nur `shopActive=true` Adressen; keine Kundengruppen-Zuordnung |
| Kategorien → Kategorien | categoryId→deterministisch, Name, Description, `parentId` per Hash, topologisch sortiert (Root-first)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Voller Hierarchie-Baum; Unterkategorien beliebig tief         |
| Artikel → Produkte      | articleNo→productNumber, Name, Langtext→description, Kurzbeschreibung→metaDescription, SKU, EAN, Gewicht, **Preislisten-Preise** (gueltige `price_list_item` mit Netto/Brutto-Berechnung aus `isNet`+Steuersatz, Fallback auf `variant.price`), **echte Bestaende** aus `inventory_level`, **Steuerklassen-Mapping** via `tax_rule`→`tax_code`→Shopware Tax, **Varianten-Optionen** als `property_group`/`property_group_option` mit `configuratorSettings` + `options`, **Kategorie-Zuordnung** aus `article_category`, **Bilder** aus `article_image` (Media-Upload + `coverId` via `primaryImageId`) | kein Shopware Advanced Pricing (benoetige `ruleId`-Zuordnung) |

### Phase 1 Quick Wins — ERLEDIGT (2026-06-17)

Alle Aenderungen in `commerce-sync.ts`, keine Migrationen:

1. **shop_active Filter** — `buildAddressItems()` filtert auf `shopActive === true`
2. **Bestandsuebermittlung** — JOIN `inventory_item` → `inventory_level`, summiert `quantity` pro Variante; Produkte bekommen echte Stock-Werte statt `0`
3. **Echte Email + Kontaktdaten** — `address.email` wird verwendet (Fallback synthetisch), Telefon in Custom Fields + `phoneNumber` auf Rechnungsadresse, Salutation→Shopware-Key
4. **Steuerklassen-Mapping** — `loadArticleTaxRates()` loest `taxClassId`→`tax_rule`→`tax_code.taxRate` auf; `resolveReferences()` laedt alle Shopware-Steuersaetze→`taxRateMap`; `prepareProductPayload()` waehlt korrekten Tax
5. **Langtext nutzen** — Priorisierung `langtext`→`description`→`kurzbeschreibung` fuer Shopware `description`, `kurzbeschreibung` als `metaDescription`

---

## Offene Phasen

### Phase 2: Mittlerer Aufwand (2-3 Tage)

#### ~~2.1 — Kategorie-Sync (Push) — ERLEDIGT (2026-06-17)~~

Alle Aenderungen in `commerce-sync.ts` + Seed in `seed-full-feature.ts`, keine Migrationen:

1. **`CommerceSyncEntity`** um `"category"` erweitert, Capability-Schema ebenso
2. **`mapCategoryToShopwareCategory()`** — deterministisch (`stableShopwareId("category", categoryId)`), `parentId` referenziert Parent-Kategorie per Hash
3. **`buildCategoryItems()`** / `buildCategoryItemsForIds()` — laedt hierarchisch, topologisch sortiert (Root-first)
4. **Topologische Sortierung** — `topologicalSortCategories()` stellt sicher dass Parents vor Children gepusht werden
5. **Kategorie-Upsert in `pushBatch()`** — Kategorien werden VOR Produkten via Shopware Sync-API gepusht
6. **Artikel→Kategorie-Zuordnung** — `loadArticleCategoryIds()` laedt `article_category`-Links, `mapArticleToShopwareProduct()` setzt `categories: [{ id }]`
7. **`normalizeEntities()`** — Full-Mode pusht jetzt `["category", "address", "article"]`
8. **DLQ-Retry** — Kategorie-Entity im Retry-Pfad verdrahtet
9. **Seed-Daten** — 5 Kategorien (Root → 3 Hauptkategorien → 1 Unterkategorie), 6 Artikel-Zuordnungen
10. **Tests** — 10 Tests gruen: Kategorie-Mapper (Root + Child + Determinismus), Artikel-Kategorie-Referenz, Dry-Run mit Kategorien

#### ~~2.2 — Varianten-Optionen als Shopware Properties — ERLEDIGT (2026-06-17)~~

Alle Aenderungen in `commerce-sync.ts`, keine Migrationen:

1. **DB-Loading** — `articlesWithVariantsToItems()` JOINt `article_variant_option_value` → `article_option_value` → `article_option` parallel zum Stock-Query
2. **Property-Group Pre-Sync** — `pushBatch()` sammelt alle Option-Groups aus Produkt-Items und pusht sie als Shopware `property_group` (mit verschachtelten `options`) in separatem Sync-API-Call VOR dem Produkt-Upsert
3. **`configuratorSettings` am Parent** — `mapArticleToShopwareProduct()` erzeugt `configuratorSettings` mit allen moeglichen Option-Value-IDs fuer Multi-Varianten-Produkte
4. **`options` an Children** — Jede Child-Variante traegt ihre konkreten `options: [{ id: shopwareOptionId }]`
5. **Child-Payload-Propagation** — `prepareProductPayload()` propagiert `taxId`, `stock`, `price` auf Children
6. **Deterministisch** — Namespaces `option-group`, `option-value`, `configurator-setting`

#### ~~2.3 — Preislisten-Integration — ERLEDIGT (2026-06-17)~~

Alle Aenderungen in `commerce-sync.ts` + Seed in `seed-full-feature.ts`, keine Migrationen:

1. **`PriceListPrice` Interface** — `priceListName`, `isNet`, `currencyId`, `price` pro Variante
2. **DB-Loading** — `articlesWithVariantsToItems()` laedt `price_list_item` JOIN `price_list` parallel, gefiltert auf `archived=false`, `validFrom <= NOW`, `validTo >= NOW OR NULL`
3. **`buildVariantPrice()`** — Preislisten-Preise haben Vorrang vor `variant.price`; Fallback auf `variant.price` wenn keine Preisliste vorhanden
4. **`buildPriceFromPriceList()`** — Netto/Brutto-Berechnung basierend auf `priceList.isNet` und Artikel-Steuersatz: `isNet=true` → `gross = net * (1 + taxRate/100)`; `isNet=false` → `net = gross / (1 + taxRate/100)`
5. **`normalizeShopwarePrice()`** — Erweitert: preserviert alle Eintraege im Price-Array statt nur den ersten, respektiert `linked` und `currencyId` pro Eintrag
6. **Multi-Varianten-Pfad** — Children bekommen eigene `price`-Berechnung via `buildVariantPrice()` direkt im Mapper
7. **Seed-Daten** — 10 Price-List-Items fuer ART-TSHIRT Varianten (Wholesale Prices, EUR 18.50 netto)
8. **Tests** — 3 neue Tests: Net→Gross-Berechnung (20% Tax), Gross→Net-Berechnung, Fallback auf `variant.price`

### Phase 3: Groessere Erweiterungen (je 1-4 Tage)

#### ~~3.1 — Sales-Channel-Verwaltung UI — ERLEDIGT (2026-06-17)~~

Alle Aenderungen in `commerce.sales-channel.ts` (Capabilities) + `sales-channels.tsx` (UI), keine Migrationen:

1. **6 Capabilities** in `packages/db/src/capabilities/modules/commerce.sales-channel.ts`: `commerce.salesChannel.list/get/create/update/archive/testConnection`
2. **Settings-Route** `apps/web/src/routes/_auth/app/settings/sales-channels.tsx` — Master-Detail-Layout (Liste links, Formular rechts)
3. **Formular**: Name, Plattform (Shopware 6/Shopify/WooCommerce/PrestaShop), API-URL, Client ID/Secret, Master Data Policy, Aktiv-Toggle
4. **Verbindungstest** — Button fuehrt OAuth2-Token-Fetch gegen konfigurierte API-URL aus, zeigt Erfolg/Fehler per Toast
5. **Navigation** — Link "Verkaufskanäle" in Settings-Sidebar unter "Werkzeuge"

#### ~~3.2 — Sync-Monitoring UI — ERLEDIGT (2026-06-17)~~

Neue Capability `commerce.commerceSyncRun.list` (+ `service.listRuns()`), Route `commerce-sync.tsx`, SDK/Manifest/Registry regeneriert. Keine Migrationen.

1. **`commerce.commerceSyncRun.list`** — `read`-Capability mit Filter `salesChannelId`/`status`/`limit`, sortiert nach `createdAt` (neueste zuerst), Cap 500; Service-Methode `listRuns()` mappt `requestedEntities` (jsonb) auf `string[]`
2. **Route** `apps/web/src/routes/_auth/app/settings/commerce-sync.tsx` — Toolbar mit Kanal-Select + Auto-Refresh (5s) + Aktualisieren
3. **KPI-Overview** — Gesamt-Status-Badge (🟢/🟡/🔴), Erfolgsrate, letzte Dauer, DLQ-ausstehend
4. **Live-Sync-Trigger** — Entity-Checkboxen (category/address/article), Modus (full/single), Dry-Run-Toggle, Start-Button via `commerceSyncRun.start`
5. **Sync-Verlauf** — Tabelle (Status, Zeitpunkt, Entitäten, Modus, total/ok/fehler, Dauer), Status- + Entity-Filter, CSV-Export
6. **DLQ-Ansicht** — Tabelle (Status, Entität, interne ID, Fehler, Versuche, zuletzt), Status- + Entity-Filter, Bulk-Retry via `commerceSyncDeadLetter.retry` (alle fälligen pending pro Kanal)
7. **Navigation** — Link "Sync-Monitoring" in Settings-Sidebar unter "Werkzeuge"
8. **Nebenfix** — `commerce.salesChannel.testConnection` war `kind: "process"` ohne `writesTables` und liess die gesamte Capability-Registry beim Laden werfen (Phase-9-Guard); auf `kind: "read"` korrigiert (idempotente externe Probe, kein Tabellen-Write)

#### ~~3.2.1 — Credential-Verschluesselung & .env-Cleanup — ERLEDIGT (2026-06-17)~~

Sicherheitshaertung der Sales-Channel-Zugangsdaten. Keine Migrationen.

1. **`.env`-Cleanup** — Die toten Variablen `SHOPWARE_API_URL`/`SHOPWARE_CLIENT_ID`/`SHOPWARE_CLIENT_SECRET` wurden aus `apps/web/.env` + `.env.example` entfernt (nirgends im Code gelesen). Endpunkt + Credentials kommen ausschliesslich pro Kanal aus der DB-Tabelle `sales_channel`, gepflegt via Sales-Channel-UI. `04_shopware_integration.md` entsprechend korrigiert (dockware-Werte nur noch als Bootstrap-Beispiel zum Eintippen).
2. **`services/secret-crypto.ts`** — Generischer AES-256-GCM-Helper (`encryptSecret`/`decryptSecret`), Format `iv:authTag:cipher` (hex), Key aus `ENCRYPTION_SECRET` (Fallback `EMAIL_ENCRYPTION_SECRET`). Selbes Verfahren wie `services/email/credential-crypto.ts`.
3. **`client_secret` verschluesselt at rest** — `salesChannel.create/update` verschluesseln den Secret vor dem Schreiben (`clientId` bleibt Klartext, damit in Liste/Formular lesbar); `salesChannel.get/list` entschluesseln beim Lesen; `parseShopwareCredentials()` (Sync) entschluesselt.
4. **`update` ohne Credentials** — fasst die Credentials-Spalte nur an, wenn der Patch das Feld traegt → Bearbeiten anderer Attribute loescht das gespeicherte Secret nicht und es kommt zu keiner Doppelverschluesselung.
5. **Zero-Downtime/Backward-Compat** — ohne Key Klartext-Fallback; `decryptSecret` gibt Nicht-Ciphertext unveraendert zurueck → Legacy-Klartext-Zeilen funktionieren weiter und werden beim naechsten Speichern verschluesselt.
6. **`list` umgebaut** — von generischer `defineListCapability` auf handgeschriebenen Handler ueber `runEntityList` (identischer Input/Output-Vertrag, `filtersWrapped: false`), damit beim Lesen entschluesselt wird; sonst haette die Liste Ciphertext geliefert und die UI beim Speichern doppelt verschluesselt.
7. **Offen (optional)** — Secret zusaetzlich aus `get`/`list`-Antworten maskieren (Rueckgabe an die authentifizierte Admin-UI ist unveraendert); UI dann "Secret nur zum Aendern eingeben".

#### ~~3.3 — Medien/Bilder-Sync — ERLEDIGT (2026-06-17)~~

Alle Aenderungen in `commerce-sync.ts` + Capability-Enum + UI + Seed, keine Migrationen (Enum-Wert `media_asset` existierte bereits in `external_sync_entity_type`).

**Quelle:** produktiver Bilderbestand ist `article_image`. `media_asset` + `article_media` bleiben als generisches Medienmodell im Schema vorhanden, haben aktuell aber keinen UI-Schreibpfad und werden fuer den Shop-Bilder-Sync nicht als Datenquelle verwendet.

1. **`CommerceSyncEntity`** um `"media_asset"` erweitert (Enum-Wert existiert bereits in `external_sync_entity_type`; Capability-Input-Enum + UI-`SYNC_ENTITIES` ebenso). Der oeffentliche Entity-Key bleibt aus Kompatibilitaetsgruenden `"media_asset"`, intern werden dafuer `article_image`-Zeilen synchronisiert. Hash-Namespace bleibt `"media"`, die Shopware-Sync-Entity heisst `"media"`.
2. **`mapArticleImageToShopwareMedia()`** — deterministisch (`stableShopwareId("media", articleImageId)`), `title` ohne Extension, `alt`, `customFields.slopwareArticleImageId` + `customFields.slopwareChecksum`; liefert zusaetzlich `binary` (storageKey/mimeType/fileName/extension) + `checksum`.
3. **3-Schritt-Upload im Adapter** — `pushBatch()` upsertet Media-Entities VOR Produkten via Sync-API (`entity: "media"`), danach Binary-Upload pro Media via `POST /api/_action/media/{id}/upload?extension=&fileName=` (Content-Type = mimeType). Upload-Fehler → Item in `rejected`/DLQ.
4. **Idempotenz via Checksum** — Service berechnet SHA-256 aus dem gespeicherten `article_image`-Binary und vergleicht gegen den `slopwareChecksum` im letzten erfolgreichen `external_sync_mapping.payloadSnapshot` (`loadSyncedMediaChecksums()`). Unveraenderte Binaries werden nicht erneut hochgeladen; Media-Entity wird trotzdem (idempotent) upsertet.
5. **Produkt-Verknuepfung** — `loadArticleMediaLinks()` laedt aktive `article_image`-Zeilen je Artikel; `mapArticleToShopwareProduct()` baut `media: [{ id (product-media-Hash), mediaId, position }]` + `coverId` (`article.primaryImageId`, sonst niedrigste `sortOrder`), dedupliziert pro Artikelbild.
6. **Storage-Zugriff** — `readStorageBinary(storageKey)` liest aus `STORAGE_PATH` (Fallback `~/slopware/storage`), gleiche Konvention wie Upload-/Preview-Route, mit Path-Traversal-Schutz.
7. **Reihenfolge** — Full-Mode pusht jetzt `["category", "address", "media_asset", "article"]` (Media vor Artikel, da Produkte Media-IDs referenzieren). DLQ-Retry-Pfad fuer `media_asset` verdrahtet.
8. **Seed** — 2 `article_image`-Zeilen fuer ART-TSHIRT (1x1-PNG, echte Binary auf Platte unter `tenant-<id>/articles/<articleId>/`), Cover via `article.primaryImageId`, damit der Push real testbar ist (`seed-full-feature.ts`).
9. **Tests** — Media-Mapper (Determinismus, title/extension/checksum), Artikel-Mapper mit `media`/`coverId` (+ ohne Links keine Keys), Service-Dry-Run mit `media_asset`-Step auf echter `article_image`-Datei.

#### ~~3.4 — Delta-Sync — ERLEDIGT (2026-06-17)~~

Alle Aenderungen in `commerce-sync.ts` + Capability-Input + UI + Tests, keine Migrationen.

**Mechanismus: Payload-Diff (autoritativ), kein reiner `updatedAt`-Filter.** Bewusste Abweichung vom urspruenglichen Plan: Das Artikel-Payload haengt von verbundenen Tabellen ab (Bestand aus `inventory_level`, Preise aus `price_list_item`, Optionen, Kategorien, Bilder). Eine Bestands- oder Preisaenderung beruehrt `article.updatedAt` **nicht** — ein reiner `updatedAt > lastSyncAt`-Filter wuerde solche Aenderungen verpassen (zudem hat `article_image` gar kein `updatedAt`). Der Payload-Diff gegen `external_sync_mapping.payloadSnapshot` ist dagegen fuer **alle** Entitaeten vollstaendig korrekt, weil das Payload aus saemtlichen Quellen aufgebaut wird.

1. **Default = Delta** — `start()` baut weiterhin alle Kandidaten, filtert dann via `filterUnchangedItems()` jene heraus, deren frisch gebautes `item.payload` byteweise identisch zum letzten erfolgreichen Snapshot ist. Eliminiert die teuren Anteile (Shopware-Sync-Calls, Media-Uploads, Mapping-Writes) fuer unveraenderte Datensaetze.
2. **`forceFullSync`-Override** — neues optionales Flag in `CommerceSyncPlan` + Capability-Input. `true` umgeht den Diff und pusht alle Kandidaten (vorheriges Full-Scan-Verhalten, z. B. zur Wiederherstellung eines abgedrifteten Shops).
3. **Snapshot = rohes Payload** — `pushBatch()` persistiert jetzt das rohe gemappte `item.payload` als `payloadSnapshot` (statt des referenz-aufgeloesten `prepared`), damit der Diff apples-to-apples ist. Einziger weiterer Leser von `payloadSnapshot` ist der Media-Checksum-Pfad (`loadSyncedMediaChecksums`) — die Checksum liegt im rohen Payload, funktioniert unveraendert. Media-Idempotenz wird durch den Delta-Gate noch verstaerkt: unveraenderte Bilder ueberspringen jetzt auch den Media-Upsert.
4. **Kanonischer Diff** — `stableStringify()` sortiert Keys rekursiv, weil der `jsonb`-Snapshot beim Zuruecklesen die Insertion-Order nicht erhaelt.
5. **Beobachtbarkeit** — Step-`payloadSummary` traegt `unchanged` (uebersprungene Anzahl) und `candidates`; bei vollstaendig unveraenderter Entitaet wird ein `skipped`-Step geschrieben.
6. **UI** — Toggle „Vollständig (kein Delta)" neben dem Dry-Run-Toggle in `commerce-sync.tsx`, gibt `forceFullSync` an die Start-Capability weiter.
7. **Tests** — `commerce.sync delta skips unchanged items and re-pushes changed ones`: Run 1 pusht 2, Run 2 (unveraendert) pusht 0 + `skipped`-Step, nach Aenderung einer Adresse pusht Run 3 nur 1, `forceFullSync` pusht wieder 2.

#### ~~3.5 — Order-Import / Pull-Sync — ERLEDIGT (2026-06-17)~~

Alle Aenderungen in `commerce-sync.ts` (+ Capability-Enum, UI, Tests). Keine neue Migration noetig — der DB-Enum `external_sync_entity_type` hat `"document"` bereits. **Abhaengigkeit vom Tax-Refactor (`11_tax_refactor.md`)**: Der Import schreibt `document_line.tax_reason/tax_rule_id/tax_country_code_used/tax_rate_snapshot`. Diese Spalten gehoeren zum Tax-Refactor (Migration `20260617120000_document_line_tax_diagnostics`, derzeit uncommitted im Working Tree). Der Tax-Refactor-Code (TaxResolutionService, `resolveVariantPricing`-Fix) ist vorhanden und getestet (6/6 `tax-resolution-service.test.ts` gruen), aber die Migration war auf der lokalen DB noch nicht eingespielt — dieses Repo hat kein Drizzle-`_journal.json`, `db:migrate` ist no-op, Migrationen werden manuell per `pnpm db:sql` angewandt. Migration wurde nachgeholt (4 Spalten + FK `document_line_tax_rule_id_…_fkey` verifiziert vorhanden). Ohne die Spalten schlaegt **jeder** `saveDocumentDraft` mit Steuerfeldern fehl, nicht nur der Order-Import.

1. **`CommerceSyncEntity`** um `"document"` erweitert; Capability-Input-Enum + UI-`SYNC_ENTITIES` ebenso. `document` ist **inbound-only** (Pull) — die Push-Checkboxen (`PUSH_ENTITIES`) blenden es aus.
2. **`start()` verzweigt**: `direction === "pull"` → `runOrderImport()`; der alte „Only push"-Wurf entfaellt (jetzt nur noch bei `bidirectional`).
3. **Adapter `Shopware6Adapter.pullOrders()`** — `POST /api/search/order` mit `Accept: application/json` (Associations inline statt JSON:API-`included`-Split), Associations: `lineItems`, `orderCustomer`, `currency`, `billingAddress.country`, `transactions.stateMachineState`, `deliveries.stateMachineState`. Paginiert (limit 100). Delta-Filter `range orderDateTime >= since`. Interface `CommerceSyncAdapter.pullOrders?` ist optional (nur Shopware implementiert es).
4. **`normalizeShopwareOrder()`** (exportiert, rein) — flacht den rohen Shopware-Order auf `ShopwareOrder` ab: Order-No, `taxStatus`, Currency-ISO, Kunde (inkl. `vatIds[0]`), Rechnungsadresse (Country-ISO), `paymentState` (neueste Transaktion nach `createdAt`), `shippingState` (erste Delivery), Lines (`type`, `referencedId`, `productNumber`, `quantity`, `unitPrice`, `taxRate` aus `price.calculatedTaxes[0]`).
5. **Mapping Order → Beleg** via `DocumentService.createDocument` + `saveDocumentDraft` (statt Direkt-Insert) — erzeugt `documentNo`/`transactionId`/Totals (`persistDocumentTotals`) korrekt. Belegtyp `"A"` (Auftrag), Richtung `OUTBOUND`, Status `draft`. Beleggruppe = erste nicht-archivierte Gruppe vom Typ `"A"` (niedrigste `groupNumber`). `billingAddress` + `customAttributes` (`shopwareOrderId/Number`, `paymentState`, `shippingState`) am Beleg.
6. **Varianten-Resolution** (`buildVariantResolution`) — **SKU primaer** (`productNumber` == Shopware-`productNumber` == Variant-SKU, deckt Single- und Multi-Variante einheitlich ab), Fallback `stableShopwareId("article-variant", …)` (Multi-Variant-Children) und `stableShopwareId("article", …)` (Single-Variant-Produkt == Artikel-Hash). Kein Reverse-Hashing noetig.
7. **Kunden-Resolution** (`resolveOrderCustomer`) — (1) `external_sync_mapping` (`entityType=address`, `externalId=Shopware-Customer-ID`; deckt zuvor gepushte ERP-Kunden ab, da deren Shopware-ID == `stableShopwareId("address", addressId)`), (2) `address_no == customerNumber`, (3) `email`, sonst (4) **Auto-Anlage** einer `address` (isCustomer + shopActive, addressNo = customerNumber bzw. `SHOP-<orderNo>`) und `external_sync_mapping`-Eintrag. Aufloesungen 2–4 schreiben das Mapping nach.
8. **Steuer pro Zeile** — `resolveVariantPricing()` liefert `taxCodeId/taxRuleId/taxCountryCodeUsed/taxRate` (ERP-autoritativ); Shopware-Preis bleibt Quelle der Wahrheit fuer den Betrag. `deriveUnitNet()` rechnet bei `taxStatus="gross"` Brutto→Netto (B2C), `net`/`tax-free` ist bereits netto. `computeOrderLineFinancials()` setzt `lineTotalNet` + `taxAmount`, damit `recalculateDocumentTotals` die Belegsummen korrekt aufbaut.
9. **Nicht-Produktzeilen** (Versand, Promotion …) — als `comment`-Zeile gespeichert (der `document_line_line_type_check` erlaubt nur `article/comment/production_output/sales_bom_header/bom_component`), Betrag bleibt erhalten (Prefix `[shipping]` im Text), sodass die Belegsumme zu Shopware passt. Nicht aufloesbare Produktzeilen → `comment` mit `[unmapped] …`, der Order importiert trotzdem.
10. **Delta + Idempotenz** — `since` = `startedAt` des letzten nicht-fehlgeschlagenen Pull-Runs des Kanals (`forceFullSync` umgeht es); zusaetzlich werden bereits importierte Orders per `external_sync_mapping` (`entityType=document`, `externalId=orderId`) uebersprungen. Nach Import wird das Document-Mapping geschrieben.
11. **Fehlerbehandlung** — Der Pull-Pfad schreibt **keine** DLQ-Zeilen (die DLQ/Retry-Maschinerie ist push-orientiert und `internalId uuid NOT NULL` passt nicht zu noch-nicht-importierten Orders). Fehlgeschlagene Orders landen in `run.errorSummary`/`step.errorSummary` und werden **nicht** gemappt → der naechste Lauf versucht sie automatisch erneut.
12. **UI** (`commerce-sync.tsx`) — eigener Abschnitt „Bestell-Import (Pull)" mit Dry-Run- und „Alle (kein Delta)"-Toggle + Import-Button (`direction=pull`, `entities=["document"]`).
13. **Tests** — `deriveUnitNet`/`computeOrderLineFinancials` (Brutto→Netto, Totals), `normalizeShopwareOrder` (Associations, neueste Transaktion), Integration: Order-Import via Mock-Adapter mit Auto-Kundenanlage, korrekten Totals (204.19), Document-Mapping und Idempotenz (zweiter Pull → 0 Items, kein Duplikat). 20 `commerce-sync.test.ts` gruen; `vp lint` 0 Fehler.

**Verbleibender Vorbehalt (Posting)**: Importierte Bestellungen sind **Entwuerfe**. Das Buchen (`sales.document.post`) haengt weiterhin am in `05_ecommerce_refactor.md` dokumentierten Bruch im Posting-Pfad (`document_line` → `variant` → `inventoryItem`); dieser muss geschlossen werden, bevor importierte Auftraege gebucht werden koennen. Der Import selbst ist davon unabhaengig.

#### ~~3.6 — Webhook-Empfaenger — ERLEDIGT (2026-06-17)~~

Neue Tabelle `commerce_webhook_event` (Migration `20260618120000_commerce_webhook_event`, manuell via psql angewandt), neuer Service `commerce-webhook.ts`, neue Route, 2 Capabilities, `appSecret` in Sales-Channel-Credentials. Pattern angelehnt an `apps/web/src/routes/api/email/$.ts`.

1. **Schema** — `commerce_webhook_event` (tenant, salesChannel, `eventName`, `dedupeKey`, `payload` jsonb, `status` enum `pending/processing/processed/ignored/failed`, `attemptCount`, `errorMessage`, `nextRetryAt`, `processedAt`, `receivedAt`). Unique `(tenantId, salesChannelId, dedupeKey)` → Idempotenz gegen Shopware-Redeliveries (at-least-once). Enum `commerce_webhook_event_status`.
2. **Route** `apps/web/src/routes/api/shopware/webhook.ts` — **unauthentifizierter** `POST`. Liest den **rohen** Body (fuer HMAC), Header `shopware-shop-signature`, ruft `ingestShopwareWebhook` (durabler Schritt), danach Best-Effort-`processPending` fuer den Kanal. Antwortet `200` sobald das Event sicher persistiert ist; `401` bei ungueltiger Signatur, `404`/`501` bei unbekanntem Shop bzw. fehlendem App-Secret. Verarbeitungsfehler stehen auf der Event-Zeile (Retry-Backoff) und beeinflussen die Quittung nicht.
3. **Signatur-Validierung** (`verifyShopwareSignature`) — HMAC-SHA256 (hex) ueber den rohen Body mit dem **App-Secret** des Kanals, konstantzeitiger Vergleich (`timingSafeEqual`).
4. **Kanal-Aufloesung** (`findWebhookChannelCandidates`) — Die Route ist unauthentifiziert; einziger Routing-Schluessel ist `source.url`. Da eine Shop-URL auf **mehrere** Kanaele zeigen kann (z. B. mehrere Tenants), liefert die Aufloesung **alle** aktiven Shopware-Kanaele mit passender (normalisierter) `apiUrl` und konfiguriertem App-Secret; `ingestShopwareWebhook` waehlt den Kanal, dessen Secret die Signatur verifiziert. Die Signatur **authentifiziert und disambiguiert** also zugleich.
5. **App-Secret** — neues optionales Feld `appSecret` in den Sales-Channel-`credentials` (verschluesselt at rest via `secret-crypto`, wie `clientSecret`; `clientId` bleibt Klartext). Eingabe-Schema, `encryptCredentials`/`decryptCredentials` und das Formularfeld „Webhook App-Secret" (`sales-channels.tsx`, nur bei Plattform `shopware6`) entsprechend erweitert.
6. **Event-Queue + Processor** (`CommerceWebhookService.processPending`) — draint `pending`/faellige Events je Kanal: `checkout.order.placed` → loest den inkrementellen, idempotenten **Bestell-Import** aus (`CommerceSyncService.start({direction:"pull", entities:["document"]})`, vgl. 3.5); `product.stock.changed`/`customer.register` werden **bestaetigt** (`ignored`), da Bestand/Kundenstamm ERP→Shop fliessen (kein Inbound-Pfad noetig). Fehler: Backoff (`60s·2^n`, Cap 30 min), nach 5 Versuchen `failed`.
7. **Capabilities** — `commerce.commerceWebhookEvent.list` (read, Monitoring) + `commerce.commerceWebhookEvent.process` (process, manuelles Draining/Retry je Kanal). In `all.ts` registriert, Manifest + SDK regeneriert.
8. **Tests** — `commerce-webhook.test.ts` (6 gruen): Signatur-Verifikation (gueltig/verfaelscht/null), Envelope-Parsing, unbekannter Shop → Lookup-Fehler, ungueltige Signatur → 401, Kandidaten-Disambiguierung per Signatur, Ingest-Dedup (Redelivery → keine zweite Zeile), `processPending` (order.placed importiert Beleg + Mapping, stock.changed `ignored`, Re-Drain ohne Duplikat).

---

## Priorisierte Reihenfolge

| Prio   | Ticket                             | Aufwand      | Geschaeftswert |
| ------ | ---------------------------------- | ------------ | -------------- |
| ~~1~~  | ~~1.1 shop_active Filter~~         | ~~30 Min~~   | ~~ERLEDIGT~~   |
| ~~2~~  | ~~1.2 Bestandsuebermittlung~~      | ~~2-3 Std~~  | ~~ERLEDIGT~~   |
| ~~3~~  | ~~1.3 Echte Email + Kontaktdaten~~ | ~~1-2 Std~~  | ~~ERLEDIGT~~   |
| ~~4~~  | ~~1.4 Steuerklassen-Mapping~~      | ~~2-3 Std~~  | ~~ERLEDIGT~~   |
| ~~5~~  | ~~1.5 Langtext nutzen~~            | ~~30 Min~~   | ~~ERLEDIGT~~   |
| ~~6~~  | ~~2.1 Kategorie-Sync~~             | ~~4-6 Std~~  | ~~ERLEDIGT~~   |
| ~~7~~  | ~~2.2 Varianten-Optionen~~         | ~~6-8 Std~~  | ~~ERLEDIGT~~   |
| ~~8~~  | ~~2.3 Preislisten~~                | ~~4-6 Std~~  | ~~ERLEDIGT~~   |
| ~~9~~  | ~~3.1 Sales-Channel UI~~           | ~~1 Tag~~    | ~~ERLEDIGT~~   |
| ~~10~~ | ~~3.2 Sync-Monitoring UI~~         | ~~1-2 Tage~~ | ~~ERLEDIGT~~   |
| ~~11~~ | ~~3.3 Medien-Sync~~                | ~~8-12 Std~~ | ~~ERLEDIGT~~   |
| ~~12~~ | ~~3.4 Delta-Sync~~                 | ~~1-2 Tage~~ | ~~ERLEDIGT~~   |
| ~~13~~ | ~~3.5 Order-Import~~               | ~~2-4 Tage~~ | ~~ERLEDIGT~~   |
| ~~14~~ | ~~3.6 Webhooks~~                   | ~~1-2 Tage~~ | ~~ERLEDIGT~~   |

---

## Voraussetzungen & Risiken

1. **Varianten-Posting-Bruch** (siehe `05_ecommerce_refactor.md`): `inventory_balance` ist noch teilweise artikelzentriert. Fuer die Bestandsuebermittlung (erledigt) wird `inventory_level` verwendet, das bereits variantenbasiert ist. Fuer den Order-Import (3.5) muss der Posting-Pfad-Bruch geschlossen werden.
2. **Shopware Media Upload**: Binary-Upload erfordert Storage-Abstraktion fuer `media_asset.storageKey`.
3. **Shopware API Rate Limits**: `withRetry` deckt 429-Responses ab. Bei >1000 Produkten Batching verkleinern.
4. **entityType Enum**: `CommerceSyncEntity` hat `"address"`, `"article"`, `"category"`. Muss fuer Media, Document erweitert werden (DB-Enum `external_sync_entity_type` hat bereits `"media_asset"`, `"shipment"` etc.).

## Verifikation

- **Phase 1** (erledigt): Tests gruen in `commerce-sync.test.ts`
- **Phase 2.1** (erledigt): Kategorie-Mapper (Root + Child), Artikel-Kategorie-Referenz, Dry-Run mit `["category", "article"]` (2 Kategorien + 1 Artikel = 3 Items)
- **Phase 2.2** (erledigt): Mapper-Tests pruefen `configuratorSettings`, `options` an Children, `optionGroups`-Aggregation, und Single-Variant-Fallback (kein `configuratorSettings`)
- **Phase 2.3** (erledigt): 3 neue Tests — Net→Gross (20% Tax: 100 netto → 120 brutto), Gross→Net (119.99 brutto → 99.99 netto), Fallback auf `variant.price` ohne Preisliste; Integration-Test: Dry-Run mit `price_list_item` in DB
- **Phase 2 offen**: Echten Push gegen lokalen Shopware-Container (Port 8080). Kategorie-Baum im Shopware-Admin pruefen, Varianten-Selektor in Storefront, Preise in Produktdetail.
- **Phase 3.1** (erledigt): Sales-Channel-UI unter `/app/settings/sales-channels` — Anlegen, Bearbeiten, Deaktivieren, Verbindungstest. Manuell testen: Kanal anlegen, Credentials eintragen, Verbindung testen, Kanal deaktivieren/reaktivieren.
- **Phase 3.2** (erledigt): Sync-Monitoring-UI unter `/app/settings/commerce-sync` — Kanal wählen, KPIs, Probelauf/Sync starten, Verlauf mit Filtern + CSV, DLQ mit Bulk-Retry. Tests: alle 13 `commerce-sync.test.ts` + 17 Contract/Smoke grün; `vp lint` 0 Fehler. Offen: echter Push gegen lokalen Shopware-Container und Browser-Verifikation der UI.
- **Phase 3.2.1** (erledigt): Credential-Verschlüsselung verifiziert per Live-Round-Trip gegen die DB (Testkanal, danach gelöscht): `create` → at rest `clientSecret = iv:authTag:cipher`, `clientId` Klartext; `get` → entschlüsselt; `update` ohne Credentials → Secret bleibt erhalten, keine Doppelverschlüsselung. 30 Tests grün; `vp lint` 0 Fehler (4 vorbestehende Warnungen, keine davon aus dieser Änderung).
- **Phase 3.3** (erledigt): Medien-Sync aus `article_image` — Media-Upsert + Binary-Upload (3-Schritt), `coverId` via `primaryImageId`, Checksum-Idempotenz. 16 `commerce-sync.test.ts` + 17 Contract/Smoke gruen; `vp lint` 0 Fehler. Offen: echter Push gegen lokalen Shopware-Container, Bilder im Storefront verifizieren.
- **Phase 3.4** (erledigt): Delta-Sync via Payload-Diff. 17 `commerce-sync.test.ts` (inkl. neuem Delta-Test) + Contract/Smoke gruen; `vp lint` 0 Fehler (4 vorbestehende Warnungen, keine aus dieser Aenderung). Offen: echter Push gegen lokalen Shopware-Container und Browser-Verifikation des Toggles.
- **Phase 3.5** (erledigt): Order-Import via Pull. 20 `commerce-sync.test.ts` gruen (inkl. Order-Mapper, `normalizeShopwareOrder`, Auto-Kundenanlage, Idempotenz); `vp lint` 0 Fehler (4 vorbestehende Warnungen, keine aus dieser Aenderung). DB-Voraussetzung: Migration `20260617120000_document_line_tax_diagnostics` muss angewandt sein (auf der lokalen DB erledigt). Offen: echter Pull gegen lokalen Shopware-Container (Port 8080) mit echten Bestellungen; Posting importierter Auftraege blockiert durch den Posting-Pfad-Bruch (siehe `05_ecommerce_refactor.md`).
- **Phase 3.6** (erledigt): Webhook-Empfaenger unter `POST /api/shopware/webhook` (unauth, signaturgeschuetzt). 6 `commerce-webhook.test.ts` + 20 `commerce-sync.test.ts` + Contract/Guardrails/Smoke gruen; `vp lint` 0 Fehler (4 vorbestehende Warnungen, keine aus dieser Aenderung). Offen: echte Shopware-App-Registrierung gegen den lokalen Container (Port 8080) mit echtem App-Secret + Webhook-Subscription; End-to-End-Test einer realen `checkout.order.placed`-Zustellung.

## Kritische Dateien

| Datei                                                            | Zweck                                                                |
| ---------------------------------------------------------------- | -------------------------------------------------------------------- |
| `packages/db/src/services/commerce-sync.ts`                      | Adapter, Mapper, Service — Hauptdatei fuer alle Phasen               |
| `packages/db/src/services/commerce-webhook.ts`                   | Webhook-Empfang: Signatur, Kanal-Aufloesung, Ingest, Processor (3.6) |
| `apps/web/src/routes/api/shopware/webhook.ts`                    | Unauth. Webhook-Route (3.6)                                          |
| `packages/db/src/capabilities/modules/commerce.webhook.ts`       | Webhook-Event list/process Capabilities (3.6)                        |
| `packages/db/src/services/secret-crypto.ts`                      | AES-256-GCM Verschluesselung der Sales-Channel-Credentials           |
| `packages/db/src/capabilities/modules/commerce.sync.ts`          | Sync-Capability-Definitionen                                         |
| `packages/db/src/capabilities/modules/commerce.sales-channel.ts` | SalesChannel CRUD + Verbindungstest                                  |
| `apps/web/src/routes/_auth/app/settings/sales-channels.tsx`      | Sales-Channel-Verwaltung UI                                          |
| `apps/web/src/routes/_auth/app/settings/commerce-sync.tsx`       | Sync-Monitoring UI                                                   |
| `packages/db/src/schema/app.schema.ts`                           | Schema-Referenz (sales_channel, external_sync_mapping, etc.)         |
| `packages/db/src/services/commerce-sync.test.ts`                 | Tests                                                                |
| `.agents/04_shopware_integration.md`                             | Docker-Setup, Credentials                                            |
| `.agents/05_ecommerce_refactor.md`                               | Varianten-Refactor-Status, offene Brueche                            |
