# Implementierungsplan: Refactoring zur einheitlichen Capability-Runtime & Server Functions

Dieses Dokument beschreibt das technische Soll-Bild und die Migrationsstrategie, um UI-Aufrufe, externe API-Endpunkte, das LLM-Tooling und die Smoke-Tests auf eine gemeinsame Basis – die **Capability Registry** – zu vereinheitlichen.

---

## Management-Zusammenfassung

Durch die Konsolidierung aller Anwendungszugriffe auf die **Capability Registry** wird eine redundanzfreie, auditierbare und AI-sichere Anwendungsarchitektur geschaffen:

1. **Frontend (UI)**: UI-Komponenten nutzen künftig **TanStack Start Server Functions** (`createServerFn`), welche die Berechtigungs- und Ausführungskontexte serverseitig auflösen und die entsprechende Capability ausführen. Ad-hoc REST-Endpunkte in `/api/data` entfallen für schreibende Operationen.
2. **AI-Layer**: LLM-Tools werden künftig **dynamisch aus der Capability Registry generiert** (`createCapabilityTools(ctx)`). Dies eliminiert die bisherige Redundanz in `packages/agent` und verhindert, dass das LLM durch die Übergabe von `tenantId`-Parameterschemata die Mandantentrennung umgehen kann.
3. **API-Schicht**: Externe Systeme kommunizieren über standardisierte API-Routen, die intern als dünne Transport-Adapter direkt auf `executeCapability` verweisen.
4. **Smoke-Tests & Qualität**: Testfälle prüfen primär die Capability-Ausführung sowie die dünne HTTP-Ausführungsschicht.
5. **Datenbank**: Alle Mutationen erfolgen ausschließlich transaktionsgesichert über Domain-Services innerhalb der Capabilities. Direkter Datenbankzugriff aus API-Routen, Server-Funktionen oder AI-Tools wird verboten.

---

## User Review Required

> [!IMPORTANT]
> **Dynamic Tool Selection**: Da die Anzahl der Capabilities in einem ERP-System sehr groß ist, darf das LLM nicht mit allen Tools gleichzeitig überladen werden (Gefahr des Detailverlusts und Halluzinierens). Wir implementieren ein dynamisches Tool-Retrieval bzw. ein rollen- und taskbezogenes Toolset.
>
> **TanStack Start Migration**: Die Umstellung auf `createServerFn` erfordert eine schrittweise Anpassung der bisherigen Fetch-Aufrufe in den TriView-Layouts (z. B. `_auth/app/addresses.tsx`, `_auth/app/documents.tsx`).

---

## Open Questions

> [!NOTE]
>
> 1. **Batching / Streaming**: Sollen die Server Functions und LLM-Tools Unterstützung für partielle Antworten oder Event-Streaming erhalten, oder reicht eine standardmäßige Request-Response-Atomizität für die erste Migrationsphase?
> 2. **Rollenprüfung**: Genügen die Rollen `tenant_user` und `tenant_admin` oder müssen weitere feingranulare Rechte in die Capabilities integriert werden?

---

## Proposed Changes

### 1. Capability & Domain Services Layer (Backend)

Wir erweitern die Capabilities in `packages/db/src/capabilities/modules/` um fehlende Business-Operationen (z. B. für E-Mail-Klassifizierung und Belegwandlung), sodass keine SQL- oder Service-Logik mehr in den API-Routen verbleibt.

#### [MODIFY] [registry.ts](file:///home/ubuntu/slopware/packages/db/src/capabilities/core/registry.ts)

- Unterstützung für erweitertes Metadaten-Retrieval der Capabilities zur AI-Entscheidungshilfe.

#### [NEW] [mail-capabilities.ts](file:///home/ubuntu/slopware/packages/db/src/capabilities/modules/communication.mail.ts)

- `communication.emailThread.classify`: Registriert die Capability für `apply-ai-mail-classification`.
- `communication.emailThread.archive`: Registriert die Capability für `archiveMailThread`.
- `communication.emailThread.link`: Registriert die Capability für `linkMailThreadToEntity`.

---

### 2. AI Layer

Wir refaktorieren das LLM-Tooling so, dass es direkt auf der Capability Registry basiert.

