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
