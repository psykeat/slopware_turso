---
name: to-issues
description: Break a plan, spec, or PRD into independently-grabbable, vertical slice issues. Use when the user wants to convert a plan into issues or break down work.
---

# Skill: To Issues

## Goal

Break a plan, spec, or PRD into independently-grabbable, vertical slice issues.

## Triggers

- User wants to convert a plan into issues.
- User wants to create implementation tickets.
- User asks to "break down work".

## Core Instructions

- **Vertical Slices:** Create "tracer bullet" issues that cut through all integration layers (schema, API, UI, tests). Avoid horizontal layering (e.g., "build the API" then "build the UI").
- **Categorize:**
  - **HITL:** Human-In-The-Loop (requires decision, review, or manual step).
  - **AFK:** Agent-Friendly (can be implemented and merged without human interaction).
- **Quiz:** Present the breakdown to the user to confirm granularity and dependencies before final publishing.
- **Template:**
  - **Parent:** [Link to PRD/Main issue]
  - **What:** [Concise description]
  - **Acceptance Criteria:** [Checklist]
  - **Blocked by:** [Dependencies]

## Sizing Heuristics

- Split immediately when one issue spans more than one independent concern, especially across these boundaries:
  - UI + API
  - API + schema/migration
  - UI + schema/migration
  - runtime logic + background job/worker
  - behavior change + data backfill/reconciliation
- Split again if a child issue still contains more than one write path, more than one persistence target, or both load and save behavior in the same slice.
- A single child issue should normally introduce at most one new endpoint, one new persistence target, and one new UI affordance. If it needs more than one of those, split it again.
- Prefer one primary file cluster per child issue. If the change clearly requires different owners of state, data, or persistence, it is probably too broad.
- A short issue can still be too broad. Use the scope, not the line count, as the sizing signal.
- If an issue combines a read path and a write/persist path, split them unless they are the same small component and the same file cluster.
- If the acceptance criteria mention several unrelated outcomes, create a parent epic and separate child issues for each outcome.
- Keep parents as umbrellas when the feature is still too wide, but only publish child issues that are independently grabbable.
- If a child issue introduces a new abstraction boundary, ask whether that abstraction can itself be split into a smaller tracer bullet. If yes, split again.
- If you cannot describe the expected diff in one file cluster and one sentence, the slice is still too wide.

## Recommended Split Order

- First slice the read path or visible UI.
- Second slice the write path or persistence.
- Third slice schema/migration or service integration.
- Fourth slice reporting, cleanup, or follow-up automation.
- If any of those steps still bundles multiple writes, split that step before publishing it.

## Publishing Rule

- Do not final-publish a breakdown until each slice has:
  - one clear owner
  - one clear dependency chain
  - one clear acceptance set
  - a label classification of `AFK` or `HITL`
- If any slice still needs a human decision, mark that slice `HITL` and stop the breakdown there.
- If a proposed slice would require a second autonomous issue just to make its acceptance criteria testable, split it again before publishing.
