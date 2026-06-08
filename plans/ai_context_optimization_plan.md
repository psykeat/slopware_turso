# AI Context Resolution Optimization

Dieses Dokument beschreibt den Plan zur Optimierung der Kontext-Aufbereitung für den AI Agenten, um Token zu sparen und die Performance zu verbessern.

## Proposed Changes

### Database Services

#### [MODIFY] [ai-context-projection.ts](file:///home/ubuntu/slopware/packages/db/src/services/ai-context-projection.ts)

Wir werden die `buildXProjection` Funktionen überarbeiten, um fokussierte, token-sparende Markdown-Strings (`contentText`) für alle Entitäten zu generieren.

**Konkrete Änderungen:**

1.  **Hinzufügen einer `stripEmailQuotes` Hilfsfunktion:** Diese Funktion wird rudimentäre "Quoted Text"-Blöcke aus den E-Mails entfernen.
2.  **Anpassen von `buildMailThreadProjection`:**
    - Verwendung der neuen `stripEmailQuotes` Funktion für den `bodyText`.
    - Leere Felder im Output weglassen.
3.  **Anpassen von `buildDocumentProjection`:**
    - Erzeugung eines `contentText`, der die wichtigsten Dokument-Metadaten auflistet.
    - Auflistung der Dokumenten-Zeilen in einer einfachen, verdichteten Markdown-Liste.
4.  **Anpassen von `buildAddressProjection`:**
    - Erzeugung eines `contentText`, der nur gefüllte Adressfelder enthält.
5.  **Anpassen von `buildArticleProjection`:**
    - Erzeugung eines `contentText`, der Artikelname, Beschreibung und Notizen enthält.

## Verification Plan

- App lokal starten und Agenten aufrufen, Log/Transcript auf sauberen `rawInput` prüfen.
