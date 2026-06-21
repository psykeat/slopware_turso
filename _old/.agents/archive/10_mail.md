# Mail Module

## Purpose

Mail is the tenant-scoped operational email workspace in slopware. It supports account connection, sync, browsing, drafting, sending, and document-related email preparation under server control.

## Current status

Mail V1 is implemented.

- Gmail and Microsoft Graph are supported through provider adapters.
- Credentials are stored server-side and encrypted at rest.
- Canonical mail state lives in relational tables.
- Sync, reconcile, watch renewal, draft creation, send, and attachment fetch are domain-controlled.
- UI actions go through `CommandProvider`.

## Current boundaries

- No client-side provider token handling.
- No trust in client-supplied `tenantId`.
- No hard delete for business mail records.
- Provider webhooks only trigger server work.
- The mailbox remains a normal workspace, not a separate AI shell.

## Core data model

Mail state is represented by:

- `emailAccount`
- `emailIdentity`
- `emailAccountUserGrant`
- `emailThread`
- `emailMessage`
- `emailAttachment`
- `emailLabel`
- `emailMessageLabel`
- `emailSyncState`
- `emailTemplate`
- `emailTemplateBinding`
- `emailTemplateRenderLog`
- `emailJob`
- `emailOutbox`

## Services

Current domain services live under `packages/db/src/services/email/`.

- `EmailAccountService`
- `EmailSyncService`
- `EmailSendService`
- `EmailTemplateService`
- `EmailDocumentService`
- `EmailJobService`

## API surface

The mail API lives in `apps/web/src/routes/api/email/$.ts`.

Representative route families:

- account connect and callback routes
- sync and watch renewal routes
- thread read and mutation routes
- draft and send routes
- template render routes
- document mail preparation routes
- attachment fetch routes
- job runner routes

## UI

The main mail workspace is `apps/web/src/routes/_auth/app/email.tsx`.

It provides:

- account and folder navigation
- thread list
- thread preview
- composer
- inspector context
- command-driven actions

## Relation to AI

Mail-related AI now uses the shared AI overlay runtime and the mail review flow documented in the AI architecture docs.

- Do not treat the mail workspace itself as an AI shell.
- Do not reintroduce one-off mail AI routes when the shared AI task/review flow already exists.
