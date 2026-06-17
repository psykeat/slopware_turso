# AI Overlay & Inline-AI

Slice doc for the AI assistant overlay, inline-edit features, and the text-editor AI integration.

---

## Architecture Overview

The AI system has three distinct interaction surfaces:

1. **AI Overlay** — a slide-in Sheet for multi-step AI workflows (mail analysis, document drafting)
2. **Inline Edit** — a BubbleMenu on text selection in any Tiptap editor (LangtextEditor, RichTextEditor)
3. **Compose Draft** — a lightweight panel inside the overlay for generating outgoing email bodies

All three share the same LLM backend (`resolveLlmRuntimeConfig` + `createConfiguredProvider` from `@repo/agent`).

---

## 1. AI Overlay (SSE Pipeline)

### Lifecycle

```
Alt+A / button click
  → AiOverlayProvider.openAiOverlay(options?)
  → AiOverlayHost renders as <Sheet>
  → POST /api/ai/context/resolve   (useAiContextResolution)
  → task-selection or auto-start
  → POST /api/ai/sessions          (create session)
  → GET  /api/ai/sessions/:id/sse  (useAiTaskStream, EventSource)
  → live transcript streaming
  → review payload arrives
  → renderReview() from aiCapabilityRegistry
  → user edits → POST /api/ai/reviews/:id/validate
  → "Aktionen buchen" → POST /api/ai/reviews/:id/apply
  → success + memory extraction
```

### State Machine (`AiAssistantState`)

| Status | Description |
|---|---|
| `idle` | Overlay closed or reset |
| `resolving-context` | Calling `/api/ai/context/resolve` |
| `task-selection` | Multiple tasks available, user picks one |
| `loading-task` | SSE stream active, live transcript rendering |
| `review` | Agent finished, review payload displayed for editing |
| `applying` | Transactional apply in progress |
| `success` | Apply succeeded, memory confirmation may follow |
| `error` | Classified error with retry option |

Error classes: `AI_UNAVAILABLE`, `TASK_NOT_SUPPORTED_IN_CONTEXT`, `CONTEXT_NOT_RESOLVABLE`, `MODEL_TIMEOUT`, `SCHEMA_VALIDATION_FAILED`, `APPLY_VALIDATION_FAILED`, `STALE_CONTEXT`, `UNAUTHORIZED`.

### Key Files

| File | Role |
|---|---|
| `packages/ui/platform/ai-overlay.tsx` | `AiOverlayProvider` + `useAiOverlay` context (open/close state, options) |
| `apps/web/src/components/ai/AiOverlayHost.tsx` | Main overlay component — renders Sheet, state machine UI, review footer |
| `apps/web/src/components/ai/ai-types.ts` | `AiAssistantState` union, `AiStreamChunk`, `AiStatusEventData`, `AiReviewEventData` |
| `apps/web/src/components/ai/hooks/useAiContextResolution.ts` | Calls `POST /api/ai/context/resolve`, decides auto-start vs. task-selection |
| `apps/web/src/components/ai/hooks/useAiTaskStream.ts` | Manages `EventSource` lifecycle, transcript upserts, stream → review transition |
| `apps/web/src/components/ai/hooks/useAiActionApply.ts` | Validate + apply handlers, memory extraction, `nextUiActions` dispatch |
| `apps/web/src/lib/ai/ai-capability-registry.tsx` | `ClientAiCapabilityRegistry` — maps `taskScope` → `{ label, icon, renderReview }` |
| `apps/web/src/routes/api/ai/$.ts` | Catch-all API route (1600+ lines) — sessions, SSE, context resolve, plan, interpret/resolve/build-review, validate, apply, inline-edit, compose-draft, memories |
| `packages/db/src/services/ai-orchestrator.ts` | Core backend (2000+ lines) — agent instantiation, tool execution, interpretation, review payload generation |

### Registered Task Scopes

