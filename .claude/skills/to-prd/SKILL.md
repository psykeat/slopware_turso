---
name: to-prd
description: Synthesize the current conversation context and codebase understanding into a Product Requirements Document (PRD). Use when the user asks for a PRD or wants to formalize discussion.
---

# Skill: To PRD

## Goal

Synthesize the current conversation context and codebase understanding into a Product Requirements Document (PRD).

## Triggers

- User asks for a PRD.
- User wants to formalize the current discussion into a spec.

## Core Instructions

- **Synthesize:** Use existing context. Do NOT interview the user for information already present.
- **Design:** Sketch major modules. Aim for "deep modules" (simple interfaces, complex logic).
- **Template:**
  1. **Problem Statement:** Why are we doing this?
  2. **Solution:** How are we solving it?
  3. **User Stories:** Extensive list of "As a user, I want..."
  4. **Implementation Decisions:** Technical choices made.
  5. **Testing Decisions:** How we will verify.
  6. **Out of Scope:** What we are NOT doing.
- **Publish:** Save as a file (e.g., `PRD.md`) or post to issue tracker.
