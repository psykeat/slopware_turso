# Langtexte Umsetzung

## Ziel

Langtexte für Artikel, Adressen, Ansprechpartner, Dokumente und Belegzeilen einführen. Die Texte werden als HTML in `text`-Spalten gespeichert, pro Feld live verknüpft bis zur manuellen Bearbeitung, und beim Buchen von Dokumenten eingefroren.

## Fachliche Regeln

- Texte sind eigene `text`-Spalten in den Zieltabellen.
- Pro Feld gibt es eigene Link-Metadaten direkt in der Zielzeile.
- Automatische Vorbelegung erfolgt beim Wechsel von Artikelnummer oder Adressnummer.
- Manuelle Bearbeitung trennt die Live-Verknüpfung, bis der Nutzer bewusst neu übernimmt.
- Belege werden beim Buchen eingefroren.
- Rich Text wird als HTML im `text`-Feld gespeichert.
- HTML ist für spätere Webshop-Exporte ausreichend; der Export-Kontext wird nur vorbereitet.
- Pro Beleg gibt es eine optionale Druck-Optionsmaske, deren Werte am Beleg gespeichert werden.

## Company-Konfiguration

Neue Company-Schalter:

- `langtexteNurBeiAenderungUebernehmen`
- `langtextAddressdatenAndrucken`
- `vortextAndrucken`
- `nachtextAndrucken`
- `positionstexteAndrucken`

Zusatz:

- `positionstexteAndrucken` ist in `article_group` und `article` übersteuerbar.
- Druck-Optionen werden pro Beleg gespeichert und im Ausdruck dialogisch übersteuerbar gemacht.

## Datenmodell

Zieltabellen:

- `article`
- `article_group`
- `address`
- `address_contact`
- `document`
- `document_line`
- `company`

Pro relevantem Langtext-Feld werden ergänzt:

- Inhaltsspalte `text`
- `...SourceEntity`
- `...SourceId`
- `...SourceField`
- `...LinkedAt`
- `...OverriddenAt`

Zusätzliche Dokument-Metadaten für Storno:

- `stornotextErzeugtAm`
- `stornotextErzeugtVon`
- `stornotextStornogrund`

## UI

### Gemeinsame Bedienung

- Ein gemeinsamer Langtext-Tab/Toggle pro Datensatz.
- Optisch überall gleich.
- Kontextabhängige Beschriftung nur über die aktuelle Entität.
- Kleine, kompakte Rich-Text-Toolbar.
- Override-Zustand klar markieren, z. B. blau für individuelle Texte.
- Der Editor bekommt pro Datensatz/Zeile einen stabilen `syncKey`, damit Drafts bei Kontextwechseln nicht in andere Records überlaufen.
- Die Badge-Anzeige basiert auf echten `linked`/`overridden`-Metadaten und nicht nur auf einem bloßen Source-Label.

### Adressen und Artikel

- Langtexte im rechten Kontextbereich als zusätzlicher Tab neben Details/Contacts.
- Schlanker Editor mit Toggle zwischen den einzelnen Langtext-Feldern.
- Adressen zeigen zusätzlich den Ansprechpartner-Langtext im Edit-Kontext an.
- Artikel- und Adresslangtexte verwenden echte Source-Metadaten aus der jeweiligen Zeile.

### Dokumente

- Langtexte im rechten Frame über dem Audit-Verlauf.
- Zusätzliche Optionsmaske für Druckschalter.
- Belegtexte werden im Dokumenteditor verwaltet und beim Buchen eingefroren.
- Header- und Positionslangtexte verwenden ebenfalls `syncKey`, damit beim Wechsel zwischen Belegen/Zeilen keine alten Drafts sichtbar bleiben.

## Druck

- Druck rendert die eingefrorenen Belegtexte.
- Company-Defaults werden als Ausgangsbasis verwendet.
- Pro Beleg gespeicherte Druckoptionen übersteuern Company-Defaults.

## Umsetzungsschritte

1. Schema und Migration für Langtextfelder, Link-Metadaten und Company-Schalter.
2. Gemeinsame Rich-Text-/Langtext-Komponente und Toggle-UI.
3. Integration in Adresse, Artikel und Dokument.
4. Druckdialog und PDF-Rendering.
5. Übernahme- und Freeze-Logik in Dokument-Service und Dokument-Editor.
6. Anschluss an spätere Export-Kontexte.

## Risiken

- Neue Felder müssen in Metadaten, Import/Export und CRUD-Flow sauber sichtbar werden.
- Dokument-Live-Verknüpfung darf nach dem Buchen nicht mehr still mutieren.
- Rich-Text-HTML muss im UI sicher gerendert werden.

## Konkrete Implementierungsdetails

### Feldkonvention

- Zielobjekte speichern den formatierten Inhalt direkt in `text`-Spalten.
- Link-Metadaten werden pro Feld direkt in derselben Zeile gespeichert.
- Für Dokumente und Zeilen gilt die englische CamelCase-Konvention in der Code-Schicht:
  - `noteText`
  - `preText`
  - `postText`
  - `stornoText`
  - `langText`
- Für Adressen und Artikel ist die bestehende Benennung mit `notiztext`, `langtext`, `warntext`, `kurzbeschreibung` weiterverwendet.
- Die Metadaten folgen dem Muster:
  - `...SourceEntity`
  - `...SourceId`
  - `...SourceField`
  - `...LinkedAt`
  - `...OverriddenAt`

