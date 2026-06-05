# Task Prompt: Issue #3

## Title

Designer: Save = immer Save+Apply (duale Route entfernen)

## Description

## What

Aktuell gibt es Spuren einer dualen Route (draft-save vs apply). `persistActiveSurface` nimmt noch einen mode-Parameter. Dieser wird entfernt — jeder Aufruf feuert immer `/apply`. Der F10-Shortcut und der Save-Button sollen immer direkt `applyDesign()` aufrufen.

## Files

- `packages/ui/platform/designer-context.tsx` → persistActiveSurface, saveDesign, applyDesign, closeDesignMode
- `packages/ui/components/inline-designer.tsx` → Button-Labels und Shortcut-Registrierung

## Acceptance Criteria

- [ ] persistActiveSurface hat keinen mode-Parameter mehr
- [ ] Einziger API-Call: POST /api/metadata/designer/:entity/:surface/apply
- [ ] F10 speichert und schließt Designer in einem Schritt
- [ ] Save-Button im InlineDesigner-Panel immer aktiv (kein Draft-vs-Apply Toggle mehr)
- [ ] pnpm lint = 0 Fehler

Depends on #2

## Instructions

1. Implement the changes requested in this issue.
2. Use "RALPH: fix #3 - Designer: Save = immer Save+Apply (duale Route entfernen)" for commit messages.
3. Run tests and lint checks (pnpm lint) to verify the fix.
4. If you have open questions or design blockers, write them clearly into a file called ".runs/issue-3.WJHZPD/blocked.md" and exit with <promise>NO MORE TASKS</promise>.
5. When successfully completed, include <promise>NO MORE TASKS</promise>.
