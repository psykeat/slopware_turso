Varianten-CRUD & Integration Plan v1.0
Dieses Dokument definiert das Zielbild, die Migration und die Implementierung der Varianten-Domäne in slopware. Ziel ist eine durchgängig variantenzentrierte Architektur, in der Varianten die kaufbare, bepreisbare, lagerführende und in Belegen referenzierte Einheit sind.

1. Zielbild
   Slopware verlagert den operativen Fokus von article auf article_variant. Der Parent-Artikel bleibt Stammdatencontainer, während operative Prozesse wie Preisfindung, Lagerführung, Belegzeilen und Sync auf Variantenebene arbeiten.

Daraus folgen diese Grundregeln:

article = Parent-/Katalogeinheit, nicht primäres operatives Ziel.

article_variant = kaufbare SKU-Einheit mit eigener Identität, SKU, EAN, Gewicht und Status.

inventory_item = lagerführende Einheit je Variante.

inventory_level = Bestand je Lagerort/Kanal und inventory_item.

document_line und price_list_item referenzieren für Katalogpositionen die Variante.

2. Datenmodell
   2.1 Neue Tabellen
   Folgende Tabellen werden eingeführt oder fachlich verbindlich gemacht:

article_variant

article_option

article_option_value

article_variant_option_value

inventory_item

inventory_level

2.2 Kernregeln
Jeder operativ nutzbare Artikel muss mindestens eine Variante besitzen. Für nicht-variable Artikel wird automatisch genau eine Default-Variante erzeugt.

Jede Variante gehört genau zu einem Parent-Artikel.

Jede Variantenkombination wird deterministisch durch ihren option_value_hash identifiziert. Die zugrunde liegenden Optionswerte müssen vor der Hash-Bildung stabil sortiert werden.

Varianten dürfen dieselbe Merkmalskombination innerhalb desselben Artikels nie doppelt besitzen.

2.3 Constraints
Empfohlene Constraints:

UNIQUE(tenant_id, article_id, option_value_hash) auf article_variant.

UNIQUE(tenant_id, sku) auf article_variant.

UNIQUE(tenant_id, inventory_item_id, warehouse_id[, sales_channel_id]) auf inventory_level, falls Kanaltrennung geführt wird. Das Zielmodell fordert Bestand pro Lagerort/Kanal.

document_line.variant_id Pflicht für line_type = 'article'; Freitext-/Versand-/Zuschlagszeilen bleiben ausgenommen. Das aktuelle Schema kennt bereits linetype und artikelbezogene Constraints, die entsprechend erweitert werden können.

2.4 Lifecycle
Hard Delete ist nur für frisch erzeugte, unbenutzte Varianten zulässig.

Sobald Bezüge in Beständen, Belegen oder externen Mappings existieren, ist nur noch Soft Delete/Archivierung erlaubt. Das Zielmodell sieht auch für externe Mappings Tombstone-/Delete-Markierungen vor.

Die letzte aktive Variante eines operativ aktiven Artikels darf nicht gelöscht werden.

3. Migration
   Das Live-Schema ist derzeit noch artikelzentriert: documentline, pricelistitem, inventorymovement und inventorybalance referenzieren aktuell articleid. Die Migration muss deshalb explizit mehrstufig erfolgen.

3.1 Migrationsphasen
Schema-Erweiterung
Neue Variantentabellen einführen, variant_id ergänzen, neue FKs und Constraints vorbereiten.

Backfill
Für jeden bestehenden Artikel ohne Varianten eine Default-Variante erzeugen und ein zugehöriges inventory_item anlegen. Historische artikelbezogene Preis-/Bestands-/Belegdaten werden auf diese Default-Variante gemappt.

Dual-Read / kontrollierte Übergangsphase
Leselogik darf vorübergehend artikel- oder variantenbasierte Altbestände interpretieren, Schreiblogik läuft jedoch ab Umschaltpunkt nur noch variantenbasiert.

Strict Mode
Neue Belegzeilen, Preise und Lagerbewegungen arbeiten nur noch mit variant_id bzw. inventory_item_id. Historische artikelbezogene Pfade werden abgeschaltet.

3.2 Übergangsregeln je Tabelle
document_line: article_id kann vorübergehend als Legacy-/Reportingfeld bestehen bleiben, operative Selektion und Validierung laufen aber über variant_id. Snapshots bleiben auf Zeilenebene.

price_list_item: von artikelbezogen auf variantenbezogen migrieren; artikelbezogene Preislogik ist nur Übergang.

inventory_movement / inventory_balance: mittelfristig auf inventory_item_id umstellen oder durch neue variantezentrierte Strukturen ablösen, da sie derzeit artikelbezogen modelliert sind.

