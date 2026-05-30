# Mail PRD

## Purpose

Mail adds a tenant-scoped operational email client to slopware. It is not a generic connector UI and not a marketing-style mailbox clone. It exists to let users receive, search, prepare, draft, and send business email from the workspace while keeping tenant isolation, provider credentials, document workflows, commands, and audit trails under server control.

V1 is complete. The delivered scope is Gmail and Microsoft Graph support through a provider adapter boundary, with a slopware-owned relational core model. Provider state is synchronized into canonical tables; UI actions call dedicated mail domain APIs; provider webhooks only enqueue recovery or sync work.

The sections below document the implemented baseline and the remaining post-V1 work.

## Product Goals

- Connect Gmail and Microsoft Graph mail accounts to a tenant.
- Store credentials only server-side on the email account record, encrypted at rest.
- Model accounts, identities, grants, labels, threads, messages, attachments, sync state, jobs, templates, render logs, drafts, and outbox records in the database.
- Support mailbox browsing inside `/app/email` as an operational workspace with account/folder navigation, thread list, thread preview, composer, and inspector context.
- Support document email preparation from existing document data: from identity, recipients, template-rendered subject/body, PDF attachment materialization/metadata, draft save, queue, and send.
- Keep all tenant isolation server-side. Client payloads must never supply or override `tenantId`.
- Route keyboard shortcuts and contextual actions through `CommandProvider`.
- Treat provider webhooks as signals only. Canonical mailbox state always comes from Gmail history or Graph delta pulls.

## Non-Goals

- No AI-native mail features in the current mail scope.
- No blind copy of Mail-0/Zero or shadcn Mail data model, routing, state management, or UI implementation.
- No use of generic `tenantConnector.credentials` for mail credentials.
- No client-side provider token handling.
- No UI-request-driven mailbox sync beyond explicit queueing of jobs.
- No hard delete for business mail records. Use archive/status fields.

## Implemented Baseline

The implementation is in place and the provider/mail smoke flows are exercised against live Gmail. Microsoft Graph is covered through a live external send receipt plus service-layer fixture coverage for sync, draft/send, watch renewal, and attachment fetch.

### Schema

Email tables live in `packages/db/src/schema/app.schema.ts` with migration `packages/db/migrations/20260526120000_email_core/migration.sql`.

Current tables:

- `emailAccount`: tenant-scoped provider account, encrypted credentials, sync/watch status.
- `emailIdentity`: send-capable identities and aliases for an account.
- `emailAccountUserGrant`: per-user read/send/manage grants.
- `emailThread`: canonical tenant/account thread state.
- `emailMessage`: canonical message/draft state.
- `emailAttachment`: relational attachment metadata and tenant storage key references.
- `emailLabel`: provider label/folder metadata.
- `emailMessageLabel`: message/label M:N relation.
- `emailSyncState`: full/incremental sync cursors.
- `emailTemplate`: reusable subject/body templates.
- `emailTemplateBinding`: template resolution by document/company/language/identity.
- `emailTemplateRenderLog`: audit log for rendered template output.
- `emailTemplate.category`: template business case/category, currently `document`.
- `emailJob`: DB-backed idempotent mail job queue.
- `emailOutbox`: draft/queued/sending/sent/failed send records.

Important constraints:

- Every operational email table has `tenantId`.
- Provider IDs are unique inside tenant/account scope.
- `emailAccount.provider` is constrained to `gmail` or `microsoft`.
- `emailMessage.direction` is constrained to `inbound`, `outbound`, or `draft`.
- `emailJob.jobType` is constrained to `initial_sync`, `incremental_sync`, `watch_renewal`, `reconcile`, `send`, or `fetch_attachment`.

### Provider Boundary

Provider types and adapters live under `packages/db/src/services/email/`.

Current contract:

- `EmailProviderAdapter`
- `connect`
- `listLabels`
- `fullSyncPage`
- `incrementalSync`
- `renewWatch`
- `createDraft`
- `sendDraft`
- `sendMessage`
- `modifyLabels`
- `markRead`
- `fetchAttachment`

