# Hermes Prompt Card for Slopware

Copy/paste this when asking Hermes to work in Slopware:

```text
Work in the Slopware repo.
1) Read map.md first, then only the active .agents docs needed for this task.
2) Check whether the generic platform flow already solves the problem.
3) Prefer standard components and existing command/focus patterns.
4) Keep the change small and server-safe.
5) Never trust tenantId from the client.
6) Route every keyboard shortcut through CommandProvider.
7) Verify with pnpm lint; use pnpm build only if the issue is about build output.
8) Report back with: changed files, architecture rationale, and any remaining risks.
```

Quick reminders:

- Read `map.md` first.
- Do not open `.agents/archive/` unless investigating history.
- Prefer `DataGrid`, `EntityMask`, `TriViewWorkspace`, and `DocumentEditor` before custom UI.
- Archive business data instead of hard-deleting it.
- Keep tenant isolation server-side.