4. Generator-Logik
   Der Variantengenerator ist eine serverseitige Fachoperation und kein normales CRUD-Masseninsert. Das passt zum Command-Modell der Plattform, in dem zusammengesetzte Operationen über registrierte Commands laufen.

4.1 RPC / Command
Empfohlen:

Command-Key: generateVariants

Route: POST /api/commands/generateVariants

Scope: artikelbezogen

server-managed Command mit registrierter ActionBar-Integration. Das Schema und die UI-Architektur sehen dafür bereits eine Command-Registry vor.

4.2 Fachregeln
Der Generator muss:

Variantenachsen und Werte laden.

Achsen in stabiler Reihenfolge sortieren.

Das kartesische Produkt berechnen.

Ausschlussregeln berücksichtigen.

Für jede Kombination den option_value_hash bilden.

Bereits vorhandene Kombinationen überspringen.

Fehlende article_variant-Datensätze anlegen.

Pro neuer Variante transaktional ein inventory_item erzeugen.

4.3 Invarianten
Der Generator ist idempotent. Mehrfaches Ausführen darf keine Dubletten erzeugen.

Der Generator ist inkrementell. Neue Werte erzeugen nur neue Kombinationen.

Bereits vorhandene Varianten werden nie in ihrer Identität überschrieben. Manuell gepflegte Felder wie SKU, EAN oder Status bleiben erhalten.

5. Preislogik
   Langfristiges Ziel ist eine rein variantenbezogene Preisfindung. Das Zielmodell sieht articlevariant als eigentliches Mapping- und Preisziel vor.

5.1 Zielregel
price_list_item.variant_id ist für Katalogpreise Pflicht.

Variantenpreise überschreiben keine artikelbezogene Logik “optional”, sondern bilden die primäre Preisbasis.

5.2 Übergangsregel
Während der Migration darf ein historischer Fallback auf artikelbezogene Preise oder auf die Default-Variante existieren. Dieser Fallback ist jedoch ausdrücklich nur temporär und kein dauerhaftes Zielbild.

6. Lager & Bewegungen
   Bestände werden varianten- und lagerortbezogen geführt. Das entspricht dem Zielmodell und auch gängigen Commerce-/ERP-Mustern, bei denen Verfügbarkeit auf Variantenebene ausgewiesen wird.

6.1 Buchungsanker
inventory_item ist der primäre Buchungsanker für operative Lagerlogik. variant_id allein reicht als logischer Bezug, aber inventory_item ist die bessere lagerfachliche Einheit für spätere Erweiterungen wie Batch, Seriennummern oder standortbezogene Policies.

6.2 Bestandsmodell
inventory_level führt je inventory_item und Lagerort/Kanal mindestens:

on_hand

reserved

available

optional expected

6.3 Migration bestehender Bestände
Da das aktuelle Schema inventorybalance und inventorymovement noch auf articleid führt, müssen bestehende Bewegungen und Salden im Backfill auf die Default- oder Zielvariante überführt werden. Nach Umschaltpunkt werden neue Buchungen nur noch variantenscharf geschrieben.

7. Belegfluss
   document_line muss bei Katalogpositionen die Variante referenzieren, weil sie die tatsächlich verkaufte Einheit darstellt. Auch andere Systeme erzwingen Variantenangabe in Belegen, wenn Varianten existieren, um Lager und Transaktionen konsistent zu halten.

7.1 Auswahl
Auswahl beginnt fachlich beim Artikel.

Hat der Artikel genau eine aktive Default-Variante, wird diese still automatisch gesetzt.

Hat der Artikel mehrere aktive Varianten, ist die Variantenauswahl verpflichtend.

7.2 Lookup
Der Varianten-Lookup ist ein abhängiges Lookup auf Basis des gewählten Artikels. LookupTable/Dropdown sollen laut Plattformstandard aus Foreign Keys, Hilfsregistern und Metadaten abgeleitet werden, nicht aus ad hoc Verdrahtung.

Empfohlene Anzeige:

SKU

Variantenbeschreibung / Optionszusammenfassung

verfügbarer Bestand

Aktivstatus

7.3 Snapshots
document_line speichert Snapshotdaten wie Artikeltext, Variantentext, Preis zum Buchungszeitpunkt und ggf. EAN/SKU-Snapshot, damit spätere Stammdatenänderungen alte Dokumente nicht verfälschen. Das aktuelle Schema hat bereits articletextsnapshot und kann entsprechend erweitert werden.

7.4 Nicht-Katalogzeilen
Freitext-, Versand- und Zuschlagszeilen bleiben erlaubt und umgehen die Pflicht-Variante über line_type != 'article'. Das aktuelle Schema unterstützt bereits verschiedene linetype-Werte.