Current adapters:

- `GmailProviderAdapter`
- `GraphProviderAdapter`

Both adapters now support OAuth callback exchange, identity bootstrap, full sync, incremental sync, watch/subscription renewal, draft creation, send, label/read mutation, and attachment fetch. Gmail uses Gmail history/full thread pulls; Graph uses delta queries and message attachment fetches.

Credential bundles are encrypted through `packages/db/src/services/email/credential-crypto.ts` using `EMAIL_ENCRYPTION_SECRET` or `ENCRYPTION_SECRET` as a 32-byte hex key. Without a key, local development stores JSON plaintext for compatibility with the existing dev-secret pattern.

### Domain Services

Current services:

- `EmailAccountService`: account listing, identity listing, connect flow boundary, grant checks.
- `EmailSyncService`: queue sync jobs, run initial/incremental/reconcile/watch/send jobs, list/get threads, mark read, apply label, merge provider sync pages.
- `EmailSendService`: save draft, persist draft attachment metadata, create provider draft, queue draft, send draft, track send failure, reply, forward.
- `EmailTemplateService`: resolve and render templates using simple `{{path}}` substitution, write render logs.
- `EmailDocumentService`: resolve document mail defaults and prepare document email drafts from document/customer/company/identity context.
- `EmailJobService`: enqueue, claim, complete, and fail DB-backed jobs.
- `Email webhook helpers`: validate provider webhook signals, extract account ids, and enqueue incremental sync jobs.

### API

Dedicated API surface lives in `apps/web/src/routes/api/email/$.ts`.

Current route families:

- `GET /api/email/accounts`
- `GET /api/email/accounts/:accountId/identities`
- `GET /api/email/accounts/connect/google`
- `GET /api/email/accounts/connect/microsoft`
- `GET /api/email/accounts/callback/google`
- `GET /api/email/accounts/callback/microsoft`
- `POST /api/email/accounts/connect/google`
- `POST /api/email/accounts/connect/microsoft`
- `POST /api/email/accounts/:accountId/initial-sync`
- `POST /api/email/accounts/:accountId/sync`
- `POST /api/email/accounts/:accountId/watch-renewal`
- `GET /api/email/accounts/:accountId/labels`
- `GET /api/email/accounts/:accountId/sync-state`
- `POST /api/email/webhooks/google`
- `POST /api/email/webhooks/microsoft`
- `GET /api/email/threads`
- `GET /api/email/threads/:threadId`
- `POST /api/email/threads/:threadId/mark-read`
- `POST /api/email/threads/:threadId/apply-label`
- `POST /api/email/threads/:threadId/archive`
- `POST /api/email/drafts`
- `POST /api/email/drafts/:draftId/send`
- `POST /api/email/drafts/:draftId/queue`
- `POST /api/email/drafts/:draftId/provider-draft`
- `POST /api/email/messages/:messageId/reply`
- `POST /api/email/messages/:messageId/forward`
- `POST /api/email/templates/render`
- `POST /api/email/documents/:documentId/compose-defaults`
- `POST /api/email/documents/:documentId/prepare-send`
- `POST /api/email/attachments/:attachmentId/fetch`
- `GET /api/email/messages/:messageId/attachments`
- `POST /api/email/jobs/run-next`

All authenticated API handlers resolve tenant context from the session and active tenant cookie. Webhook handlers do not trust a client-supplied tenant; they resolve tenant through the referenced email account.
Webhook validation logic is shared with the DB mail service helper so route and smoke behavior stay aligned.

### UI

Workspace route:

- `apps/web/src/routes/_auth/app/email.tsx`
- URL: `/app/email`

Current UI:

- Left navigation tree for accounts and system folders.
- Center thread list.
- Lower/right thread preview or composer.
- Inspector context for account/thread/message counts.
- Provider connect buttons that start Gmail and Graph OAuth flows.
- Composer is shared through `EmailComposeDialog` and used by `/app/email` and document send-by-email.
- Composer supports From identity, To/CC/BCC, Subject, Body, local Save Draft, explicit Provider Draft, Queue, and Send actions.
- System views for sync status and template editing/settings.
- Dedicated `/app/email-templates` CRUD route exists for template and binding management.
- Commands registered through `CommandProvider`: compose, sync account, mark read.
- Global navigation includes Email with `Alt+6`.

