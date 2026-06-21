# E-Commerce Refactor - Ist-Stand und Verifikation

Dieses Dokument fasst den aktuellen Entwicklungsstand der E-Commerce-Umstellung zusammen und gleicht die Plan-Dokumente in `.agents/plans/` mit dem Live-Code ab. Ziel ist ein verifizierter Ueberblick darueber, was bereits variantenzentriert umgesetzt ist, was nur als Infrastruktur vorhanden ist und wo noch klare Luecken bestehen.

## Quellenbasis

Beruecksichtigt wurden die folgenden Plan-Dokumente:

- `.agents/plans/unified_ecommerce_data_model.md`
- `.agents/plans/variant_crud_plan.md`
- `.agents/plans/variant_implementation_plan.md`
- `.agents/plans/ecommerce-sync-plan.md`

Verifizierte Live-Dateien:

- `packages/db/src/schema/app.schema.ts`
- `packages/db/src/services/article-variant-generator.ts`
- `packages/db/src/services/default-variant-backfill.ts`
- `packages/db/src/services/ecommerce-variant.ts`
- `packages/db/src/services/ai-discovery.ts`
- `packages/db/src/services/metadata.ts`
- `packages/db/src/services/document-service.ts`
- `packages/db/src/services/data.variant.test.ts`
- `packages/db/src/services/document-service.variant.test.ts`
- `packages/db/src/services/article-variant-generator.test.ts`
- `packages/db/src/services/default-variant-backfill.test.ts`

## Kurzfazit

Der Kern des Refactors ist bereits deutlich im Code angekommen:

- Varianten sind als eigene Entitaet im Schema vorhanden.
- Inventory ist auf `variantId` ausgerichtet.
- `document_line` ist fuer Katalogzeilen variant-aware.
- Preislisten, Sync-Mapping und Lookup-Metadaten sind grundsaetzlich auf das Variantenmodell vorbereitet.
- Der Variantengenerator und der Default-Backfill sind implementiert und getestet.

Der Refactor ist aber noch nicht durchgaengig abgeschlossen:

- `inventory_balance` ist weiterhin artikelzentriert.
- Der Dokumenten-Posting-Pfad hat noch einen offenen Bruch im Variant-zu-Inventory-Flow.
- `price_list_item` enthaelt noch parallele Artikel- und Variantenbezugspfade.
- Das Sync- und Command-Modell existiert als Fundament, aber nicht als sichtbar abgeschlossene End-to-End-E-Commerce-Integration.

## Verifizierter Status nach Themen

| Bereich               | Status                  | Verifikation                                                                                                                   | Bewertung                                                                                                |
| --------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Variantenmodell       | Implementiert           | `articleVariant`, `articleOption`, `articleOptionValue`, `articleVariantOptionValue` in `packages/db/src/schema/app.schema.ts` | Basis ist vorhanden und konsistent modelliert                                                            |
| Inventory-Anker       | Implementiert           | `inventoryItem` ist auf `variantId` verpflichtet, `inventoryLevel` haengt an `inventoryItem`                                   | Operative Lagerhaltung ist variantennah                                                                  |
| Dokumentzeilen        | Teilweise abgeschlossen | `documentLine.variantId` ist vorhanden, Artikelzeilen erfordern `variantId` per Check-Constraint                               | Fachlich variant-aware, aber nicht ueberall vollstaendig verkettet                                       |
| Preislisten           | Teilweise abgeschlossen | `priceListItem` hat `variantId`, aber auch noch `articleId`                                                                    | Migration nicht finalisiert                                                                              |
| Externes Sync-Mapping | Implementiert           | `externalSyncMapping` mit Unique Constraints fuer interne und externe IDs                                                      | Solide Mapping-Basis vorhanden                                                                           |
| Metadaten / Lookup    | Implementiert           | `helperTableRegistry`, `resolveLookupTable()`, variantenspezifische Lookup-Tests                                               | Varianten werden in Lookups sichtbar gemacht                                                             |
| Variantengenerierung  | Implementiert           | `generateArticleVariants()` plus Tests fuer Idempotenz und Concurrency                                                         | Laufzeitlogik ist vorhanden und stabil                                                                   |
| Default-Backfill      | Implementiert           | `backfillDefaultArticleVariants()` plus Test                                                                                   | Altartikel koennen auf Default-Varianten gehoben werden                                                  |
| Dokumenten-Posting    | Teilweise abgeschlossen | `document-service.variant.test.ts` zeigt einen aktuellen Fehler im Posting-Pfad                                                | Offener Integrationsbruch                                                                                |
| Reporting             | Teilweise abgeschlossen | `factSalesEvent` hat `variantId`, aber Altpfade sind noch sichtbar                                                             | Varianten-Reporting ist vorbereitet, aber nicht komplett umgestellt                                      |
| Commands / Discovery  | Teilweise abgeschlossen | `ai-discovery.ts` bootstrapped `generateVariants` und `archiveVariants`                                                        | Discovery kennt die Commands, aber ich habe keinen separaten Runtime-Handler im geprueften Code gefunden |