8. UI & Generic-First Integration
   Die Umsetzung soll möglichst auf Standardkomponenten aufsetzen: TriViewWorkspace, DataGrid, EntityMask, LookupTable, ActionBar, ContextTabs und InspectorPanel werden laut Architektur aus effektiven Entity-Definitionen und Command-Metadaten gespeist.

8.1 Artikelmodul
Im Artikelmodul wird ein Varianten-Workspace ergänzt:

Optionen-Editor
Pflege von article_option und article_option_value.

Varianten-Grid
Anzeige aller Varianten eines Artikels mit SKU, Optionszusammenfassung, Aktivstatus und Lagerkennzahlen. DataGrid ist laut Plattformstandard die Default-Komponente für solche Listen.

Inspector / Kontext
Detailansicht für Bestände je Lagerort, Preise, Mappings und Audit-Kontext.

8.2 Commands
Mindestens folgende Commands registrieren:

generateVariants

archiveVariants

reactivateVariants

suggestVariantSkus

bulkUpdateVariantPrices

bulkUpdateVariantWeights

8.3 Introspection & Helper Registry
Für die neuen Entities müssen Introspection-/Helper-Definitionen ergänzt werden, damit:

business-fähige Anzeigen statt UUIDs erscheinen,

Varianten-Lookups sinnvoll sortiert und gefiltert werden,

ContextTabs und ActionBar die neuen Commands kennen.

9. Bulk-Operationen
   Für eine praxistaugliche Erfassung reicht Einzel-CRUD nicht aus. Varianten brauchen Bulk-Operationen für Massenpflege, insbesondere bei Sortimentsänderungen.

Pflichtumfang:

Bulk Aktivieren / Deaktivieren

Bulk Archivieren ungenutzter Varianten

Bulk SKU-Vorschläge

Bulk Preisänderungen

Bulk Gewichtsänderungen

optional Bulk Lagerzuordnung / Initialbestände

10. Reporting & Downstream
    Das Ist-Schema enthält bereits Reporting-nahe Strukturen wie factsalesevent, aktuell jedoch artikelzentriert. Für konsistente Analysen sollte Variantenbezug mittelfristig ergänzt werden.

Empfehlung:

factsalesevent.variant_id ergänzen,

article_id für Rollups und Parent-Auswertungen beibehalten,

Reports standardmäßig sowohl nach Artikel als auch nach Variante aggregierbar machen.

11. Tests
    Die Varianten-Domäne braucht mehr als reine CRUD-Tests. Neben UI und API müssen Invarianten, Migration und Parallelität abgesichert werden.

Pflichttests:

Idempotenz: zweimal generieren, keine Dubletten.

Inkrementell: nur fehlende Kombinationen entstehen.

Default-Variante: Artikel ohne Achsen erhält automatisch Default-Variante plus inventory_item.

Constraint: document_line vom Typ Artikel ohne variant_id schlägt fehl.

Hard-Delete-Guard: genutzte Varianten können nicht physisch gelöscht werden.

Bestandsbuchung: Bewegung auf Variante A / Lagerort X verändert nur diese Ebene.

Lookup-Filter: nur aktive Varianten werden vorgeschlagen.

Concurrency: parallele generateVariants-Aufrufe erzeugen trotz Race keine Dubletten; Constraint und Transaktion schützen die Integrität.

Migrationstest: historische artikelbezogene Preise, Bestände und Belege werden sauber auf Default-Varianten überführt.

Command-/UI-Integration: Command-Sichtbarkeit, ActionBar, LookupTable und Fehlerabbildung funktionieren im Standard-Framework konsistent.

12. Umsetzungsreihenfolge
    Empfohlene Reihenfolge:

Variantentabellen + Constraints einführen.

Default-Varianten-Backfill bauen.

Generator-Command serverseitig implementieren.

Artikelmodul um Optionen-/Varianten-Workspace erweitern.

document_line variant-aware machen.

Preisfindung auf Varianten umstellen.

Lagerbewegungen und Bestandsführung auf inventory_item migrieren.

Reporting/Facts erweitern.

Legacy-Pfade abschalten.

13. Architekturentscheidungen
    Festgelegte Entscheidungen:

Varianten sind die operative Primäreinheit.

Nicht-variable Artikel erhalten eine Default-Variante.

Variantengenerierung ist ein serverseitiger Command, nicht clientseitige Bulk-CRUD-Logik. Das passt zum Command- und Fokusmodell der Plattform.

Preise, Belegzeilen und Bestand werden langfristig strikt variantenbezogen geführt.

Soft Delete statt Hard Delete für genutzte Varianten.