## Implementation Notes

- Draft save now writes attachment metadata into `emailAttachment`, not only the outbox JSON payload.
- Provider sync merge now writes provider attachments and message-label relations idempotently after label metadata is merged.
- `send` jobs are handled by the job runner and transition outbox records through `sending`, `sent`, or `failed`.
- Initial sync and reconcile jobs enqueue follow-up pages when provider pagination returns `hasMore` and `nextCursor`.
- Incremental sync can mark account/sync state as `recovery_required` and enqueue `reconcile` when provider cursors expire.
- API now exposes `POST /api/email/drafts/:draftId/provider-draft` for explicit provider draft creation.
- API now exposes `POST /api/email/documents/:documentId/compose-defaults` for server-rendered document defaults without creating a draft.
- Document email preparation materializes the PDF into tenant storage before draft creation so provider send can load the attachment from `storageKey`.
- `emailAttachment` now has a tenant/message/provider attachment uniqueness constraint for idempotent provider merges.
- Gmail and Microsoft connect buttons now start server-owned OAuth redirect flows.
- OAuth callbacks verify signed state, exchange authorization codes server-side, encrypt token bundles, load the primary identity, and create the grant for the connecting user.
- Public webhook endpoints now require configured provider webhook tokens/client state before enqueueing sync work; Microsoft validation-token handshakes are supported.
- A shared webhook helper now centralizes token validation and webhook job enqueueing for both route handling and smoke verification.
- The mail workspace now includes a template editing/settings surface and a sync-status recovery view.
- Live smoke scripts now cover mailbox sync, draft/send, label/read mutation, attachment fetch, webhook validation, watch renewal, forced reauth recovery, and Graph service-layer fixture coverage.

## Core Behavior

### Account Connection

The connect flow uses provider OAuth and server-side callback handling.

Requirements:

- Google OAuth must request Gmail scopes needed for labels, messages, drafts, send, history, and watch.
- Microsoft OAuth must request Graph scopes needed for mail folders, messages, delta, send, subscriptions, and offline access.
- Tokens must be encrypted before insertion into `emailAccount.credentialsEncrypted`.
- UI and generic connector payloads must never receive access tokens, refresh tokens, or tenant IDs.
- On successful connect, the service must load identities/aliases and create a manage/read/send grant for the connecting user.
- Account status must move to `reauth_required` when refresh fails permanently.

### Sync

Mailbox sync is asynchronous and idempotent.

Requirements:

- Initial sync queues `initial_sync` and pages through provider data using adapter cursors.
- Incremental sync queues `incremental_sync` and uses Gmail `history.list` or Graph delta links.
- Expired Gmail history cursors must set sync state to `recovery_required` and queue `reconcile` or a bounded full sync.
- Webhook routes must validate provider signatures or tokens before enqueueing work.
- Watch/subscription renewals must be handled through `watch_renewal`.
- Merges must be idempotent by tenant/account/provider IDs.
- Label/folder metadata must merge before message-label relations are written.
- Attachment binary fetch must be deferred to `fetch_attachment`.

### Sending

Draft and send flows are auditable.

Requirements:

- Draft save creates or updates canonical local draft/outbox state.
- Provider draft creation should be explicit and tracked by `providerDraftId`.
- Send must verify the user has `canSend` on the account and that the selected identity is send-capable.
- Outbox status transitions are `draft -> queued -> sending -> sent` or `failed`.
- Provider send result must update `emailMessage` from `draft` to `outbound`.
- Failed sends must preserve last error and be retryable.

## V1 Abschluss

Der aktuelle Stand der Mail-V1 ist funktional abgeschlossen für den Kern-Workflow:

