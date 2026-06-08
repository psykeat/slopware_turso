# Verbesserungsplan für das Email-Modul (basierend auf Zero Mail)

Dieser Plan listet die fehlenden Funktionen und Verbesserungsvorschläge für unsere Email-Übersicht, Anzeige und das Compose-Fenster auf. Er beinhaltet die bereits angesprochenen Punkte sowie weitere Best-Practices moderner Mail-Clients.

## 1. Account-Switcher (Navigation / Header)

- **Erweiterte Anzeige im Dropdown:** Neben dem Account-Namen muss auch die zugehörige E-Mail-Adresse angezeigt werden (konsistent zum Navigation Tree).
- _Optional:_ Anzeige des Speicherplatz-Kontingents (Quota) oder eines Avatar-Icons je Account zur besseren visuellen Trennung.

## 2. E-Mail verfassen (Compose / Reply)

- **Rich-Text-Editor (Lexical mit AI-Integration):** Umsetzung des E-Mail-Bodys mit **Lexical**. Es ist komplett Open Source (ohne Paid Tiers) und bietet die tiefste Kontrolle für unsere geplante native AI-Integration. Dazu implementieren wir:
  - _SelectionPlugin:_ Reagiert auf `SELECTION_CHANGE_COMMAND` und liest die aktuelle Range aus.
  - _AiOverlayPlugin:_ Rendert ein Floating Menu bei Text-Selektion. Mit `SKIP_DOM_SELECTION_TAG` und `SelectionAlwaysOnDisplay` stellen wir sicher, dass der Fokus beim Klicken des Overlays nicht springt.
  - _AiCommandPlugin:_ Sendet Prompts ("rephrase", "shorten", "more formal") an die TanStack-AI-Route.
  - _ReplaceOrSuggestPlugin:_ Ersetzt den markierten Text direkt oder bietet ein Accept/Reject-Muster für AI-Vorschläge an.
- **Intelligentes Adress-Overlay (To/Cc/Bcc):** Implementierung einer schönen Overlay-/Dropdown-Funktion für Kontakte, die direkt an unsere neue `address_contact` Datenbank angebunden ist.
- **Drag & Drop für Anhänge:** Möglichkeit, Dateien direkt in den Compose-Bereich zu ziehen, inklusive Vorschau.
- **Auto-Save / Entwürfe:** Automatisches Zwischenspeichern des aktuellen Textes als Entwurf.
- **Signaturen:** Unterstützung für anpassbare E-Mail-Signaturen (HTML/Text), die je Account automatisch eingefügt werden.

## 3. E-Mail Übersicht (Inbox / List)

- **Erweiterte Filter & Sortierung:** Schnellfilter für "Ungelesen", "Mit Anhang" oder "Markiert".
- **Bulk-Actions (Massenbearbeitung):** Mehrere E-Mails über Checkboxen markieren und per Knopfdruck archivieren, löschen oder als gelesen markieren.
- **Hover- & Swipe-Aktionen:** Schnellzugriffs-Icons (Archivieren, Löschen), die beim Hovern über eine Zeile (Desktop) oder Wischen (Touch) erscheinen.
- **Paginierung / Infinite Scroll:** Optimiertes Nachladen für Postfächer mit vielen Mails.

## 4. E-Mail Anzeige (Display / Read)

- **Sicheres HTML-Rendering & Privacy:** Sicheres Rendering von HTML-Mails und standardmäßiges Blockieren von externen Tracking-Bildern (mit "Bilder laden" Option).
- **Inline-Antwort (Quick Reply):** Ein kleines Eingabefeld direkt am Ende der Mail für schnelle Antworten.
- **Anhang-Vorschau:** Bilder und PDFs direkt in der App ansehen.
- **Druck- & Export-Funktion:** Mails ohne restliches UI drucken.
- **Thread-Darstellung:** Übersichtliches Ein- und Ausklappen von langen E-Mail-Verläufen.

## 5. Offene Architektur- & Designfragen (Grill-Me Status)

Bevor die Implementierung starten kann, müssen folgende Punkte noch endgültig geklärt werden:

**1. Das Adress-Overlay für To/Cc/Bcc (`address_contact` DB)**

- _UI-Komponente:_ Nutzen wir für das Overlay eine bestehende Komponente aus `@repo/ui` (z. B. `Combobox` oder `Command`-Dialog), oder bauen wir ein komplett eigenes Floating-Widget?
- _Datenbeschaffung (Fetching):_ Haben wir bereits eine TanStack Query-Route (z. B. `useContactsQuery`), die nach Namen/E-Mails in der `address_contact` Tabelle sucht, oder muss dieser Drizzle-Endpunkt im Backend erst noch geschrieben werden?

**2. Das Account-Dropdown (Navigation)**

- _State-Management:_ Wo wird der State für den aktuell ausgewählten Account gespeichert? (Globaler Context, URL via TanStack Router, Local Storage?)
- _Komponenten-Design:_ Nutzen wir für das Dropdown den Standard `Select` aus `shadcn/ui` (mit Custom-Item für Name + E-Mail) oder existiert dafür bereits eine spezifische Switcher-Komponente im Workspace?
