# Weitere Verbesserungen der AI-Architektur

Dieses Dokument beschreibt die nächsten Schritte zur Verbesserung der AI-Implementierung.

## Proposed Changes

### [MODIFY] [AiOverlayHost.tsx](file:///home/ubuntu/slopware/apps/web/src/components/ai/AiOverlayHost.tsx)

Wir entfernen die hartkodierte Blockade, die verhindert, dass der AI-Agent für etwas anderes als `emailThread` gestartet wird.

- Das Backend (`/api/ai/context/resolve`) ist bereits dafür zuständig, die verfügbaren Tasks (falls vorhanden) zu definieren. Die Frontend-Komponente muss das nicht nochmals validieren.
- So können in Zukunft sehr einfach neue Tasks für Dokumente oder Adressen hinzugefügt werden.

### [MODIFY] [ai-context-projection.ts](file:///home/ubuntu/slopware/packages/db/src/services/ai-context-projection.ts)

- **Token Limit für E-Mails:** In `buildMailThreadProjection` begrenzen wir die Anzahl der an das LLM übergebenen Nachrichten auf die letzten 5 (bzw. die neusten). So verhindern wir Token-Overflows bei sehr langen Threads. Wir schneiden die Nachrichtenliste einfach ab und geben einen Hinweis aus, falls Nachrichten übersprungen wurden.

### [MODIFY] [$.ts](file:///home/ubuntu/slopware/apps/web/src/routes/api/ai/$.ts)

- **Prompt Injection Schutz:** Wir verpacken den generierten Kontext (den `rawInput`, der an den Orchestrator gesendet wird) explizit in XML-Tags (z.B. `<business_context> ... </business_context>`). Dies hilft dem LLM, den eigentlichen Inhalt als zu verarbeitende Daten und nicht als Systemanweisungen zu interpretieren.

> Das Problem mit dem "Lazy Loading" im Frontend (Laden aller Adressen beim Öffnen) erfordert ein tieferes Refactoring der einzelnen _Review Components_, da diese aktuell von diesen synchronen Daten abhängig sind. Ich würde vorschlagen, wir konzentrieren uns zunächst auf diese 3 Architektur-Upgrades (Sicherheit & Flexibilität) und lagern das Lazy-Loading in ein separates Ticket aus.

## Verification Plan

1. App lokal starten.
2. AI Agenten auf einem E-Mail Thread ausführen.
3. Im Transkript prüfen, ob der Input mit `<business_context>` Tags versehen ist und nur die neusten E-Mails enthält.
