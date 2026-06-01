# AI Runtime Architecture

## Purpose

This document records the current AI runtime contract for slopware. The platform uses a shared, temporary overlay host and server-orchestrated task flows. It does not use one-off megprompts as the primary architecture.

## Current position

AI is a server-owned runtime over effective metadata, focus context, and controlled commands.

- Tenant context is resolved server-side from session/auth.
- The assistant sees a focused runtime context, not raw database tables.
- The server performs interpretation, lookup resolution, review construction, validation, and apply.
- The LLM may suggest intent and requested resolvers, but it never writes directly.
- All mutations happen through validated server paths or domain commands.

## Non-negotiable invariants

- No direct writes from the model.
- No trust in client-provided tenant IDs.
- No ad hoc keyboard logic outside `CommandProvider`.
- No permanent AI layout reservations.
- No direct use of raw tables when an effective metadata view or resolver exists.
- No hard delete for business data.

## Runtime flow

The preferred flow for AI work is:

1. Resolve focus context.
2. Open the shared overlay host.
3. Load a compact server projection.
4. Interpret intent and evidence.
5. Resolve candidates on the server.
6. Build a review payload.
7. Validate the review with dry-run rules.
8. Apply via controlled domain actions.

## Current endpoints

The active mail-oriented flow is:

- `GET /api/ai/context/mail-thread/:threadId`
- `POST /api/ai/tasks/mail/interpret-thread`
- `POST /api/ai/tasks/mail/resolve-thread`
- `POST /api/ai/tasks/mail/build-review`
- `POST /api/ai/reviews/:reviewId/validate`
- `POST /api/ai/reviews/:reviewId/apply`

The older `POST /api/ai/plan` and `POST /api/ai/plans/:id/*` routes are legacy compatibility paths only. Do not extend them for new work.

## Mail-specific behavior

Mail is the first concrete AI scope in the current implementation.

- The interpreter extracts intent, evidence, references, and requested resolvers.
- The resolver produces deterministic candidate lists for address, document, and related items.
- The review payload is what the UI renders.
- The apply step must fail if required references are still missing.
- If the thread has no direct customer assignment, the resolver may derive the customer from a referenced document.

## Persistence

Current persistence is centered on:

- `ai_run`
- `ai_prompt_version`
- `ai_interpretation`
- `ai_review`
- `ai_evidence`

Important fields:

- `ai_interpretation.source_thread_id` links the AI run back to the originating email thread.
- `ai_review` stores the review snapshot and apply payload.

## Shell contract

The AI overlay is a shared temporary shell.

- It is opened through `CommandProvider`.
- It is controlled by focus state.
- It closes through the same Escape lifecycle as other overlays.
- It must not reserve permanent UI space.

## What not to build

- Do not add a new route per business case when a task scope and resolver suffice.
- Do not move lookup resolution into the prompt.
- Do not return dependency placeholders when the server can resolve actual candidates.
- Do not let the LLM invent IDs, relations, or commands.

## Implementation note

Mail is the current example scope, but the runtime should stay generic. New AI work should be modeled as:

- a focused task scope,
- a server projection,
- deterministic resolvers,
- a review schema,
- and a controlled apply command.
