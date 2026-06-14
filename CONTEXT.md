# Context Glossary — AI Overlay & Capability Runtime

This file is a glossary of the domain language used in the AI overlay / capability
work. It is **not** a spec and contains **no** implementation detail. When a term
here conflicts with how the code or a conversation uses it, the conflict gets
resolved here first.

## Guiding goal (v1 of the AI overlay)

**Structure > lazy loading.** V1 prioritises a strictly structured, context-scoped
tool- and output-architecture. The overlay gives the user *and* the model a stable
mental map — context first, then tool group, then a small clearly-described toolset,
with typed (structured) outputs for everything the UI renders as a card/list/review.
Model-driven **Lazy Tool Discovery** stays an optional later growth path; it is not
the foundation of v1. (Today: 20 AI-exposed capabilities in 3 groups, so tool-count
overload is not yet a real problem.)

## Terms

- **Capability** — A registered, gated business operation in the Capability Registry
  (`packages/db/src/capabilities`). The single execution path for UI, API, and AI.
  Carries a zod `input`/`output`, a `kind` (read/write), and `exposure` metadata.
  Never receives `tenantId` from a caller — the tenant is resolved server-side from
  the ExecutionContext.

- **AI-exposed capability** — A capability that carries an `exposure.ai` projection.
  Only these become LLM tools. Selected via `buildCapabilityTools`.

- **Tool Group** — `exposure.ai.group`. The coarse semantic bucket a capability
  belongs to for the purpose of scoping a conversation (today: `sales-documents`,
  `mail`, `catalog`). The unit the **Context Picker** selects.

- **Context Picker** — The overlay control by which the *user* chooses the active
  scope (domain / tool group, optional record). Sets the `group`/`keys` passed to
  `buildCapabilityTools`. This is v1's "discovery": user-driven, not model-driven.

- **Invocation Context** — The explicit payload the overlay is opened with
  (`domain`/`entityName`/`recordId`/`groupHint`), passed by each call site (mail list,
  document TriView, address detail …), with the ambient `useFocus()` state as fallback.
  Seeds the focused group for **Reads global, writes scoped**. Replaces today's thin
  `AiOverlayOptions` (`taskScope` + `composeDraftContext`).

- **Confirm-gated capability** — A capability with `exposure.llm === "confirm"`: it
  changes data and must not run without explicit user confirmation. Drives the
  **Approval Flow**.

- **Approval Flow** — The interactive human-in-the-loop path that lets a confirm-gated
  capability run from chat. (The current `/api/ai/execute` route *excludes* confirm
  capabilities precisely because it has no such channel.)

- **Exploration / Proposal / Confirmation** — The three conversation states of the
  overlay. *Exploration*: the model reads more context, extracts hints, surfaces
  candidate matches. *Proposal*: the model emits a typed proposal card (e.g. likely
  customer, quote number, next action). *Confirmation*: only once the assignment and
  payload are good enough does it cross into a confirm-gated capability. Editing of a
  proposal happens on the typed card; the edited object becomes the input to the
  confirm-gated capability.

## Governing rules

- **Confirm-gates are an execution boundary, not a thinking boundary.** The model may
  freely read, combine multiple evidence sources, and re-draft. A gate exists only
  where data is written or a destructive/irreversible action happens — never to stop
  the model from *reasoning further*.

- **Maximum context evaluation before any hard stop.** No early abort on ambiguous
  cases while informative signals remain in the available material (e.g. the mail
  body). "Too uncertain" is a conclusion reached *after* context expansion and
  supported extraction, not a pre-wired route guard. This is a reasoning/context
  property, not a lazy-discovery one.

- **Capabilities are verbs, not scenarios.** A capability is named after its
  effect (`document.convert`, `emailOutbox.prepareSend`), never after a trigger or
  scenario (`confirmQuoteFromMail`). Scenarios are assembled *at runtime* by the
  agent-loop + structured outputs + user-confirmed write-boundaries. Transactional
  invariants live inside a single capability; orchestration across capabilities
  belongs to the model. Smell test: if you want to name a capability after a trigger,
  decompose it into verbs. See [ADR 0002](docs/adr/0002-capabilities-are-verbs-not-scenarios.md).

- **Reads global, writes scoped.** Read/lookup capabilities are exposed across all
  groups at all times (the Exploration backbone — no thinking boundary). Write/
  confirm capabilities are curated to the focused group seeded from the overlay's
  invocation context; switching focus widens the writable set. Curation is the only
  structure; the confirm-gate is the only hard line.

