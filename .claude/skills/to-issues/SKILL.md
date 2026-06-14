---
name: to-issues
description: Break a plan, spec, or PRD into small, independently-grabbable vertical-slice issues for agentic implementation.
---

# Skill: To Issues

## Goal

Turn a plan, spec, or PRD into thin vertical-slice issues that are easy to implement, verify, and merge.

## Use When

- The user wants to break down a PRD or plan into implementation issues.
- The user wants issue tracker tickets for an agentic loop.
- The user wants to check whether a breakdown is too coarse or too fine.

## Core Rules

- Create **vertical slices**, not horizontal layers.
- Each slice should be narrow but complete enough to verify on its own.
- Prefer **AFK** slices over **HITL** slices where possible.
- Keep the breakdown flat unless the user explicitly asks for an umbrella or epic.
- Do not final-publish until the user confirms granularity and dependency order.

## Slice Constraints

A child issue should normally contain:

- one user-visible behavior
- one primary file cluster
- one write path at most
- one persistence target at most
- one endpoint at most
- one UI affordance at most
- one clear dependency chain
- one clear acceptance set

If any slice contains more than one independent concern, split it again.

Split immediately when a slice combines:

- UI and API work that can be verified separately
- API and schema/migration work that can be verified separately
- read behavior and write behavior in different file clusters
- runtime behavior and background job/worker behavior
- behavior change and data backfill/reconciliation
- more than one write path
- more than one persistence target
- more than one endpoint
- more than one unrelated observable outcome

If you cannot describe the expected diff as one primary file cluster plus one sentence, the slice is still too broad.

## File Cluster Rule

Each child issue must include a bounded **File Cluster** section.

The file cluster should name the likely files, folders, or module area to touch, using stable repo-relative paths when possible.

Good:
- `app/features/invoices/*`
- `src/modules/auth/login.ts`, `src/modules/auth/login.test.ts`
- `db/schema/invoices.ts` and `api/invoices/*`

Bad:
- “frontend”
- “backend”
- “database stuff”
- a huge cross-repo list with no primary locus of change

Use enough path detail to constrain the agent, but do not over-specify line-level implementation.

## Labels

- **AFK**: can be implemented, tested, and merged without human judgment during execution.
- **HITL**: requires a human decision, review, approval, design choice, or manual external step.

If a slice needs human judgment to become testable, mark it **HITL** and stop decomposition there.

## Quiz Before Publish

Present the draft breakdown as a numbered list.

For each slice, show:

- **Title**
- **Type**: AFK or HITL
- **What**
- **File Cluster**
- **Blocked by**
- **Acceptance shape**: read path, write path, schema, integration, or validation

Ask the user:

- Is any slice too coarse or too fine?
- Are dependencies correct?
- Should any slice be merged or split?
- Are any AFK slices actually HITL?
- Does each slice have exactly one primary file cluster and one clear observable outcome?

Iterate until approved.

## Issue Template

### Parent
[Link to PRD or main issue, if any]

### What
[Concise end-to-end behavior for this slice]

### File Cluster
- [Primary repo-relative file/folder cluster]
- [Secondary cluster only if truly necessary]

### Acceptance Criteria
- [Observable outcome 1]
- [Observable outcome 2]
- [Tests or verification path]

### Blocked by
[Dependency issue reference or “None - can start immediately”]

### Type
AFK / HITL

## Publish Rule

Do not publish until each slice has:

- one clear owner
- one clear dependency chain
- one primary file cluster
- one observable behavior
- one bounded acceptance set
- one label: `AFK` or `HITL`

If a slice would require a second autonomous issue just to make its acceptance criteria testable, split it again first.