| Scope | Label | Review Component | Pipeline |
|---|---|---|---|
| `mail-classification` | E-Mail klassifizieren & zuordnen | `MailClassificationReview` | SSE |
| `mail-to-document-draft` | Belegentwurf vorschlagen | `MailToDocumentDraftReview` | SSE |
| `mail-order-review` | Mail-Bestellung prüfen | `MailOrderReview` | SSE |
| `mail-compose-draft` | Mail verfassen | `MailComposeDraftPanel` (direct) | No SSE |

### Event System

| Event | Dispatched By | Handled In | Purpose |
|---|---|---|---|
| `slopware:open-ai` | Email composer AI button, hotkey | `email.tsx` → `openMailAiAssistant` | Opens the overlay with current focus context |
| `slopware:open-email-draft` | `MailComposeDraftPanel.apply()`, `useAiActionApply` (nextUiActions) | `email.tsx` → `openEmailDraftFromAi` | Injects generated body (or loads draft by ID) into composer |

---

## 2. Inline Edit (BubbleMenu)

Text-selection-based AI editing available in every Tiptap-powered editor.

### How It Works

1. User selects text in a Tiptap `<EditorContent>`
2. A `<BubbleMenu>` appears with action buttons
3. Action → `POST /api/ai/inline-edit` with `{ text, action }`
4. Response `{ result }` replaces the selected range via `editor.chain().focus().deleteRange().insertContentAt()`

### Available Actions

| Action | German Label | Prompt Behavior |
|---|---|---|
| `improve` | Verbessern | Rephrase for style and readability |
| `shorten` | Kürzen | Condense to essentials |
| `formal` | Formell | Professional, formal Sie-Form |
| `translate` | Übersetzen | DE↔EN toggle |

Additional backend-supported actions (not yet wired to BubbleMenu): `rephrase`, `lookup`, `explain`.

### Where Inline Edit Is Available

- **LangtextEditor** (`packages/ui/components/langtext-editor.tsx`) — uses Tiptap with BubbleMenu directly. Used in address, article, contact, and document-editor long-text fields.
- **RichTextEditor / Email Composer** (`packages/ui/components/rich-text-editor.tsx` → Novel/Tiptap) — the email editor; inline edit available through its own toolbar mechanisms.

### LangtextEditor Tiptap Migration (completed)

The LangtextEditor was migrated from `contentEditable` + `document.execCommand` (deprecated) to Tiptap v2. Same component API (`LangtextEditorProps`), same HTML in/out. Key changes:

- `applyFormat("bold")` → `editor.chain().focus().toggleBold().run()`
- `contentEditable` div → `<EditorContent>` with `useEditor`
- `FloatingToolbar` (DOM Range-based) → Tiptap `BubbleMenu` (ProseMirror-native)
- Extensions: `StarterKit` (subset), `Underline`, `TextStyle`, `Color`
- `FloatingToolbar` component reduced to a no-op stub (`packages/ui/components/floating-toolbar.tsx`)

---

## 3. AI Compose Draft

Generates outgoing email bodies without the full SSE pipeline.

### Flow

```
Composer open + AI button click
  → openAiOverlay({ composeDraftContext: { to, subject, context } })
  → AiOverlayHost detects composeDraftContext, renders MailComposeDraftPanel
  → user optionally adds instruction
  → "Entwurf generieren" → POST /api/ai/compose-draft
  → preview rendered
  → "Übernehmen" → dispatches slopware:open-email-draft { body }
  → email.tsx injects body into composer state
```

### API

**`POST /api/ai/compose-draft`**

Request: `{ to: string[], subject: string, context?: string, instruction?: string, language?: string }`

Response: `{ body: string }`

### Key Files

| File | Role |
|---|---|
| `apps/web/src/components/ai/MailComposeDraftPanel.tsx` | UI panel — instruction input, generate button, preview, apply |
| `apps/web/src/routes/api/ai/$.ts:1182` | Backend handler |
| `apps/web/src/routes/_auth/app/email.tsx:947` | `openMailAiAssistant` — detects composer-open state, passes `composeDraftContext` |
| `apps/web/src/routes/_auth/app/email.tsx:971` | `openEmailDraftFromAi` — handles body injection into composer state |