- **Confirm policy for capability chains.** Reads, draft creation, reference lookup
  and proposal-building run automatically. Every write/irreversible step is an
  approval. The whole chain is shown to the user as **one** structured, editable
  **Proposal Card**, but the user confirms each write-boundary individually (e.g.
  `convert` and `confirmSend` are distinct approvals with distinct risk).

## Terms (cont.)

- **Write-Boundary** — A point in a capability chain where a `confirm`-gated /
  irreversible capability runs. The unit of approval.

- **Decision Card** — A structured disambiguation surface (a Proposal-Card variant in
  "open decision" state): ranked candidate list with confidence, best suggestion first,
  quick-pick. Produced by a client-side tool `assistant.requestDecision` that **pauses**
  the agent loop (same pause/resume mechanic as Approval, but no write) and returns the
  user's choice as the tool result, so the loop resumes without context loss. It is the
  **last** resort, reached only *after* exhausted context evaluation — never a pre-wired
  gate. Free-text steering stays available as a secondary channel, not the primary form.
  Distinct from Approval: Approval guards a *write*; a Decision resolves an *ambiguity*.

- **Card rendering** — Capability results render **generically by default**, derived
  from the capability's zod `output` schema (reusing entity-mask / entity
  introspection), so a new capability module is renderable in the overlay with no
  overlay code. A thin client `capabilityCardRegistry` keyed by `capability.key`
  providing **bespoke overrides** only for high-value / editable cards (document-line
  editor, mail classification). The legacy `aiCapabilityRegistry` (taskScope →
  renderReview) is replaced, not extended.

- **Proposal Card** — A single typed, editable structured-output view of an intended
  action or chain (detected entities, open decisions, the writes about to happen,
  next actions). Edits on the card become the input to the next capability call.
  It is a forecast + approval manifest rendered in the UI — **not** an executable
  plan-DSL. Execution remains the normal agent tool-loop: the forecast is an
  unbinding preview, the progressive tool-loop is the truth, and the card is
  visibly *revised* when reality diverges (e.g. the quote was already converted)
  rather than a stale plan being executed.

- **Import-Profil (Import Profile)**:
  A reusable template specifying the target entity, qualifier rules, and execution settings for tenant imports.
  _Avoid_: Import-Template

- **Import-Feldmapping (Import Field Mapping)**:
  A relational record specifying how a source field (by fixed-width position/length or named column) maps to a target database column.
  _Avoid_: Import-Template-Field, JSONB-Mapping

- **External Sync Mapping**:
  A tenant-scoped mapping that associates an external key from a source system (e.g. Büroware `ART_1_25`) with a stable internal UUID.
  _Avoid_: Import-Entity-Mapping, Source-Key-Map

- **Pending References (Import-Status)**:
  Der Zustand einer Staging-Zeile (`import_row`), die auf die Existenz verknüpfter Fremdschlüssel (z. B. Warengruppen) im System wartet.
  _Avoid_: Unresolved-Reference, Null-FK

- **Reconcile-Job (Abgleich)**:
  Der asynchrone Hintergrundprozess, der Staging-Zeilen im Status `pending_references` erneut evaluiert und nach erfolgreicher Auflösung in die Zieltabellen verbucht.
  _Avoid_: Post-Resolve, Backfill-Job

- **Kompression bei Ingestion (Compressed Ingestion)**:
  Die optionale Möglichkeit, Dateien als `.zip` hochzuladen, die serverseitig als Stream entpackt wird, um Bandbreite bei großen Exporten zu sparen.
  _Avoid_: Manuelles Entpacken, In-Memory Unzip

- **Hybrid-Upsert (Posting-Muster)**:
  Das Verbuchungsmuster, bei dem native Felder in echte Spalten der Zieltabelle geschrieben werden, während als `tenant_fields` registrierte Zusatzfelder normalisiert in das `custom_attributes` JSONB-Feld einfließen.
  _Avoid_: JSON-Only-Store, Dynamische DDL-Spalten

- **Dry-Run (Import-Modus)**:
  Ein Importmodus, bei dem die Ingestion in das Staging erfolgt und Validierungen simuliert werden, ohne Zieldatensätze zu verändern.
  _Avoid_: Test-Import, Vorab-Validierung

- **Dry-Run-Freigabe (Import-Commit)**:
  Die Aktivierung eines validierten Dry-Runs, wodurch der Post-Worker die bereits vorhandenen Staging-Daten produktiv verbucht.
  _Avoid_: Re-Upload, Re-Parse-Commit
