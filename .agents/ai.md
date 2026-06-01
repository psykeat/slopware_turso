# AI & Mail Module Runtime Contract

## 1. Core AI Architecture

- **Orchestration**: AI is a server-owned runtime acting over effective metadata, focus context, and controlled commands. No client-side direct writes or one-off mega-prompts are allowed.
- **Shared AI Overlay Shell (`AiOverlayHost`)**:
  - Opened through global `CommandProvider` and controlled by focus state.
  - Closes via contextual `Escape` lifecycle.
  - Zero permanent layout footprint (temporary, context-bound overlay).
- **Task Scopes**: Registered against the shared overlay host (e.g. `mail-order-review` optimized for "order from existing offer" flows). Server decides resolution, validation, and apply actions. Legacy `plan`/`plans` routes are deprecated.

## 2. Mail Module Integration (Mail V1)

- **Status**: Completed and fully operational. Sync, credentials, and folder/thread work are domain-controlled.
- **Data Model**: Managed across standard tables (`emailAccount`, `emailThread`, `emailMessage`, `emailAttachment`, etc.) under `packages/db/src/services/email/`.
- **Mail AI Flow**: Uses the shared AI overlay shell and `mail-order-review` task scope. The mail workspace itself (`email.tsx`) is _not_ an AI shell.

## 3. Non-Negotiable Invariants

1. **No direct writes** from the LLM model to the database.
2. **No trust** in client-provided tenant IDs (tenant context is resolved strictly server-side).
3. **No ad hoc keyboard logic** outside `CommandProvider`.
4. **No permanent AI layout reservations** in the workspace.
5. **No hard deletes** for operational business data (use `archived: true` PATCH instead).
