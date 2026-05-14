---
name: tdd
description: Build features or fix bugs using a red-green-refactor loop, focusing on behavior through public interfaces. Use when the user wants "test-first development" or mentions TDD.
---

# Skill: TDD (Test-Driven Development)

## Goal

Build features or fix bugs using a red-green-refactor loop, focusing on behavior through public interfaces.

## Triggers

- User wants to build features/fix bugs using TDD.
- User mentions "red-green-refactor".
- User asks for "test-first development".

## Core Instructions

- **Vertical Slicing:** Do NOT write all tests first. One test (RED) -> One implementation (GREEN) -> Repeat.
- **Public API Focus:** Verify behavior through public interfaces, not implementation details.
- **Workflow:**
  1. **Plan:** Confirm interface changes and behaviors to test.
  2. **Tracer Bullet:** Write one test and minimal code to pass.
  3. **Loop:** Repeat for remaining behaviors.
  4. **Refactor:** Only refactor when at GREEN.
- **Validation:** Use `pnpm test` (or equivalent project command) to verify.
