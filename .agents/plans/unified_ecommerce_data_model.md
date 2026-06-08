# Unified E-Commerce Data Model & API Reference (V1.2)

Dieses Dokument definiert das kanonische Minimalmodell (V1.2) für die Entwicklung unserer E-Commerce-Schnittstellen (Shopify, Shopware, WooCommerce, PrestaShop). Es basiert auf einem polymorphen Mapping-Ansatz und einer feingranularen Trennung der fachlichen Entitäten.

## 1. API Dokumentationen & Provider Ereignismodell

Um die Schnittstellen sauber zu abstrahieren, müssen wir die Eigenheiten jedes Anbieters kennen. Hier ist die Zusammenfassung der wichtigsten Metriken pro Anbieter.

### 1.1 Shopify

- **Dokumentation:** [Admin GraphQL API](https://shopify.dev/docs/api/admin-graphql) | [Admin REST API](https://shopify.dev/docs/api/admin-rest)
- **Authentifizierung:** OAuth 2.0 oder API Access Token (`X-Shopify-Access-Token`).
- **Rate Limits:** Leaky Bucket (GraphQL: 50 Punkte/Sekunde).
- **Ereignismodell (Webhooks):** Exzellent unterstützt. Push-Webhooks für `orders/create`, `products/update`, etc. direkt an unsere Endpunkte.
- **Besonderheiten:** Trennt streng zwischen Produkt, Variante und `InventoryItem`. Bestände hängen an Standorten (`Location`). Arbeitet intensiv mit Global IDs.

### 1.2 Shopware 6

- **Dokumentation:** [Sync API / Admin API Guide](https://developer.shopware.com/docs/guides/integration-api/)
- **Authentifizierung:** OAuth 2.0 (Client Credentials Grant).
- **Rate Limits:** Abhängig vom Hosting.
- **Ereignismodell (Webhooks):** Unterstützt (via "App System" Webhooks oder Shopware-interne Events, die externe URLs aufrufen).
- **Besonderheiten:** Performante `_action/sync` API für Massenimporte. Starke Trennung bei Medien, Varianten und regelbasierten Preisen.

### 1.3 WooCommerce

- **Dokumentation:** [REST API v3 Documentation](https://woocommerce.github.io/woocommerce-rest-api-docs/)
- **Authentifizierung:** Basic Auth (Consumer Key & Secret).
- **Ereignismodell (Webhooks):** Native Webhooks konfigurierbar über das WP-Backend oder die API (z.B. Topic `order.created`).
- **Besonderheiten:** Baut auf WordPress Custom Post Types auf (z.B. Product Variations).

### 1.4 PrestaShop

- **Dokumentation:** [Webservices API Reference](https://devdocs.prestashop-project.org/8/webservice/)
- **Authentifizierung:** Basic Auth.
- **Ereignismodell (Polling / Fallback):** Keine nativen Webhooks out-of-the-box! Wir müssen hier entweder ein Custom-Plugin im PrestaShop installieren (das Events wirft) oder periodisches **Polling** (über verfügbare Datumsfelder wie `date_upd` oder `date_add`) für Bestellungen durchführen.
- **Besonderheiten:** XML-lastig, Combinations-Modell für Varianten.

---

## 2. Das Kanonische Minimalmodell (V1.2)

Ein simples Mapping auf Ebene von "Artikel" und "Bestellung" greift bei Systemen wie Shopify oder Shopware zu kurz. Wir benötigen eine granulare Domänen-Schnittstelle.

### 2.1 Entity-Liste (Die internen Kerntabellen)

Folgende Granularität muss in _slopware_ abgebildet sein, um verlustfrei synchronisieren zu können:

- **Stammdaten & Katalog:**
  - `article` (Vermarktbare Parent-Entität: SEO, Beschreibungen, Brand, Medien-Container)
  - `article_variant` (Kaufbare SKU-Einheit: Preis, Gewicht, SKU, EAN - _Dies ist das eigentliche Mapping-Ziel_)
  - `article_option` / `article_option_value` (Variantenmerkmale, z.B. Option="Farbe", Value="Rot")
  - `category` (Kategorien / Collections)
  - `media_asset` (Zentrale Medienverwaltung)
  - `article_media` (Zuordnung von Bild zu Artikel/Variante)
- **Bestand & Logistik:**
  - `inventory_item` (Lagerführende Einheit pro Variante, referenziert `article_variant`)
  - `inventory_level` (Bestand pro Lagerort/Kanal, referenziert `inventory_item`)
- **Kunden & Vertrieb:**
  - `customer` (Der logische Account/Kunde)
  - `customer_address` (Rechnungs-, Lieferadressen. Ein Kunde = N Adressen)
  - `price_list` / `price_rule` (Kanal- oder kundenspezifische Preisgestaltung)
- **Belege:**
  - `document` (Dokumentenkopf: z.B. Bestellkopf, Rechnungsadresse)
  - `document_line` (Dokumentposition: Verknüpfung zur verkauften `article_variant`)

### 2.2 Variantenattribut-Modell & Kombinationen

Die Zuordnung von Attributen (Größe, Farbe) zu Varianten muss konsistent über alle Shops synchronisiert werden.

- **Eindeutigkeitsregel:** Jede `article_variant` wird durch einen Hash ihrer `article_option_value`-Ids identifiziert. **Wichtig:** Diese Ids müssen in stabil sortierten Option-Achsen (z.B. alphabetisch nach Option-Name) formatiert werden, damit dieselbe Kombination systemübergreifend absolut deterministisch bleibt. Es darf pro `article` keine zwei Varianten mit exakt der gleichen Merkmalskombination geben.
- **Speicherung:** Variantenkombinationen werden relational modelliert (Join-Tabelle `article_variant_option_value`), aber zur schnellen Übertragung in den _Payload Snapshots_ der Mapping-Tabelle als JSON-Objekt normalisiert vorgehalten (z.B. `{"Color": "Red", "Size": "L"}`).

### 2.3 Die zentrale Mapping-Tabelle (`external_sync_mapping`)

Diese Tabelle verknüpft _jede_ der oben genannten Entitäten mit den IDs der Partnersysteme.

**Architekturvorgabe:** Es muss zwingend ein Unique Constraint auf `(tenantId, salesChannelId, entityType, internalId)` und ein zweites auf `(tenantId, salesChannelId, entityType, externalId)` gesetzt werden.

| Feldname            | Typ       | Beschreibung                                                                                                                                                                        |
| :------------------ | :-------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                | uuid      | Primärschlüssel                                                                                                                                                                     |
| `tenantId`          | uuid      | Mandant                                                                                                                                                                             |
| `salesChannelId`    | uuid      | Verweis auf den Shop (`sales_channel`)                                                                                                                                              |
| `entityType`        | enum      | `article`, `article_variant`, `document`, `document_line`, `inventory_item`, `inventory_level`, `media_asset`, `customer`, `customer_address`, `category`, `price_list`, `shipment` |
| `internalId`        | uuid      | Unsere interne ID                                                                                                                                                                   |
| `externalId`        | varchar   | Die ID des Shops                                                                                                                                                                    |
| `externalParentId`  | varchar   | Für Child-Beziehungen (z.B. Product ID bei einer Variante oder Order ID bei Line Items)                                                                                             |
| `externalVersion`   | varchar   | Etag / Hash / Update-Timestamp des Shops zur Konflikterkennung                                                                                                                      |
| `syncDirection`     | enum      | `push` (slopware -> Shop), `pull` (Shop -> slopware), `bidirectional`                                                                                                               |
| `payloadSnapshot`   | jsonb     | Normalisierter Snapshot des letzten Syncs (für Debugging & Diffing vor dem Senden)                                                                                                  |
| `lastSyncAt`        | timestamp | Letzter erfolgreicher Sync                                                                                                                                                          |
| `syncStatus`        | enum      | `pending`, `success`, `error`                                                                                                                                                       |
| `deletedAt`         | timestamp | Soft-Delete (intern)                                                                                                                                                                |
| `externalDeletedAt` | timestamp | Markierung für Tombstones (im Shop gelöscht)                                                                                                                                        |

---

## 3. Feldgenaue Ownership-Regeln (Mastership)

Die Ownership-Regeln bestimmen, ob ein Datenfeld bei einer bidirektionalen Synchronisierung aus dem ERP in den Shop _gepusht_ oder aus dem Shop ins ERP _gepullt_ wird. Hier ist die feingranulare Matrix:

| Entität            | Feld(er)                              | Führendes System (Master)            | Beschreibung / Konfliktlösung                                                                                                                 |
| :----------------- | :------------------------------------ | :----------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------- |
| `article`          | `.name`, `.description`, `.seoData`   | **slopware** (ERP)                   | PIM-Stammdaten werden im ERP gepflegt und überschreiben den Shop.                                                                             |
| `article_variant`  | `.sku`, `.ean`, `.weight`             | **slopware** (ERP)                   | Eindeutige Kennzeichen kommen immer aus dem ERP.                                                                                              |
| `article_variant`  | `.price` (Basispreis)                 | **slopware** (ERP)                   | Preishoheit liegt im ERP.                                                                                                                     |
| `inventory_level`  | `.quantity`                           | **slopware** (ERP)                   | Der physische Bestand liegt im ERP. Änderungen pushen wir in Echtzeit / Near-Time in die Shops.                                               |
| `document`         | `.order_header` (Gesamtpreis, Datum)  | **Shop**                             | Die kaufmännische Hoheit (Vertragsschluss) liegt beim Shop. Slopware importiert den Stand.                                                    |
| `document_line`    | `.quantity`, `.price`                 | **Shop**                             | Bestelldetails werden 1:1 aus dem Shop übernommen.                                                                                            |
| `document`         | `.fulfillment_status`, `.tracking`    | **slopware** (ERP)                   | Sobald im ERP der Versand gebucht wird, pusht slopware das Tracking an den Shop.                                                              |
| `document`         | `.payment_status`                     | **Shop**                             | Bei B2C-Shops verwaltet der Shop (z.B. Shopify Payments) die Zahlung. Das ERP importiert den Payment-Status.                                  |
| `customer`         | `.email`, `.vatId`                    | **Sales Channel `masterDataPolicy`** | Eine harte Betriebsregel pro Sales Channel legt fest, wer führt (B2B = oft ERP, B2C = oft Shop).                                              |
| `customer_address` | `.shippingAddress`, `.billingAddress` | **Shop**                             | Adressen, die bei einer _Bestellung_ abgegeben wurden (Snapshot), dürfen rückwirkend vom ERP nicht für diese Bestellung überschrieben werden. |

---

> [!TIP]
>
> ## Implementierungsphase
>
> Dieses Dokument ist nun finalisiert und dient als Blaupause für die Drizzle-Migration in `app.schema.ts`.
