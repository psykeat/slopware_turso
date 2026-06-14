# 08 Refactor Capability Runtime — Umsetzungsbericht

> Dieses Dokument hielt vorher die Soll-Architektur fest. Es ist jetzt der
> **Ist-/Umsetzungsbericht**: was im Refactor-Run (Commits `3b93ce73..HEAD`,
> Phasen 5–9) tatsächlich implementiert wurde, gemappt auf
> `docs/refactor-capability-runtime-plan.md`. Soll-Architektur und Begründungen
> stehen im Plan; hier steht der reale Code mit Dateipfaden und Abweichungen.

## Gesamtstatus

Alle Plan-Schichten sind realisiert. Schreibende und lesende Zugriffe von UI, AI
und Tests laufen über die Capability-Runtime; der introspektive `/api/data`-
CRUD-Endpunkt ist gelöscht.

| Plan-Bereich | Status | Kernartefakte |
|---|---|---|
| Capability/Domain (Reads + Writes vollständig) | ✅ | `packages/db/src/capabilities/modules/*`, `core/execute.ts` |
| AI Layer (Tool-Generator + `/api/ai/execute`) | ✅ | `packages/agent/src/capability-tools.ts`, `apps/web/src/routes/api/ai/execute.ts` |
| Server Functions (intern UI) | ✅ | `apps/web/src/server-fns/capabilities.ts` |
| Read Layer + TanStack-Query-Integration | ✅ | `@repo/db/capabilities/{manifest,entity-ops}`, `*/lib/entity-capabilities.ts` |
| API Routes / `/api/data`-Abbau | ✅ | `/api/data/$.ts` gelöscht; `/api/admin/data/$.ts` bleibt |
| Idempotenz | ✅ | `capabilityExecutionLog`, `ctx.idempotencyKey` Replay |
| Multi-Tenant / RLS (Pilot, dormant) | ✅ (Pilot) | `app_runtime` Rolle + Policies auf 5 Tabellen, tx-lokaler Scope |
| Tests + Guardrails | ✅ | contract/scenario/idempotency/rls Tests, `/api/data`-Fetch-Guardrail |

Verifikation am Ende: `pnpm run build:web` grün, `pnpm exec tsx --test
src/capabilities/*.test.ts` grün, `vp lint` 0 Errors (7 bestehende Warnungen).

---

## Umsetzung pro Plan-Abschnitt (Plan → Realität)

### 1. Capability & Domain Services Layer

- Schreibende Business-Operationen laufen ausschließlich über Capabilities, die
  an bestehende Domain-Services delegieren (keine Businesslogik in Routen/UI).