- Gmail- und Microsoft-Graph-Accounts können serverseitig per OAuth angebunden werden.
- Tokens bleiben serverseitig verschlüsselt; keine Tokens oder `tenantId` werden an den Client weitergegeben.
- Identitäten und Aliases werden geladen, und passende Lese-/Sende-/Manage-Grants werden angelegt.
- Initial Sync, Incremental Sync, Watch/Renewal und Reconcile laufen asynchron und idempotent.
- Webhooks sind validiert und lösen nur Sync-Jobs aus.
- Das kanonische Mail-Modell ist in der Datenbank vorhanden: Accounts, Threads, Messages, Attachments, Labels, Sync-State, Jobs, Outbox und Templates.
- Attachments und Message-Label-Relationen werden idempotent gemerged.
- Drafts, Provider-Drafts und Send sind implementiert und auditierbar.
- Der Versand kann über die Mail-Domain-APIs ausgelöst werden.
- Der Mail-Workspace ist im UI vorhanden: Accounts, Folders, Threads, Preview, Composer und Inspector.
- Kommandos laufen über `CommandProvider`.
- Smoke-Tests decken Sync, Draft/Send, Labels/Read, Attachment Fetch, Webhooks, Watch Renewal und Recovery ab.
- Google Workspace und Microsoft Graph sind im Live-Flow angebunden und verifiziert.

V1-Status: Core Mail V1 erledigt. Offene Punkte liegen jetzt eher bei Härtung, Monitoring, UX-Feinschliff und erweiterten Edge-Case-Tests.

### Templates And Documents

Document email preparation is a domain workflow, not a UI-only convenience.

Requirements:

- Template binding resolution must consider document type, company, language, and identity.
- Render logs must be written for every template render used to prepare a document email.
- `emailTemplate.category` scopes templates by business case, and document mail currently uses `document`.
- PDF attachment metadata should reference the existing document print/storage pattern under tenant-scoped keys and the PDF must be materialized before send.
- The prepared email must remain editable before send.
- Document-send commands open the shared `EmailComposeDialog` popup from the document workflow.
- The shared composer is also used by the mail workspace.
- The composer must support recipient editing, cc/bcc, subject, body, attachment review, save draft, provider draft, queue, and send actions.
- Missing customer email must open the composer with a warning instead of failing the request path.

### Attachments

Attachment metadata belongs in relational tables; binary data belongs in tenant-scoped storage.

Requirements:

- Store provider attachment ID, file name, content type, size, inline content ID, and storage key.
- Fetch binary content only through `fetch_attachment` jobs or explicit user action.
- Storage keys must include tenant context.
- Inline attachments must be distinguishable from normal attachments.

### Authorization

Mail authorization is server-owned.

Requirements:

- Account list returns only accounts granted to the current user.
- Thread/message reads require `canRead`.
- Draft, queue, send, reply, and forward require `canSend`.
- Account management and grant changes require `canManage`.
- System admin tenant switching does not bypass mail grants except through explicit admin tooling.

## UX Requirements

The mail workspace should remain dense, quiet, and operational.

Required UI areas:

- Account/folder/label navigation.
- Thread list with read state, sender/recipient signal, subject, snippet, labels, attachment state, and date.
- Thread preview with chronological messages, headers, participants, attachments, and business context.
- Composer with From identity, To/CC/BCC, Subject, rich/html and plain-text preview, attachments, save draft, queue, and send.
- Inspector with related customer, related document, attachments, sync state, and domain actions.
- Empty states for no connected account, no threads, no selected thread, and provider reauth required.

Keyboard and command requirements:

- All shortcuts go through `CommandProvider`.
- Required domain commands: `connect-email-account`, `sync-email-account`, `prepare-document-email`, `send-email-draft`, `reply-email`, `forward-email`, `apply-email-label`, `mark-email-read`.
- Composer save/send must be command-addressable.
- Escape/back behavior should follow the platform focus model.

## Post-V1

Die folgenden Punkte sind bewusst nach dem V1-Abschluss eingeordnet. Sie beschreiben Ausbau, Härtung und Feinschliff, nicht mehr die Kernfreigabe.

