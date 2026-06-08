# Frontend Refactoring: AiOverlayHost

Dieses Dokument beschreibt den Plan für das umfassende Refactoring der `AiOverlayHost.tsx` und der damit verbundenen Komponenten, um die im ersten Audit identifizierten strukturellen Schwächen zu beheben.

## 1. Ausgangslage & Zielsetzung

Die `AiOverlayHost.tsx` ist mit knapp 900 Zeilen zu komplex. Sie kümmert sich um API-Aufrufe, SSE-Streaming-Logik, Event-Dispatching und UI-Rendering gleichzeitig. Zudem lädt sie Daten ineffizient vorab (eager loading). Ziel dieses Refactorings ist es, die Komplexität in fokussierte Hooks aufzuteilen, die Typensicherheit zu erhöhen und das Daten-Laden zu delegieren.

## 2. Proposed Changes

### [NEW] `apps/web/src/components/ai/hooks/useAiContextResolution.ts`

- Extrahiert die Logik für den POST-Call an `/api/ai/context/resolve`.
- Kümmert sich um den State `resolving-context` und gibt die gefundenen unterstützten Tasks zurück.

### [NEW] `apps/web/src/components/ai/hooks/useAiTaskStream.ts`

- Extrahiert die gesamte Server-Sent Events (SSE) Logik.
- Verbindet sich zu `/api/ai/plan`, liest den Stream aus, aktualisiert den Fortschritt (Transcript) und baut den initialen `payload` und `validation` State zusammen.
- Ersetzt die manuelle Typisierung (`chunk as any`) durch explizite Type-Guards oder Zod-Schema-Validierung für die Chunks (`TOOL_CALL_START`, `STEP_FINISHED`, `REVIEW_READY`).

### [NEW] `apps/web/src/components/ai/hooks/useAiActionApply.ts`

- Extrahiert die POST-Logik an `/api/ai/reviews/:reviewId/apply`.
- Handhabt Ladezustände während der Ausführung und die darauffolgende Gedächtnis-Extraktion (`/api/ai/reviews/:reviewId/extract-memory`).

### [NEW] `apps/web/src/components/ai/ai-types.ts`

- Definition strikter TypeScript-Interfaces für den SSE-Stream:
  - `AiStreamChunk`, `AiToolCallChunk`, `AiReviewReadyChunk`, etc.
- Entfernt das unsaubere `as any` aus der EventListener-Logik.

### [MODIFY] `apps/web/src/components/ai/AiOverlayHost.tsx`

- **Hook Integration**: Die Komponente wird auf unter 200 Zeilen schrumpfen, indem sie einfach die drei neuen Hooks aufruft.
- **Eager Fetching entfernen**: Die synchronen Aufrufe `fetch("/api/data/address")` und `fetch("/api/data/document...")` werden gelöscht.
- **Action Dispatching**: Statt `window.dispatchEvent` nutzen wir sauberes Routing oder den UI Command-Registry (`@repo/ui/platform/command-registry`).

### [MODIFY] `apps/web/src/lib/ai/ai-capability-registry.tsx`

- Entfernung von `allAddresses` und `allDocuments` aus den Pflicht-Props der `renderReview` Methode, da die Host-Komponente diese nicht mehr bereitstellt.

### [MODIFY] `apps/web/src/components/ai/reviews/MailClassificationReview.tsx`

### [MODIFY] `apps/web/src/components/ai/reviews/MailOrderReview.tsx`

### [MODIFY] `apps/web/src/components/ai/reviews/MailToDocumentDraftReview.tsx`

- Umstellung auf **Lazy-Loading** bzw. **React Query** (`useQuery`).
- Die Komponenten holen sich die Liste der Adressen/Dokumente selbstständig (z.B. über eine Suchfunktion oder einen internen `useQuery` Hook), nur dann, wenn sie wirklich benötigt werden. Das beschleunigt die Öffnungszeit des Overlays drastisch.

## 3. Verification Plan

1. **Linter / Typecheck:** Sicherstellen, dass die neuen Typen korrekt verwendet werden und `pnpm lint` fehlerfrei durchläuft.
2. **Overlay Funktionstest:** Das AI-Overlay für eine E-Mail öffnen und prüfen, ob die Streams korrekt laufen, das Review-UI die Adressen bei Bedarf nachlädt und das Ausführen des Plans funktioniert.
3. **Performance Check:** In den Network-Tabs prüfen, ob das pauschale Herunterladen aller Adressen beim Öffnen des Overlays weggefallen ist.