### Übernahme- und Override-Regeln

- Ein Feld ist live verknüpft, solange `...SourceEntity` und `...SourceId` gesetzt sind und `...OverriddenAt` leer ist.
- Die UI zeigt in diesem Fall immer den Quellwert, nicht den lokalen Speicherstand.
- Sobald der Nutzer das Feld manuell bearbeitet, wird die Verknüpfung getrennt:
  - Source-Metadaten werden gelöscht.
  - `...OverriddenAt` wird gesetzt.
  - Der lokale HTML-Wert bleibt erhalten.
- Eine bewusste Neuübernahme setzt die Source-Metadaten wieder und überschreibt den lokalen Wert mit dem Quellwert.
- Die automatische Vorbelegung passiert nur an den fachlichen Ankerpunkten:
  - Artikelwechsel
  - Adresswechsel
- Auf Server-Seite werden manuelle Textänderungen in den Zieltabellen als Override behandelt, sofern keine Meta-Felder explizit mitgesendet werden.

### Company-Logik

- `langtexteNurBeiAenderungUebernehmen` steuert, ob bei Entitätswechsel nur bestehende Verknüpfungen aktualisiert werden oder immer neu übernommen wird.
- `langtextAddressdatenAndrucken`, `vortextAndrucken`, `nachtextAndrucken` und `positionstexteAndrucken` sind Druck-Defaults auf Company-Ebene.
- `positionstexteAndrucken` kann zusätzlich in `article_group` und `article` übersteuert werden.
- Der Druckdialog speichert die Optionen am Beleg, damit Nachdrucke reproduzierbar bleiben.

### Dokument-Lifecycle

- Beim Erfassen eines Dokuments werden Header-Texte und Zeilentexte automatisch vorbelegt, wenn die Quelle verfügbar ist.
- Beim Speichern des Entwurfs bleiben die Texte editierbar.
- Beim Buchen werden die Texte eingefroren:
  - Source-Metadaten werden entfernt.
  - Der aktuelle HTML-Stand wird final gespeichert.
  - Storno-Texte werden bei Bedarf automatisch erzeugt.
- Der erzeugte Storno-Text enthält Timestamp, Benutzer und Stornogrund.

### UI-Implementierung

- Die gemeinsame Komponente ist `LangtextEditor` in `packages/ui/components/langtext-editor.tsx`.
- Diese Komponente arbeitet als kompakter Toggle-Editor mit mehreren Feldern und einer gemeinsamen Toolbar.
- Die Detailansicht für Datensätze soll überall gleich aussehen und nur den Kontext wechseln.
- Adressen und Artikel nutzen den rechten Detailbereich mit dem Tab `Langtexte`.
- Dokumente zeigen die Langtext-Bearbeitung im rechten Bereich oberhalb des Audit-Verlaufs.
- Override-Zustände sollen visuell markiert werden, bevorzugt über blaue Akzente für individuelle Inhalte.
- Für einzelne Records gibt es `LangTextRecordPanel` als Standard-Wrapper um den gemeinsamen Editor.

### Aktueller Code-Stand

- `apps/web/src/routes/_auth/app/addresses.tsx`
  - `Langtexte`-Tab vollständig funktionsfähig integriert.
  - Felder: `notiztext`, `warntext`, `langtext` (ordnungsgemäß an Drizzle-Schema angepasst).
  - Ansprechpartner-Langtext (`addressContact.notiztext`) ist im Edit-Kontext eingebunden.
- `apps/web/src/routes/_auth/app/articles.tsx`
  - `Langtexte`-Tab vollständig funktionsfähig integriert.
  - Felder: `notiztext`, `langtext`, `kurzbeschreibung`, `warntext` (Feld `description` wurde erfolgreich auf die vererbbare Spalte `kurzbeschreibung` korrigiert).
- `packages/ui/components/document-editor.tsx`
  - Unterstützt Header-Langtexte und Zeilen-Langtext.
  - Casing-Konflikte bei der Übernahme behoben (Zugriffe erfolgen nun auf die kleingeschriebenen Spalten `notiztext` und `langtext` aus dem Schema).
  - Header- und Positionseditoren nutzen stabile `syncKey`s, damit Drafts kontextgebunden bleiben.
  - Typen in `ArticleMetaRow` an das Schema angepasst.
- `packages/db/src/services/document-service.ts`
  - Persistiert Langtexte und Link-Metadaten beim Entwurf.
  - Friert Texte beim Buchen ein.
  - Erzeugt Storno-Langtext automatisch.
- `packages/db/src/services/data.ts`
  - Allgemeine PATCH-Logik trennt manuelle Textänderungen nun serverseitig als Override, wenn keine Metadaten mitgesendet werden.
- `packages/db/src/services/metadata.ts`
  - Hält dynamic CRUD-Masken sauber, indem alle technischen Langtext-Metadaten-Spalten (z. B. `...SourceEntity`, `...LinkedAt` etc.) in `getEffectiveFields` standardmäßig ausgeblendet werden (`isVisible: false`).
- `apps/web/src/routes/api/documents/$documentId/print.tsx`
  - Übergibt die gespeicherten Texte an das PDF-Rendering.
- `apps/web/src/pdf/document-pdf.tsx`
  - Rendert die eingefrorenen Texte und nutzt einen HTML-zu-Text-Strip für die PDF-Ausgabe.