#### [MODIFY] [tools.ts](file:///home/ubuntu/slopware/packages/agent/src/tools.ts)

#### [MODIFY] [mutations.ts](file:///home/ubuntu/slopware/packages/agent/src/mutations.ts)

- Ersetzen aller handgeschriebenen Tools durch einen dynamischen Tool-Generator:

```ts
export function createCapabilityTools(ctx: ExecutionContext) {
  const capabilities = listCapabilities({ llm: ["safe", "confirm"] });
  const tools: Record<string, any> = {};

  for (const capability of capabilities) {
    const toolName = capability.key.replace(/\./g, "_");
    tools[toolName] = toolDefinition({
      name: toolName,
      description:
        `${capability.summary.de} / ${capability.description?.de || ""}. \n` +
        `Wann benutzen: ${capability.exposure.llm === "confirm" ? "Erfordert Bestätigung. " : ""}`,
      inputSchema: capability.input,
    }).server(async (input) => {
      const result = await executeCapability(capability.key, ctx, input);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    });
  }
  return tools;
}
```

#### [NEW] [execute.ts](file:///home/ubuntu/slopware/apps/web/src/routes/api/ai/execute.ts)

- Zentraler AI-Orchestrator-Endpunkt `POST /api/ai/execute`.
- Löst die Session und den Tenant auf, lädt die dynamischen Tools mittels `createCapabilityTools(ctx)` und führt den LLM-Tool-Calling-Loop serverseitig aus.

#### [MODIFY] [$.ts](file:///home/ubuntu/slopware/apps/web/src/routes/api/ai/$.ts)

- Entfernen der obsoleten/redundanten Routen (z. B. `apply`, `validate` für Reviews, die direkt über Capabilities abgewickelt werden).
- Beibehalten von Hilfsendpunkten für UI-Konfigurationen und Prompt-Settings.

---

### 3. Frontend & Server Functions Layer

Wir führen die typisierten Server-Funktionen ein und binden sie in die Route-Queries der UI ein.

#### [NEW] [server-fns.ts](file:///home/ubuntu/slopware/apps/web/src/server-fns/capabilities.ts)

- Exponiert schreibende Server-Funktionen, die die Capability Registry aufrufen:

```ts
import { createServerFn } from "@tanstack/react-start";
import { executeCapability } from "@repo/db/capabilities";
import { resolveExecutionContext } from "../lib/capability-auth";

export const executeServerCapability = createServerFn({ method: "POST" })
  .input(
    z.object({
      key: z.string(),
      input: z.unknown(),
    }),
  )
  .handler(async ({ data, request }) => {
    const ctx = await resolveExecutionContext(request);
    if (ctx instanceof Response) throw ctx;
    return executeCapability(data.key, ctx, data.input);
  });
```

---

### 4. Test Layer

#### [MODIFY] [capabilities.smoke.test.ts](file:///home/ubuntu/slopware/packages/db/src/capabilities/capabilities.smoke.test.ts)

- Erweiterung der Smoke-Tests, um die neudefinierten Capabilities und die AI-Tool-Zuweisung abzudecken.

---

## Verification Plan

### Automated Tests

- Führe alle DB- und Capability-Tests in-process aus:
  ```bash
  pnpm exec tsx --test packages/db/src/capabilities/*.test.ts
  ```
- Führe die HTTP-Smoke-Tests aus:
  ```bash
  pnpm exec tsx --test packages/db/src/capabilities/http/*.test.ts
  ```

### AI-Agent Test- & Integrations-Schnittstelle

Für zukünftige AI-Agents, die Features testen oder das System verifizieren müssen, stehen folgende standardisierte Routen und APIs zur Verfügung. **Diese stellen die primäre Testoberfläche dar und dürfen nicht durch eigene DB-/Mock-Umgehungen ersetzt werden.**

#### 1. HTTP Capability Execution (`POST /api/capabilities/{key}/execute`)

Erlaubt die direkte Ausführung einer Capability über HTTP.

- **URL**: `POST /api/capabilities/{key}/execute`
- **Headers**:
  - `Content-Type: application/json`
  - `Idempotency-Key: <unique-uuid-or-string>` (Optional, erzwingt Idempotenz für schreibende Operationen)