### Provider Ausbau

1. Add real Microsoft Graph credentials and run the same mailbox/sync/send smoke paths against a live Graph mailbox.
2. Add provider fixture tests for MIME generation, provider message mapping, and attachment normalization.
3. Add negative-path coverage for Gmail history expiration, token refresh failure, and webhook rejection.
4. Keep the Gmail and Graph adapters aligned as the provider surface evolves.

### Job Runner Härtung

1. Keep hardening worker locking so queued jobs can run safely outside the request path.
2. Add retry backoff based on attempts and max attempts.
3. Expand job observability with provider request IDs and failure classes.
4. Add recovery-oriented runner coverage for `send`, `reconcile`, and `fetch_attachment`.

### API Härtung

1. Split the catch-all email API into route files when behavior stabilizes.
2. Validate request bodies with a schema library or local validators.
3. Ensure all routes return structured error JSON.
4. Add API tests for tenant isolation, grants, no client `tenantId`, webhook validation, and send identity enforcement.

### Data Und Sync

1. Add relation definitions for email tables if relation queries become useful.
2. Add indexes for mailbox search and high-volume thread/message listing.
3. Decide whether thread read state is derived from messages or stored as denormalized state.
4. Add reconciliation rules for deleted provider messages, moved folders, renamed labels, and provider-side draft deletion.
5. Add retention/archive rules for old sync jobs and render logs.

### UI Ausbau

1. Replace placeholder provider connect buttons with real OAuth start flows.
2. Add account status and reauth UI.
3. Add labels/folders from `emailLabel` to the navigation tree.
4. Add composer CC/BCC, From identity selector, attachments, rich text, queue, and send controls.
5. Add document mail composer integration from the documents module using a dedicated popup mask.
6. Add thread actions for reply, forward, archive, label, mark read/unread, and fetch attachments.
7. Add UI tests for rendering, selection, preview, composer draft save, and document email preparation.

### Templates Und Dokumente

1. Seed default email templates for document types.
2. Keep the template editing/settings surface aligned with `emailTemplate`, `emailTemplateBinding`, and `emailTemplate.category`.
3. Integrate PDF generation/storage so prepared emails attach real document PDFs.
4. Add template render previews and language fallback behavior.
5. Add audit navigation from document to prepared/sent email.

### Security Und Rotation

1. Define token encryption key source and rotation strategy.
2. Ensure token decrypt operations are isolated to provider adapter calls.
3. Add provider scope audits to account detail UI and admin views.
4. Add grant management UI for account owners/managers.
5. Add provider disconnect/archive flow that preserves historical messages and send audit.

## Post-V1 Validation

Regression and expansion checks for future mail changes:

- Schema tests for unique provider IDs, M:N labels, tenant isolation, sync cursor updates, and merge idempotency.
- Adapter tests for Gmail full sync, Gmail expired history recovery, Graph delta sync, and draft-send transitions.
- Service-layer fixture tests for Graph sync, incremental sync, watch renewal, attachment fetch, and provider draft/send flows.
- API tests for authenticated access, grant enforcement, webhook validation, and send identity enforcement.
- UI tests for workspace render, account/folder navigation, thread selection, preview, composer save, and document mail prepare.
- Smoke checks for live Gmail initial/incremental sync, live Graph send confirmation, provider draft/send, label/read mutation, attachment fetch, watch renewal, webhook validation, and forced reauth recovery.
- Run `pnpm lint` or `node_modules/.bin/vp lint --type-aware --type-check` after implementation milestones.
- Do not run production builds unless bundling or build output is the issue.

## Residual Risks

- Graph adapter smoke parity still needs to be maintained as the provider surface evolves.
- The first job runner path remains API-triggered and does not yet provide robust worker locking.
- Template rendering is intentionally simple and should be hardened before exposing advanced template editing.
- The current workspace has template and sync-status surfaces, but still lacks polish around provider status visualization, recovery UX, and document mail workflows.
- Full-repo lint may currently fail on unrelated dirty files; mail-specific lint passed for the first implementation slice.
