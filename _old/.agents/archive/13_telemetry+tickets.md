# 13 — Runtime Telemetry, AI Ticket Service & Dev-Cycle-Metrics

## Goal

Three interlocking systems:

1. **Ticket Service** — an always-accessible in-app feedback modal (`Shift+F1` / `?` button) that captures workspace context, posts to a LiteLLM microservice, and creates a structured GitHub issue with the result.
2. **Runtime Telemetry** — four in-memory ring buffers (JS errors, API calls, navigation, commands) that enrich the feedback snapshot automatically so every ticket contains enough context to reproduce the bug.
3. **Dev-Cycle-Metrics** — a `dev_cycles` DB table fed by `POST /api/admin/cycles` (Bearer-token, for the AI worker) with an admin-only dashboard at `/app/settings/cycles`.

## Source of Truth

- **PRD**: `.gemini/_toimplement/ticket_service.md`
- **Architecture**: `.gemini/00_core_architecture.md`
- **DB schema**: `.gemini/schema.md`

## Architecture Decisions

| Decision                | Choice                                                                         | Rationale                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| LLM proxy               | FastAPI + `litellm` (`services/llm/main.py`, port 11435)                       | Provider-agnostic; model/endpoint forwarded per-request so runtime reconfiguration needs no restart          |
| LLM config storage      | `system_settings` table (scope=`global`, key=`llm_config`)                     | Reuses existing infra; no new table; secrets AES-256-GCM encrypted with `ENCRYPTION_SECRET` env var          |
| Snapshot capture timing | At modal-open transition (not on workspace mount)                              | Maximally fresh state — captures the error that just happened                                                |
| Telemetry storage       | `useRef` ring buffers inside `TelemetryProvider` (no `useState`)               | Zero re-renders; telemetry collection is a side effect, not reactive state                                   |
| Click/command tracking  | Via `subscribeToExecutions` on `CommandProvider`                               | No ad-hoc instrumentation — leverages the existing command registry as the single source of executed actions |
| Fetch interception      | `window.fetch` monkey-patch inside `TelemetryProvider` `useEffect`             | Catches all `fetch` calls including TanStack Query queryFns; only `/api/` paths recorded                     |
| Dev-cycle auth          | Bearer token (`CYCLE_API_KEY` env var) for POST, session+isSystemAdmin for GET | Machine-to-machine write path; browser read path follows existing admin gate pattern                         |
| Cycle dashboard         | Tailwind progress bars, no chart library                                       | No new dependency; green/yellow/red bars communicate 100%/≥60%/<60% at a glance                              |

## Architecture Invariants

- `TelemetryProvider` must be a **child of `CommandProvider`** (in `__root.tsx`) so it can call `useCommands().subscribeToExecutions`.
- The fetch interceptor restores `window.fetch` on unmount — no global leak after the provider unmounts.
- `ENCRYPTION_SECRET` must be a 32-byte hex string (64 chars). The llm-config route logs a warning and falls back to plaintext if missing; the fallback is dev-only convenience.
- `CYCLE_API_KEY` must be set in `.env` before the AI worker can POST cycles; the endpoint returns 401 if the env var is empty.
- `devCycles` has no `tenantId` — it is a global developer-process table, not tenant data.
- All keyboard shortcuts go through `CommandProvider` — the `open-feedback` command (Shift+F1) follows this rule; no ad-hoc `keydown` handler.

---

## What Is Already Done — Do Not Rebuild

### 13.A LiteLLM Python Microservice

**File:** `services/llm/main.py`

- [x] **13.A1** FastAPI app with `GET /health` (liveness) and `POST /complete`
- [x] **13.A2** `CompletionRequest`: `{ prompt: str, model: str, endpoint_url: str | None }`; model defaults to `"openai/gpt-4o-mini"`
- [x] **13.A3** `litellm.api_base` set per-request when `endpoint_url` provided
- [x] **13.A4** `dev.sh` starts uvicorn from `services/llm/.venv/bin/uvicorn` on port `LLM_SERVICE_PORT` (default 11435)

