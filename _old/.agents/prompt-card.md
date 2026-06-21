# Agent Prompt Templates & Guidelines

Copy/paste these templates when asking AI coding assistants to work in the **slopware** monorepo workspace.

## 1. Feature Development Template

```text
Work in the Slopware repo.
1) Read map.md first, then only the active .agents docs needed for this task.
2) Check whether the generic platform flow already solves the problem.
3) Prefer standard components (DataGrid, EntityMask, TriViewWorkspace) and existing command/focus patterns.
4) To understand @repo/ui component APIs, ALWAYS read their generated TS declaration files under packages/ui/dist/ components/<name>.d.ts instead of reading their massive .tsx implementation files.
5) Keep the change small and server-safe (never trust tenantId from the client).
6) Route every keyboard shortcut through CommandProvider.
7) Verify with pnpm lint. Only use pnpm build if the issue is about build output.
8) Report back with: changed files, architecture rationale, and remaining risks.
```

## 2. Bugfix Template

```text
Work in the Slopware repo.
1) Trace the bug from the relevant route, component, or service.
2) Read only the docs and types under packages/ui/dist/ covering the affected area.
3) Fix the smallest code path that addresses the root cause.
4) Preserve generic-first UI, server-side tenancy, and the command/focus contract.
5) Verify with pnpm lint.
6) Report root cause, fix, and any follow-up risks.
```

## 3. Quick Reminders

- Read `map.md` first. Do not load `.agents/` wholesale.
- Do not open `.agents/archive/` unless you are investigating historical decisions.
- Archive business data instead of hard-deleting it.
- Keep tenant isolation strictly server-side.
- Use `pnpm lint` as the default verification gate.