---

## 4. Email Composer Attachment Upload (completed)

`EmailComposeDialog` now supports client-side file attachment before send.

### Flow

1. User attaches files → stored in `pendingFiles` state
2. File preview strip rendered below composer
3. On send/save-draft/schedule → `buildAttachments()` uploads each file via `POST /api/email/attachments/upload` (multipart/form-data)
4. Uploaded attachments merged with existing server-side attachments
5. Combined array passed to `onSubmit`

### Key File

`apps/web/src/components/email/EmailComposeDialog.tsx`

---

## 5. Backend LLM Configuration

All AI endpoints resolve the LLM provider dynamically per-tenant:

```ts
const { resolveLlmRuntimeConfig } = await import("@repo/db/services/ai-orchestrator");
const llm = await resolveLlmRuntimeConfig(tenantId, userId);

const { createConfiguredProvider } = await import("@repo/agent");
const provider = createConfiguredProvider({
  provider: llm.providerName,
  model: llm.modelName,
  apiKey: llm.apiKey || undefined,
  endpointUrl: llm.gatewayUrl || undefined,
  vertexCredentials: llm.vertexCredentials || undefined,
  vertexProject: llm.vertexProject || undefined,
  vertexLocation: llm.vertexLocation || undefined,
});
```

Config is managed via `GET/PUT /api/ai/llm-config` (global + per-tenant) with encrypted API key storage.

---

## 6. API Endpoint Inventory

All routes live in `apps/web/src/routes/api/ai/$.ts`:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/ai/llm-config` | Read LLM config (masked) |
| PUT | `/api/ai/llm-config` | Update LLM config |
| POST | `/api/ai/llm-config/test` | Test LLM connectivity |
| GET | `/api/ai/catalog/entities` | Semantic entity catalog |
| GET | `/api/ai/catalog/entities/:name` | Entity field catalog |
| GET | `/api/ai/catalog/commands` | Command catalog |
| GET | `/api/ai/context/mail-thread/:id` | Mail thread context |
| GET | `/api/ai/memories` | List AI memories |
| GET | `/api/ai/sessions/:id/sse` | SSE stream |
| POST | `/api/ai/sessions` | Create session |
| POST | `/api/ai/context/resolve` | Resolve focus context → supported tasks |
| POST | `/api/ai/catalog/context` | Semantic context |
| POST | `/api/ai/plan` | Create AI plan |
| POST | `/api/ai/tasks/mail/interpret-thread` | Phase A: interpret |
| POST | `/api/ai/tasks/mail/resolve-thread` | Phase B: resolve |
| POST | `/api/ai/tasks/mail/build-review` | Phase C: build review |
| POST | `/api/ai/reviews/:id/validate` | Phase D: validate |
| POST | `/api/ai/reviews/:id/apply` | Phase E: apply |
| POST | `/api/ai/inline-edit` | Inline text editing |
| POST | `/api/ai/compose-draft` | Email draft generation |
| POST | `/api/ai/variant-template-suggest` | Article variant AI suggestion |
| POST | `/api/ai/memories/:id/confirm` | Confirm memory |
| POST | `/api/ai/memories/:id/reject` | Reject memory |

---

## 7. Known Gaps & Dormant Code

| Area | Status |
|---|---|
| `ai_tool_review` table | Schema defined, no code references it |
| `ai_plan` / `ai_evidence` tables | Legacy, replaced by review/bundle model |
| `AIPlanningService.createPlan()` | Exists, no route entry point |
| Document-level AI workflows | `buildDocumentProjection()` exists, never called |
| Memory confirmation UI | API endpoints exist, UI in success state of overlay |
| Prompt versioning UI | Schema + seeding exist, no admin UI |
| Cost tracking per tenant | Not implemented |
| BubbleMenu actions `lookup` / `explain` | Backend supports them, not wired to any BubbleMenu button |