- **Body**:
  ```json
  {
    "input": {
      "param1": "value1"
    },
    "dryRun": false
  }
  ```
- **Response**: `{ ok: true, data: ... }` oder `{ ok: false, error: { code, message } }`

#### 2. HTTP AI Orchestrator Execution (`POST /api/ai/execute`)

Führt die serverseitige Agent-Schleife über den Capability-Tools aus. Perfekt, um Tool-Calling-Szenarien und Multi-Step-Logiken end-to-end zu testen.

- **URL**: `POST /api/ai/execute`
- **Body**:
  ```json
  {
    "prompt": "Finde das Angebot Q-2026-001, wandle es in einen Auftrag um und generiere das PDF.",
    "group": "sales-documents",
    "confirmMode": "exclude"
  }
  ```
  _(Hinweis: `confirmMode: "exclude"` ist Standard, da hier kein interaktiver Handshake stattfindet. Nutze `"allow"`, wenn du die Ausführung schreibender Confirm-Capabilities explizit erlauben möchtest.)_
- **Response**:
  ```json
  {
    "text": "Ich habe das Angebot Q-2026-001 gefunden, es in den Auftrag O-2026-002 gewandelt und das PDF generiert.",
    "toolCalls": [
      { "name": "sales_document_get", "input": { "documentNo": "Q-2026-001" }, "output": { "documentId": "..." } },
      ...
    ]
  }
  ```

#### 3. Verwendung im Test-Code (In-Process & HTTP Client)

- **HTTP Smoke Tests**: Nutze den `CapabilityClient` in `packages/db/src/capabilities/http/capability-client.ts`. Er übernimmt Login und Tenant-Scope:
  ```ts
  const client = await CapabilityClient.login();
  const res = await client.executeCapability("sales.document.convert", { documentId });
  ```
- **In-Process Integration Tests**: Nutze `executeCapability` direkt im Test mit einem gemockten System-ExecutionContext:
  ```ts
  const ctx = createTestExecutionContext({ role: "system" });
  const res = await executeCapability("sales.document.convert", ctx, { documentId });
  ```

### Manual Verification

- Testen des neuen AI-Overlays und Verifizierung, dass der Tool-Calling-Loop im Backend sauber durchläuft, ohne dass `tenantId` an das LLM gesendet wird.

---

# AI-Overlay-Architektur (v1)

> Ergebnis der Grilling-Session. Glossar und Governing Rules in [`CONTEXT.md`](../CONTEXT.md),
> Granularitätsregel in [ADR 0002](adr/0002-capabilities-are-verbs-not-scenarios.md).

## Leitsatz

**Struktur > Lazy Loading.** Confirm-Gates sind eine **Ausführungsgrenze, keine
Denkgrenze**. Das Overlay ist ein _iteratives Klärungswerkzeug_: lesen → bei
Unsicherheit Kontext erweitern → bei Restunsicherheit gezielt **eine** strukturierte
Frage → Vorschlag → user-bestätigte Writes. Kein starres Routing; Szenarien entstehen
zur Laufzeit aus atomaren Verb-Capabilities, die der Agent-Loop kombiniert.

## Entscheidungsmatrix

| #   | Thema              | Entscheidung                                                                                                        |
| --- | ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| 1   | Ziel v1            | User-steuerbarer, kontext-scoped Chat + Structured Outputs + Approval. Model-driven Lazy Discovery vertagt.         |
| 2   | Structured Outputs | Plan/Steps-Modell + `aiCapabilityRegistry` retiren. Editierbare typed Tool-Result-Karten.                           |
| 3   | Transport/State    | Neuer `/api/ai/chat`; `execute.ts` bleibt headless. Client-owned Transcript, Server stateless, keine Persistenz v1. |
| 4   | Context Picker     | Weicher Scope, kein Gate.                                                                                           |
| 5   | Kuratierung        | Reads global, Writes scoped — geseedet aus Invocation Context.                                                      |
| 6   | Granularität       | Capabilities sind Verben, keine Szenarien (ADR 0002).                                                               |
| 7   | Confirm-Policy     | Pro Write-Boundary einzeln, eine editierbare Proposal-Card.                                                         |
| 8   | Proposal-Card      | Hybrid: Forecast als Vorschau, progressive Tool-Loop als Wahrheit, sichtbare Revision.                              |
| 9   | Rendering          | Generisch (zod-`output`) als Default, bespoke Override-Registry.                                                    |
| 10  | Disambiguierung    | `assistant.requestDecision` Client-Tool (Pause/Resume).                                                             |
| 11  | v1-Leuchtturm      | Quote-Confirmation, Gruppen `mail` + `sales-documents`.                                                             |