### 13.B LLM Config Storage & Admin API

**File:** `apps/web/src/routes/api/admin/llm-config.ts`

- [x] **13.B1** AES-256-GCM helpers: `encrypt(text)` / `decrypt(encoded)` — IV + authTag + ciphertext packed as `iv:tag:cipher` hex string
- [x] **13.B2** `GET /api/admin/llm-config` — session + `isSystemAdmin` gate; returns config with `apiKey` / `githubToken` replaced by `"••••••••"` sentinel
- [x] **13.B3** `POST /api/admin/llm-config` — upserts `system_settings` row; preserves existing encrypted secrets when client sends sentinel back
- [x] **13.B4** Stored shape: `{ endpointUrl, model, apiKey (encrypted), githubToken (encrypted), githubRepo }`

### 13.C LLM Config Admin UI

**Files:** `apps/web/src/routes/_auth/app/admin/llm-config.tsx`, `apps/web/src/routes/_auth/app/admin/index.tsx`

- [x] **13.C1** `LlmConfigView` — form with `endpointUrl`, `model`, `apiKey` (password input + show/hide toggle), `githubToken` (password input + show/hide toggle), `githubRepo`
- [x] **13.C2** On load: fetches `GET /api/admin/llm-config`; sentinel values render as `"••••••••"` placeholder
- [x] **13.C3** On save: `POST /api/admin/llm-config`; toast on success/error
- [x] **13.C4** Registered as `"KI-Konfiguration"` entry in the admin panel sidebar (group `"system"`)
- [x] **13.C5** Admin panel (`admin/index.tsx`) gates entire view on `isSystemAdmin`

### 13.D Feedback Submit Server Function

**File:** `apps/web/src/routes/api/feedback/submit.ts`

- [x] **13.D1** `POST /api/feedback/submit` — auth via Better Auth session
- [x] **13.D2** Reads `system_settings` for `llm_config`; returns `{ configMissing: true }` if not yet configured
- [x] **13.D3** Decrypts `apiKey` + `githubToken` before use
- [x] **13.D4** LLM prompt instructs model to output JSON `{ title, body, label }` with Markdown sections: `## Summary`, `## Context`, `## Telemetry`; label must be `"bug" | "enhancement" | "question"`
- [x] **13.D5** Fallback on LLM failure: uses description (truncated to 80 chars) as title, raw snapshot as body, label `"bug"`
- [x] **13.D6** `POST https://api.github.com/repos/{owner}/{repo}/issues` with PAT; returns `{ issueUrl }` on success, `{ error }` on 502

### 13.E FeedbackSnapshot

**File:** `apps/web/src/lib/feedback-snapshot.ts`

- [x] **13.E1** `FeedbackSnapshot` interface: `url`, `userAgent`, `viewport`, `userId`, `tenantId`, `locale`, `lastError`, `timestamp`, `focusState`, `telemetry: TelemetrySnapshot`
- [x] **13.E2** `captureFeedbackSnapshot(userId, tenantId, locale, focusState, lastError, telemetry)` — pure function, no side effects

### 13.F FeedbackModal Component

**File:** `packages/ui/components/feedback-modal.tsx`

- [x] **13.F1** `FeedbackModal({ open, onClose, snapshot })` — renders only when `open === true`
- [x] **13.F2** Textarea (min 10 chars, required); `<details>` collapsible with `JSON.stringify(snapshot, null, 2)` read-only `<pre>`
- [x] **13.F3** States: `idle` → `loading` → `success` (shows issue URL as link) | `error` (retry button)
- [x] **13.F4** Escape key closes modal (via `window.keydown` listener, cleaned up on unmount)
- [x] **13.F5** `configMissing` response shows "KI-Service nicht konfiguriert" message in error state

### 13.G Header Entry Point & AppLayout Wiring