## Was bereits umgesetzt ist

### 1. Varianten sind ein erstklassiges Schema-Konzept

In `packages/db/src/schema/app.schema.ts` ist das Variantenmodell bereits sauber ausformuliert:

- `articleVariant` mit `sku`, `ean`, `optionValueHash`, `price`, `weight` und Aktivstatus.
- `articleOption` und `articleOptionValue` fuer die Achsen- und Werteverwaltung.
- `articleVariantOptionValue` als Join-Tabelle fuer die exakte Kombination.
- Eindeutigkeitsregeln auf `sku` und auf `(tenantId, articleId, optionValueHash)`.

Das entspricht dem Zielbild aus den Plandokumenten: Varianten sind die operative Einheit, nicht der Parent-Artikel.

### 2. Inventory ist auf Varianten verdrahtet

Die schema-seitige Lagerbasis ist bereits auf `variantId` umgestellt:

- `inventoryItem` referenziert zwingend `articleVariant`.
- `inventoryLevel` referenziert `inventoryItem` und `warehouse`.
- Tests bestaetigen, dass die Variantenansicht Verfuegbarkeit aus `inventory_level` ableitet und im Lookup-Label mit SKU, Optionszusammenfassung und Verfuegbarkeit ausgibt.

Das ist ein wichtiger Fortschritt, weil damit die fachliche Lagerlogik nicht mehr nur auf Artikelniveau gedacht wird.

### 3. Varianten koennen generiert und nachtraeglich aufgebaut werden

`packages/db/src/services/article-variant-generator.ts` implementiert die komplette Generierungslogik:

- Laden der Artikeloptionen und Werte.
- Deterministische Sortierung der Achsen.
- Kartesisches Produkt aller Kombinationen.
- Hash-Bildung ueber `createArticleVariantOptionValueHash()`.
- Idempotentes Anlegen von `articleVariant` und dazugehoerigem `inventoryItem`.

Die dazugehoerigen Tests bestaetigen:

- korrekte Erzeugung des kartesischen Produkts,
- Idempotenz bei erneutem Lauf,
- Stabilitaet bei paralleler Ausfuehrung.

Zusatzlich gibt es `packages/db/src/services/default-variant-backfill.ts` fuer Artikel ohne Varianten:

- erzeugt eine Default-Variante auf Basis eines leeren Hashes,
- legt pro Variante ein Inventory-Item an,
- ist ebenfalls idempotent getestet.

### 4. Dokumentzeilen sind variant-aware

`documentLine` hat bereits `variantId`, und fuer normale Artikelzeilen greift ein Check-Constraint, der `variantId` verlangt.

Die Variante wird im Dokumentenfluss also nicht mehr als Sonderfall behandelt, sondern als Pflichtbezug fuer Katalogzeilen.

Das wird auch durch die Tests abgesichert:

- `saveDocumentDraft` lehnt Katalogzeilen ohne `variantId` ab.

### 5. Lookup- und Metadaten-Schicht kennt das Variantenmodell

In `packages/db/src/services/metadata.ts` und `packages/db/src/services/ai-discovery.ts` ist das Variantenmodell auch in der Metadaten- und Discovery-Schicht angekommen:

- `variantId` wird als Lookup auf `articleVariant` aufgeloest.
- `optionId` und `valueId` werden auf `articleOption` und `articleOptionValue` aufgeloest.
- Die Variantenansicht bekommt zusammengesetzte Labels statt UUIDs.

Das ist wichtig, weil der Refactor nicht nur DB-Design ist, sondern auch die generische UI- und Inspector-Erfahrung veraendert.

### 6. Sync-Fundament ist vorhanden

`externalSyncMapping` ist im Schema vorhanden und bereits mit den im Plan geforderten Unique-Constraints versehen:

- intern eindeutig pro `(tenantId, salesChannelId, entityType, internalId)`,
- extern eindeutig pro `(tenantId, salesChannelId, entityType, externalId)`.

Zusatzlich existiert `connectorDefinition` als Plattform-Basis fuer Connector-Metadaten.