## Blockierende Vorarbeit

- **`@tanstack/ai`-Catalog auf 0.22.x angleichen** (`pnpm-workspace.yaml`). Heute löst
  `@repo/agent` `^0.20.1` auf, `@tanstack/ai-client@0.13.0` braucht aber `0.22.1`. Das
  `approval-requested`/`respondToApproval`-Protokoll passt nur bei gleicher Version
  zwischen Server-Loop und `ChatClient`. **Zuerst verifizieren**, dann alles andere.

## Backend

### `/api/ai/chat` (NEU) — interaktiver Endpoint

- Eigene Route neben `routes/api/ai/execute.ts` (das bleibt headless/Single-Shot für
  externe Aufrufer und Tests, weiter mit `confirmMode: "exclude"`).
- Fährt die Agent-Loop mit `buildCapabilityTools(ctx, { confirmMode: "approval" })`, damit
  Confirm-Capabilities über den Pause/Resume-Handshake laufen.
- Spricht das `@tanstack/ai-client`-Streaming-/Approval-Protokoll. **Stateless**: der
  Client (`ChatClient`) hält die `UIMessage[]` und spielt sie pro Turn (inkl. Resume)
  erneut ein. Keine `ai_thread`-Tabelle in v1. Audit-Trail bleibt vollständig über
  `capability_execution_log`; Replay ist sicher dank `capabilities.idempotency.test.ts`.

### Tool-Selektion — „Reads global, Writes scoped“

- **Backbone (immer, alle Gruppen, nur `kind: read`):** Such-/Lese-Capabilities aus jeder
  Domäne (`masterdata.search.*`, `*.get`, `*.list`, `convertCandidates`). Das ist das
  Exploration-Rückgrat — keine Denkgrenze.
- **Fokus-Gruppe (geseedet aus Invocation Context, read+write):**
  `buildCapabilityTools(ctx, { group: seededGroup, confirmMode: "approval" })`.
- `exposure.ai.activeByDefault` wird zu „gehört ins Backbone“ umgedeutet bzw. um ein
  `kind`-Kriterium ergänzt (heute mischt es Reads und Writes).

### Neue Capability

- `sales.document.materializePdf({ documentId }) → { fileId }` — hebt
  `ensureDocumentPdfAttachment` aus `apps/web/src/routes/api/email/$.ts` in einen
  Domain-Service + Verb (Server-Render existiert in `routes/api/documents/$documentId/print.tsx`).
  Eigenes Verb, **kein** impliziter Seiteneffekt in `prepareSend` (ADR 0002).

## Frontend

### Invocation Context

- `AiOverlayOptions` (`packages/ui/platform/ai-overlay.tsx`) von `taskScope` +
  `composeDraftContext` zu einem expliziten `InvocationContext`
  (`domain`/`entityName`/`recordId`/`groupHint`) erweitern. Jede Aufrufstelle gibt ihn
  mit (Mail-Liste, Beleg-TriView, Adress-Detail); `useFocus()` als Fallback.

### Overlay-Shell

- `AiOverlayHost.tsx` neu aufbauen: Conversation-Layer (Chat via `ChatClient`/`useChat`),
  Context-Picker (fokussiert die Gruppe, sperrt nicht), Result-Panel (Karten).
- **Rendering:** generischer Renderer aus der zod-`output`-Capability (reuse
  `entity-mask.tsx` / Entity-Introspection) als Default. Dünnes
  `capabilityCardRegistry` (Key: `capability.key`) nur für bespoke/editierbare Karten
  (Beleg-Zeilen-Editor, Mail-Klassifikation). `aiCapabilityRegistry` wird **ersetzt**.