**File:** `apps/web/src/routes/_auth/app/route.tsx`

- [x] **13.G1** `MessageSquarePlusIcon` button in AppBar right rail; title `"Report issue or feedback (Shift+F1)"`
- [x] **13.G2** `open-feedback` command registered: scope `global`, shortcut `Shift+F1`
- [x] **13.G3** Snapshot captured at modal-open transition via `useEffect` watching `feedbackOpen` edge (`prevFeedbackOpen` ref)
- [x] **13.G4** `TelemetryProvider` wraps `ActionBarProvider` + `AppLayoutInner` in `AppLayout`
- [x] **13.G5** `lastError` derived from `getSnapshot().errors` (last entry) — old standalone `window.onerror` state removed

### 13.H TelemetryContext

**File:** `packages/ui/platform/telemetry-context.tsx`

- [x] **13.H1** `TelemetryProvider` — four `useRef` ring buffers (no re-renders):
  - `errorsRef` (cap 5): `window.addEventListener('error')` + `'unhandledrejection'`
  - `apiCallsRef` (cap 10): `window.fetch` interceptor; records `url`, `method`, `status`, `latencyMs`, `timestamp`; only `/api/` paths
  - `navigationRef` (cap 5): `router.subscribe('onLoad', ...)` via TanStack Router
  - `commandsRef` (cap 20): `subscribeToExecutions` from `CommandProvider`
- [x] **13.H2** `getSnapshot(): TelemetrySnapshot` — returns shallow copies of all four buffers; wrapped in `useCallback` with empty deps
- [x] **13.H3** `useTelemetry()` hook — throws if used outside provider
- [x] **13.H4** Exported types: `ApiCallEntry`, `NavEntry`, `ErrorEntry`, `TelemetrySnapshot`

### 13.I CommandProvider Extension

**File:** `packages/ui/platform/command-registry.tsx`

- [x] **13.I1** `CommandContextValue` gains `subscribeToExecutions: (cb: (commandId: string) => void) => () => void`
- [x] **13.I2** `executionSubscribers` stored in `useRef<Set<(id: string) => void>>`; never triggers re-render
- [x] **13.I3** `executeCommand` notifies all subscribers after successful command execution

### 13.J Dev-Cycle-Metrics

**Files:** `packages/db/src/schema/app.schema.ts`, `apps/web/src/routes/api/admin/cycles.ts`, `apps/web/src/routes/_auth/app/settings/cycles.tsx`

- [x] **13.J1** `devCycles` table (migration `20260516125306_numerous_malice`): `cycleId` (uuidv7 PK), `cycleNumber`, `recordedAt`, `sliceFitScore`, `sliceFitMax`, `storyCoverage`, `storyCoverageMax`, `testsAdded`, `vpTestPass`, `blocker`, `processAdjustment`, `createdAt`
- [x] **13.J2** `POST /api/admin/cycles` — Bearer-token auth (`Authorization: Bearer $CYCLE_API_KEY`); inserts row; returns 201 + created row
- [x] **13.J3** `GET /api/admin/cycles` — session + `isSystemAdmin` gate; returns last 50 cycles `ORDER BY recorded_at DESC`
- [x] **13.J4** `CyclesView` — admin-only (`!isSystemAdmin` → "Access denied"); `useQuery` with `enabled: isAdmin`
- [x] **13.J5** `ProgressBar` component — green (`pct === 100`), yellow (`≥ 60`), red (`< 60`); `h-1.5` Tailwind bar + numeric % label
- [x] **13.J6** Table columns: Cycle #, Recorded (locale date), Slice-Fit bar, Story-Coverage bar, Tests, VP Pass (✓/✗/—), Blocker (truncated)
- [x] **13.J7** API help line in page header: `POST /api/admin/cycles · Bearer: $CYCLE_API_KEY`
- [x] **13.J8** i18n: `devCycles.*` keys in both `de.json` and `en.json` (top-level namespace)

---

## Roadmap — Not Yet Built

