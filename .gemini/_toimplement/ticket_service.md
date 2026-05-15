# PRD: AI-Augmented Feedback & Issue Service

## Problem Statement

When a user encounters a bug or wants to request a feature while working in the ERP workspace, they have no in-app way to report it. Filing a GitHub issue manually requires leaving the application, remembering the exact workspace state (which panes were open, which entity was selected, what the error was), and writing a structured report from scratch. This friction means bugs go unreported and valuable context is lost.

## Solution

An always-accessible feedback mechanism embedded in the workspace header. When triggered (button or keyboard shortcut), a modal captures the current workspace state automatically — active workspace, pane layout, selected entity, authenticated user, tenant, last JS error — and invites the user to add a short free-text description. A LiteLLM-backed Python microservice then formats this structured snapshot into a well-titled, classified GitHub issue (Bug / Feature Request / Question) and creates it via the GitHub API. The user receives the resulting issue URL directly in the modal.

System administrators can configure the LLM endpoint (model, provider, API key) and GitHub connection (PAT, target repository) through a dedicated admin panel in the user configuration section.

## User Stories

1. As a workspace user, I want to open a feedback modal with a single keyboard shortcut (`Shift+F1`), so that I can report a problem without interrupting my workflow.
2. As a workspace user, I want to click a `?` button in the header to open the feedback modal, so that the feature is discoverable without knowing the shortcut.
3. As a workspace user, I want to type a free-text description of my problem in the modal, so that I can provide context the automatic snapshot cannot capture.
4. As a workspace user, I want to see a collapsed "Context" section in the modal that shows what will be submitted, so that I understand and trust what data is being sent.
5. As a workspace user, I want the context block to be read-only, so that the AI always receives accurate state rather than manually edited data.
6. As a workspace user, I want the modal to show a loading state while the issue is being created, so that I know the system is working.
7. As a workspace user, I want to see the resulting GitHub issue URL in the modal after submission, so that I can immediately follow the issue's progress.
8. As a workspace user, I want the submitted context to include my current workspace ID and active pane/view layout, so that a developer can reproduce the exact UI state.
9. As a workspace user, I want the submitted context to include the currently selected entity ID (if any), so that bugs tied to specific records are immediately traceable.
10. As a workspace user, I want the submitted context to include the last JavaScript error that occurred in my session, so that frontend exceptions are captured even when I don't notice them.
11. As a workspace user, I want the submitted context to include my user ID, tenant ID, and active locale, so that auth- or tenant-specific bugs are identifiable.
12. As a workspace user, I want the submitted context to include my browser user-agent and viewport size, so that layout bugs can be reproduced on the correct device.
13. As a workspace user, I want the GitHub issue title and body to be written in clear English by the AI, so that I don't have to worry about formatting.
14. As a workspace user, I want the AI to automatically classify my report as Bug, Feature Request, or Question and apply the corresponding label, so that issues are triaged without manual work.
15. As a system administrator, I want a configuration panel in the user settings section (visible only to admins), so that I can configure the LLM and GitHub integration without touching environment files.
16. As a system administrator, I want to set the LLM endpoint URL, model name, provider, and API key in the admin panel, so that I can point the system at a local LLM or any hosted provider LiteLLM supports.
17. As a system administrator, I want to set the GitHub PAT and target repository (`owner/repo`) in the admin panel, so that issues land in the correct repo.
18. As a system administrator, I want the API key and GitHub PAT to be stored encrypted in the database, so that secrets are not exposed in plain text.
19. As a system administrator, I want the admin panel to be invisible to non-admin users (`is_system_admin = false`), so that regular users cannot access or modify the configuration.
20. As a system administrator, I want to save the configuration and have it take effect immediately on the next feedback submission, without restarting the application.

## Implementation Decisions

### Module 1 — LiteLLM Python Microservice (`services/llm/`)

A minimal FastAPI application with two endpoints:

- `GET /health` — liveness check
- `POST /complete` — accepts `{ prompt: string, model?: string }`, returns `{ content: string }`

Uses the `litellm` Python library to proxy to the configured provider. Model and endpoint are passed per-request (forwarded from the Node server), allowing runtime reconfiguration without restarting the service. `dev.sh` starts it via `uvicorn services/llm/main:app --port 11435 --reload`. Dependencies declared in `services/llm/requirements.txt`.

### Module 2 — LLM Config Storage

The existing `system_settings` table (scope = `'global'`, key = `'llm_config'`) is used to store configuration as a JSONB value. No new DB table is needed. The value shape:

```
{
  endpoint_url: string,
  model: string,
  provider: string,
  api_key: string,          // AES-256-GCM encrypted, key from ENCRYPTION_SECRET env var
  github_token: string,     // AES-256-GCM encrypted
  github_repo: string       // "owner/repo"
}
```