### Proposal-Card (Hybrid)

- Strukturierte „Absichtserklärung“ des Modells als unverbindliche Vorschau (symbolische
  Referenzen wie „der resultierende Auftrag“ erlaubt).
- Ausgeführt wird progressiv über die Tool-Loop; jeder Write ist ein echtes Approval an
  seiner Boundary; die Karte zieht echte IDs/Resultate nach.
- Weicht die Realität ab (Angebot schon gewandelt, Referenz nicht auflösbar), wird die
  Karte sichtbar **revidiert** statt stur abgearbeitet.
- Editierungen auf der Karte werden zum Input der nächsten Capability.

### Disambiguierung — `assistant.requestDecision` (Client-Tool)

- **Zweck:** Restunsicherheit nach erschöpfter Kontextauswertung auflösen — der **letzte**
  Ausweg, kein vorgezogenes Gate.
- **Tool-Definition (clientseitig):**
  `assistant.requestDecision({ question, candidates: { id, label, confidence, hint? }[], allowFreeText? })`.
  Als Client-Tool registriert → die Agent-Loop **pausiert** (`tool-input-available`),
  führt nichts serverseitig aus.
- **Decision-State:** Overlay-State `decision: { question, candidates, pending: true }`.
  Solange `pending`, rendert das Result-Panel die **Decision-Card** (gerankte Kandidaten,
  bester Vorschlag zuerst, Confidence sichtbar, Quick-Pick + optionales Free-Text-Feld).
- **Resume-Flow:** Nutzer-Auswahl → die gewählte `candidate.id` (oder Free-Text) wird als
  **Tool-Result** zurückgegeben → die Loop läuft nahtlos weiter, ohne Kontextverlust.
- **Abgrenzung zu Approval:** _Approval_ (`needsApproval`, server-seitiges Tool) bewacht
  einen **Write** — Ja/Nein vor Ausführung. _Decision_ (Client-Tool, kein Write) löst eine
  **Ambiguität** — Auswahl aus Kandidaten. Beide nutzen denselben Pause/Resume-Mechanismus,
  haben aber unterschiedliche Semantik und unterschiedliche Cards.
- Free-Text-Steuerung bleibt **immer** zusätzlich möglich („nimm die mit der USt-ID
  DE123“) — die Decision-Card ist ein Angebot, keine Sperre.

## Leuchtturm-Flow v1 (Quote-Confirmation)

1. Overlay auf E-Mail-Thread geöffnet → Invocation Context seedet Gruppe `mail`.
2. **Exploration:** Modell liest Thread, wertet Body/Attachments aus, sucht via Backbone
   das referenzierte Angebot (`sales-documents`-Reads, obwohl Mail-Fokus).
3. **Decision** (falls nötig): mehrere Kandidaten → `requestDecision` → Nutzer wählt.
4. **Proposal-Card:** „Angebot Q123 → Auftrag wandeln, PDF erzeugen, Antwort-Draft anhängen“.
5. **Write-Boundary 1 — Approval:** `sales.document.convert` → `newDocumentId`.
6. `sales.document.materializePdf(newDocumentId)` → `fileId`.
7. `communication.emailOutbox.prepareSend(threadId, attach: fileId)` → Draft-Karte (editierbar).
8. **Write-Boundary 2 — Approval:** `communication.emailOutbox.confirmSend(outboxId)` (irreversibel).

## Vertagt (spätere Capability-Module, kein Overlay-Code)

EDI-/Attachment-Import · Bestellstatus → Lieferdatum · Lieferanten-AB → WE-Bestellung ·
Reporting · Admin. Jeweils neue atomare Verben mit `exposure.ai` — tauchen automatisch
im Overlay auf.

## Verifikation (Overlay)

- Leuchtturm-Flow manuell: Exploration findet das Angebot, Decision-Card bei Mehrdeutigkeit,
  zwei Approvals greifen, Draft trägt das PDF, `tenantId` nie im LLM-Payload.
- Smoke-Test: `requestDecision`-Pause/Resume und `convert → materializePdf → prepareSend →
confirmSend` als Capability-Kette in-process.