### 13.K AI Worker Integration (cycle reporting)

- [ ] **13.K1** After each cycle, the AI worker POSTs to `/api/admin/cycles` with the structured result — script or inline curl in the worker process
- [ ] **13.K2** Historical backfill: one-time script to parse existing `.gemini/` Markdown cycle logs and POST them to the API

### 13.L Cycle Dashboard Enhancements (v2)

- [ ] **13.L1** Trend line: consecutive 100% cycles streak shown as a badge ("🔥 N in a row")
- [ ] **13.L2** Blocker frequency analysis: aggregate blocker text, surface most common themes
- [ ] **13.L3** Link from cycle row to the GitHub milestone or PR range (requires `prRange` field in the table)

### 13.M Telemetry Enhancements (v2)

- [ ] **13.M1** Redact sensitive URL parameters (tokens, IDs) in `apiCallsRef` before inclusion in snapshot
- [ ] **13.M2** Capture React render error boundaries (`componentDidCatch`) and push to `errorsRef`
- [ ] **13.M3** Add `sessionDurationMs` (session start timestamp) to `TelemetrySnapshot`

### 13.N Ticket Service Enhancements (v2)

- [ ] **13.N1** Rate limiting on `POST /api/feedback/submit` per user (e.g. 5 submissions / 10 min) to prevent accidental spam to GitHub
- [ ] **13.N2** Label sync: webhook from GitHub to mark the issue as `closed` in a `feedback_issues` table (linkable to `userId`)
- [ ] **13.N3** Screenshot attachment: capture `canvas.toDataURL()` at snapshot time, upload to GitHub issue as base64 inline image

---

## Verification Checklist

### LLM Service

- [ ] `GET http://localhost:11435/health` returns `{ "ok": true }`
- [ ] `POST /complete` with valid model + prompt returns `{ content: "..." }`
- [ ] `POST /complete` with `endpoint_url` pointing to a local Ollama instance works

### LLM Admin Config

- [ ] `GET /api/admin/llm-config` returns 403 for non-admin session
- [ ] `GET /api/admin/llm-config` returns `{ configured: false }` on fresh install
- [ ] Save config → reload → `apiKey` field shows `"••••••••"` (not plaintext)
- [ ] Saving with sentinel value preserves the previously stored encrypted key

### Feedback Modal

- [ ] `Shift+F1` opens the modal from any view
- [ ] `?` button in header opens the modal
- [ ] Snapshot collapsible shows `telemetry.apiCalls`, `telemetry.navigation`, `telemetry.commands`
- [ ] Submit with < 10 chars keeps button disabled
- [ ] Unconfigured system shows "KI-Service nicht konfiguriert" message
- [ ] Successful submission shows GitHub issue URL as a clickable link

### Telemetry Ring Buffers

- [ ] Navigate to 6 routes → `navigation` array holds at most 5 entries (oldest dropped)
- [ ] Trigger `window.onerror` 6 times → `errors` holds at most 5 entries
- [ ] Make 11 `/api/` fetch calls → `apiCalls` holds at most 10 entries
- [ ] Execute 21 commands → `commands` holds at most 20 entries
- [ ] Non-`/api/` fetches (CDN, external) are NOT recorded in `apiCalls`
- [ ] `window.fetch` is fully restored after `TelemetryProvider` unmounts

### Dev-Cycle-Metrics

- [ ] `POST /api/admin/cycles` without `Authorization` header returns 401
- [ ] `POST /api/admin/cycles` with invalid token returns 401
- [ ] `POST /api/admin/cycles` with valid `CYCLE_API_KEY` creates row and returns 201
- [ ] `GET /api/admin/cycles` returns 403 for non-admin session
- [ ] Dashboard at `/app/settings/cycles` shows "Access denied" for non-admin users
- [ ] Progress bar is green for 100%, yellow for 60–99%, red for < 60%
- [ ] `vp_test_pass = null` renders as `—` in the VP Pass column