Das bedeutet: Das Sync-Fundament ist angelegt, auch wenn die konkreten Provider-Connectoren noch nicht als abgeschlossene End-to-End-Flows sichtbar sind.

## Was noch nicht fertig ist

### 1. Bestands- und Posting-Pfad ist noch nicht durchgaengig variantensauber

Der kritischste offene Punkt ist der Posting-/Bestandsfluss in `packages/db/src/services/document-service.ts`.

Die aktuelle Codebasis zeigt:

- `documentLine` arbeitet mit `variantId`.
- `postStandardDocumentLine()` versucht beim Buchen aus der Variante ein `inventoryItem` zu ermitteln.
- `inventoryBalance` bleibt jedoch artikelzentriert.
- `inventoryMovement` fuehrt sowohl `inventoryItemId` als auch `variantId`.

Der praktische Ist-Test zeigt den Bruch:

- `postDocument resolves article truth from variantId, not the stored articleId` faellt aktuell fehl, weil fuer die Variante kein `inventoryItem` gefunden wird.

Das ist kein kosmetisches Problem, sondern ein echter Integrationsbruch im Posting-Pfad.

### 2. Preislisten sind nur halb migriert

`priceListItem` hat zwar `variantId`, aber auch weiterhin `articleId`.

Zusatzlich wirkt die aktuelle Unique-Definition noch nicht sauber ausgeraeumt, weil `variantId` dort doppelt in die Constraint-Definition eingeht. Das ist ein technischer Hinweis darauf, dass die Preislisten-Migration noch nicht ganz abgeschlossen ist.

Fazit:

- Die Zielrichtung ist variantenzentriert.
- Die Altspur ist aber noch nicht entfernt.

### 3. Reporting ist vorbereitet, aber nicht voll umgestellt

`factSalesEvent` fuehrt bereits `variantId`, was gut ist.

Gleichzeitig zeigt die Gesamtsicht im Code, dass Artikelebene und Variantenebene noch parallel existieren. Das passt zu einer Uebergangsphase, aber nicht zu einem finalen Strict-Mode.

### 4. Commands sind nur als Discovery-Fundament sichtbar

In `ai-discovery.ts` gibt es Bootstrapping fuer:

- `generateVariants`
- `archiveVariants`

Das ist ein gutes Zeichen fuer die Plattformintegration.

Ich habe im geprueften Stand aber keinen separat ausgebauten, eindeutigen Runtime-Handler gefunden, der die Commerce-Commands als vollstaendige Produktivfunktion abschliesst. Im Moment wirkt das eher wie Discovery-/Metadaten-Unterstuetzung als wie ein vollstaendig implementierter Connector-Workflow.

## Verifikation durch Tests

Folgende Tests habe ich gegen den aktuellen Code ausgefuehrt:

- `packages/db/src/services/article-variant-generator.test.ts` - bestanden
- `packages/db/src/services/default-variant-backfill.test.ts` - bestanden
- `packages/db/src/services/data.variant.test.ts` - bestanden
- `packages/db/src/services/document-service.variant.test.ts` - teilweise

Ergebnis im Detail:

- Generierung von Varianten ist idempotent und concurrency-safe.
- Default-Backfill fuer fehlende Varianten funktioniert.
- Varianten-Lookups zeigen Verfuegbarkeit und zusammengesetzte Labels korrekt an.
- Das Dokumenten-Posting hat noch einen offenen Fehler, weil ein `inventoryItem` fuer die Variante fehlt.

## Technische Gesamtbewertung

Der Refactor ist in der Daten- und Metadata-Schicht weit fortgeschritten und in einzelnen Kernpfaden bereits produktionsnah:

- Datenmodell: weitgehend variantenzentriert.
- Generator und Backfill: implementiert und getestet.
- Lookup/UI-Metadaten: integriert.
- Sync-Mapping: vorhanden.
- Dokument-/Bestandsprozess: noch nicht konsistent zu Ende migriert.

Wenn man den Zustand grob einordnet, dann ist das kein frisches Konzept mehr, sondern bereits ein teils produktiver Variantenkern mit offenen Migrationsresten im operativen Pfad.

## Naechster sinnvoller Fokus

1. Den Posting-Pfad so schliessen, dass jede postbare Variante ein eindeutiges Inventory-Item hat oder sauber aus dem Backfill ableitbar ist.
2. `priceListItem` und die Bestands-/Reporting-Altspuren auf Strict-Mode bringen.
3. Die Commerce-Commands als echte Runtime-Handler weiterverfolgen, nicht nur als Discovery-Fallback.
4. Danach den Sync-Connector-Teil als naechste vertikale Scheibe sauber ausarbeiten.