A domain query `getLlmConfigQuery` reads and decrypts the config server-side. A domain command `saveLlmConfigCommand` encrypts secrets before writing. Both are admin-gated via `is_system_admin` check in the server function layer.

### Module 3 — Frontend Context Snapshot

A pure function `captureFeedbackSnapshot()` in the workspace feature collects:

- `workspace`: current ws ID from `HashState`
- `panes`: active view keys per pane from `HashState`
- `selectedEntityId`: `sel` from `HashState` if present
- `userId`, `tenantId`: from the auth session passed as props
- `locale`: `lang` from `HashState`
- `url`: `window.location.href`
- `userAgent`: `navigator.userAgent`
- `viewport`: `{ width: window.innerWidth, height: window.innerHeight }`
- `lastError`: last captured JS error from a module-level `window.onerror` listener (initialized once on workspace mount, stored in a ref)
- `timestamp`: ISO 8601

Returns a typed `FeedbackSnapshot` object. This function has no side effects and is easily unit-tested.

### Module 4 — Feedback Modal Component

A React dialog (`FeedbackModal`) with:

- Textarea for user description (required, min 10 chars)
- Collapsible `<details>` block showing `JSON.stringify(snapshot, null, 2)` (read-only, `<pre>`)
- Submit button → loading state → success state showing issue URL as a link
- Error state with retry capability

Triggered from workspace state (`feedbackOpen: boolean`). Captures snapshot at the moment the modal opens (not at mount of workspace), so the state is maximally fresh.

### Module 5 — Header Entry Point

A `?` button (`hdr-btn` class) added to the right side of the workspace header, left of the user avatar. A `keydown` listener on `window` intercepts `Shift+F1` and toggles the modal. Both paths set `feedbackOpen = true` in local workspace state.

### Module 6 — Submit Server Function (`submitFeedbackFn`)

Protected by `authMiddleware`. Flow:

1. Reads `llm_config` from `system_settings` (decrypts secrets)
2. Builds a structured prompt containing the snapshot JSON + user description
3. `POST /complete` to the LiteLLM microservice → receives generated issue title + body + label
4. `POST https://api.github.com/repos/{owner}/{repo}/issues` with the PAT
5. Returns `{ issueUrl: string }` to the client

Prompt instructs the model to respond with JSON: `{ title, body, label }` where label is one of `bug`, `enhancement`, `question`.

### Module 7 — Admin Config Panel

A settings section rendered inside the existing user configuration view, conditional on `user.isSystemAdmin`. Contains a form with fields for all six config values. The API key and GitHub PAT fields render as password inputs (show/hide toggle). On save, calls `saveLlmConfigFn`. On load, `getLlmConfigFn` returns the config with secrets replaced by a `"••••"` sentinel so the UI can show "already set" without exposing the value.

## Testing Decisions

Good tests for this feature verify external behavior — what a user or downstream system observes — not implementation details like internal function calls.

**What makes a good test here:**

- Given a snapshot + description, the correct prompt structure reaches the LiteLLM service (integration test with a mock HTTP server)
- Given a LiteLLM response, the correct GitHub issue payload is constructed
- `captureFeedbackSnapshot()` returns all required fields and their correct types/shapes
- The admin server functions reject calls from non-admin users
- Config save/load round-trips correctly (encrypted at rest, decrypted on read)

**Modules to test:**

- `captureFeedbackSnapshot` — pure function, straightforward unit tests; prior art: domain query unit tests in `packages/domain/src/__tests__/`
- `submitFeedbackFn` — integration test with a stubbed LiteLLM HTTP server and stubbed GitHub API; prior art: existing command tests in `packages/domain/src/__tests__/`
- `getLlmConfigFn` / `saveLlmConfigFn` — test admin gate rejection for non-admin callers

**Not tested:**

- The LiteLLM Python service itself (thin proxy, no logic)
- The FeedbackModal rendering (no existing UI test infrastructure)

## Out of Scope

- Multi-repo routing (issues always go to the single configured repo)
- Per-tenant or per-organization LLM config (one global config)
- GitHub OAuth on behalf of the user (PAT only)
- Issue comment threads or status sync back from GitHub
- Attachment uploads (screenshots, files)
- Sentry-style automatic error capture and batched reporting
- Rate limiting on feedback submissions
- Notification/webhook when a GitHub issue is closed

## Further Notes

- The LiteLLM microservice runs on port `11435` by default (configurable via `LLM_SERVICE_PORT` env var). The TanStack server reads this from `process.env.LLM_SERVICE_URL`.
- If the LLM config is not yet set (fresh install), the `?` button is visible but the modal shows an admin prompt ("KI-Service nicht konfiguriert — bitte Admin kontaktieren") instead of the feedback form.
- The LiteLLM Python service must be added to `dev.sh` startup after the existing `pnpm run $DEV_CMD` to avoid blocking the Node servers.
- `ENCRYPTION_SECRET` must be a 32-byte hex string set in `.env`; the server function rejects requests if the env var is missing.
