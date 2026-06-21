# Hermes Prompt Templates for Slopware

This file is a copy-paste cheat sheet for prompting Hermes on Slopware tasks.
It follows the repo rules: map first, active docs only, generic-first UI, server-side tenancy, and lint as the main verification step.

## Feature template

```text
Work in the Slopware repo.
1) Read map.md first, then only the active .agents docs needed for this task.
2) Check whether the generic platform flow already solves the problem.
3) Prefer standard components and existing command/focus patterns.
4) Keep the change small and server-safe.
5) Never trust tenantId from the client.
6) Verify with pnpm lint; only use pnpm build if the issue is about build output.
7) Report back with: changed files, architecture rationale, and any remaining risks.
```

## Bugfix template

```text
Work in the Slopware repo.
1) Reproduce or trace the bug from the relevant route, component, or service.
2) Read only the docs that cover the affected area.
3) Verify whether the problem is a doc/code mismatch or a real implementation bug.
4) Fix the smallest code path that addresses the root cause.
5) Preserve generic-first UI, server-side tenancy, and the command/focus contract.
6) Verify with pnpm lint and a targeted manual check if needed.
7) Report the root cause, fix, and any follow-up risks.
```

## Refactor template

```text
Work in the Slopware repo.
1) Identify the exact behavior that must remain unchanged.
2) Read the relevant active specs and inspect live code before editing.
3) Refactor only around the stable contract; do not change tenant, command, or metadata semantics.
4) Keep the change incremental and easy to review.
5) Prefer shared components and existing abstractions over new bespoke ones.
6) Verify with pnpm lint and a narrow manual pass where appropriate.
7) Summarize what stayed invariant and what was improved.
```

## Quick reminders

- Read `map.md` first.
- Do not open `.agents/archive/` unless you are investigating history.
- Prefer `DataGrid`, `EntityMask`, `TriViewWorkspace`, and `DocumentEditor` before custom UI.
- Route every shortcut through `CommandProvider`.
- Never trust client-supplied `tenantId`.
- Archive business data instead of hard-deleting it.
- Use `pnpm lint` as the default verification gate.