- **Read-Layer** (Plan-Präzisierung „Reads nicht erzwingen, aber tenant-sicher"):
  als `kind: "read"`-Capabilities mit identischem Tenant-/Auth-/Zod-Kontrakt
  umgesetzt, plus ein gemeinsamer Listen-Kontrakt `core/list.ts`
  (`orderBy`, `filterRules`, Offset-Pagination, `withTotal → { items, total }`),
  der an `DataService.list` delegiert.
- Neu hinzugefügte Read-Caps zum vollständigen Abdecken der UI:
  `masterdata.addressContact.search` (`masterdata.search.ts`),
  `sales.documentType/documentGroup` (`sales.reference.ts`),
  `communication.emailTemplate/Binding/RenderLog` (`communication.email-template.ts`).
- **By-id Write-Caps** für Natural-Key-Entitäten (article/address/currency/
  articleGroup/country/unit/priceList): `create`+`update` in
  `masterdata.editable.ts`, `exposure.llm: "hidden"` (AI-Schreibpfad bleibt
  `upsert`). Begründung: der generische Mask/Langtext/Grid editiert diese per id.
- `sales.documentLine.create` delegiert an `DocumentService.createDocumentLine`
  (transaktional, validiert Beleg, BOM-Explosion) und liefert `{ lines: [...] }`.

### 2. AI Layer

- **[ABWEICHUNG vom Plan-Dateinamen, gleiche Idee]** Tool-Generator liegt in
  `packages/agent/src/capability-tools.ts` (Plan nannte `tools.ts`/`mutations.ts`).
  Generiert Tools aus der **AI-Projektion** (`exposure.ai`) statt aus allen Caps,
  damit das aktive Toolset klein/trennscharf bleibt (Plan-Präzisierung „kein
  generisches Universaltool"). Handgeschriebene CRUD/Mutation-Tools gelöscht.
- AI-Projektion ist auf kuratierten Caps annotiert (`exposure.ai` in
  `masterdata.article/address/search`, `sales.document`, `communication.email`, …),
  Confirmation wird aus `exposure.llm === "confirm"` abgeleitet (kein Zweitflag).
- Orchestrator-Route `apps/web/src/routes/api/ai/execute.ts` (`POST /api/ai/execute`):
  löst Session/Tenant auf, lädt die Tools, fährt den Tool-Loop serverseitig; kein
  `tenantId` im Toolschema.

### 3. Frontend & Server Functions Layer

- **[ABWEICHUNG vom Plan-Namen]** statt `executeServerCapability` gibt es in
  `apps/web/src/server-fns/capabilities.ts`:
  - `$executeCapability` (eine generische `createServerFn`),
  - `capability(key)` (typisierte Convenience: `await capability("…")(input)`),
  - `callCapability(key, input)` (volles Envelope inkl. Meta für Invalidierung).
  Context-Auflösung via Middleware `server-fns/context.ts` + `lib/capability-auth.ts`
  (Plan nannte `resolveExecutionContext`).
- Generischer Entity-Read/Write-Helfer (Plan-Präzisierung „Read-Layer im
  Frontend, dynamische Entitäten"):
  - `@repo/db/capabilities/manifest.generated.ts` — reiner String-Manifest
    `entity → { module, ops: { key, idParam?, filtersWrapped? } }`, generiert via
    `pnpm run generate:manifest`, durch Contract-Test gegen Drift gesichert.
  - `@repo/db/capabilities/entity-ops.ts` — transportneutraler Resolver
    (`resolveEntityList/Get/Save/Delete`), kennt heterogene Input-Shapes.
  - `packages/ui/lib/entity-capabilities.ts` (HTTP-Transport, `executeCapability`)
    und `apps/web/src/lib/entity-capabilities.ts` (Server-Fn-Transport,
    `$executeCapability`) als dünne Helfer + `entityListPage` für `{ items, total }`.
- TanStack-Query bleibt Read-Layer: Query-Keys-Wurzel `["data", entityName, …]`,
  `invalidateAfterCapability` nutzt Cap-Meta (`entityName`/`writesTables`).

### 4. API Routes / `/api/data`-Abbau

- **Alle** `/api/data`-Konsumenten migriert (Pages + Shared-UI): inline-edit-grid,
  langtext-record-panel, data-grid (CSV-Export paginiert), lookup-field,
  entity-mask, document-editor, `articles/addresses/documents` TriView-Pages,
  `settings/index`, email-Template-Reads, sowie diverse Standalone-Komponenten.
- `apps/web/src/routes/api/data/$.ts` **gelöscht** (Commit `f9abe012`).
- **Bewusst behalten:** `/api/admin/data/$.ts` (System-Admin-Introspektion;
  `entity-mask` schaltet bei `apiBase === "/api/admin/data"` auf rohes fetch),
  `/api/articles/*` (Bilder/BOM/Pricing, binär), `/api/me`, `/api/stats/*`,
  `/api/setup/initialize`, `/api/metadata/*`, OAuth/Webhook-/PDF-Pfade.

### 5. Idempotenz (Plan-Härtung)

- Tabelle `capabilityExecutionLog` + `ctx.idempotencyKey`-Replay
  (`core/types.ts`, `schema/app.schema.ts`, Test `capabilities.idempotency.test.ts`).

### 6. Multi-Tenant / RLS

- RLS-**Pilot** (dormant bis Cutover): Rolle `app_runtime` + Tenant-Policies auf 5
  Tabellen, transaktionslokaler Tenant-Scope in der Execute-Plumbing
  (`packages/db/src/index.ts`, Test `capabilities.rls.test.ts`). `SET LOCAL`/
  tx-lokal, pooling-sicher wie im Plan gefordert.

### 7. Test- & Guardrail-Schicht

- Contract-/Scenario-/Idempotency-/RLS-Tests unter
  `packages/db/src/capabilities/*.test.ts`; AI-Tool-Contract-Test
  `packages/agent/src/capability-tools.test.ts`.
- Guardrail-Test gegen Regressions-Fetches auf `/api/data`.
- `AI_TESTING.md` (Quickstart Capability-/AI-Testing).

---

## Abweichungen vom ursprünglichen Plan

| Plan | Tatsächlich | Grund |
|---|---|---|
| `executeServerCapability` | `$executeCapability` + `capability(key)` + `callCapability` | typisierte Inferenz über `CapabilityIndex`; eine generische Server-Fn statt RPC pro Key |
| `communication.mail.ts` mit `emailThread.classify` | kein `classify`; vorhanden: `emailThread.archive/link/markRead/list/get` in `communication.email.ts` | Klassifizierung nicht über separate Write-Cap modelliert |
| Tools aus `tools.ts`/`mutations.ts` | `packages/agent/src/capability-tools.ts` aus `exposure.ai`-Projektion | kuratiertes, kleines Toolset statt „alle Caps" |
| Reads pauschal in Registry | expliziter Read-Layer **plus** generischer manifest-gestützter Entity-Helfer | nötig, weil das generische Grid dynamische `entityName` über heterogene Input-Shapes treibt |
| (nicht im Plan) | Entity-Manifest + Resolver, geteilter Listen-Kontrakt, by-id-Editable-Caps, `documentLine.create` als Array-Cap | reale Heterogenität der Hand-Caps + Natural-Key-Entitäten |

## Nicht in Scope / offen

- **Deferred E-Mail-Migration**: der Send/Compose-Flow von `email.tsx`
  (`/api/email/$`, OAuth/Webhooks/PDF/Job-Queue) bleibt eigener Block; nur die
  Template-/RenderLog-Reads wurden migriert.
- **RLS** ist Pilot/dormant — Aktivierung/Cutover über alle Tabellen ist Follow-up.
- **TanStack Workflow** (durable Orchestrierung) wurde wie im Plan als optional
  bewertet und nicht eingeführt.
- Bekannte, unkritische Lint-Warnung: `CapabilityKey`
  (`no-redundant-type-constituents`) durch Factory-Pattern mit `string`-
  `entityName` (Keys weiten zu `module.${string}.op`). Funktional irrelevant.
