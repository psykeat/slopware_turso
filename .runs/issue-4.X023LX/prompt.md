# Task Prompt: Issue #4

## Title

Designer: Frame Inline-Rename im Sidebar

## Description

## What

Im InlineDesigner-Sidebar werden Frames (nodes mit kind === "group-frame") als Sections mit einem Label angezeigt. Dieses Label soll durch einen einfachen Inline-Click-to-Edit Mechanismus umbenannt werden können.

- Klick auf den Frame-Titel → input erscheint mit aktuellem Wert
- Enter oder Blur → updateFrameLabel(frameId, newLabel) aufrufen
- ESC → Abbrechen ohne Speicherung

## Files

- `packages/ui/components/inline-designer.tsx` → Frame-Rendering-Section (neu einzubauen)
- `packages/ui/platform/designer-context.tsx` → updateFrameLabel ist bereits implementiert

## Acceptance Criteria

- [ ] Frame-Labels im Sidebar sind per Klick editierbar
- [ ] Enter oder Blur übernimmt den neuen Wert
- [ ] ESC bricht ohne Speicherung ab
- [ ] Umbenennung wird als draftPatchOp gespeichert (über updateFrameLabel)
- [ ] pnpm lint = 0 Fehler

## Instructions

1. Implement the changes requested in this issue.
2. Use "RALPH: fix #4 - Designer: Frame Inline-Rename im Sidebar" for commit messages.
3. Run tests and lint checks (pnpm lint) to verify the fix.
4. If you have open questions or design blockers, write them clearly into a file called ".runs/issue-4.X023LX/blocked.md" and exit with <promise>NO MORE TASKS</promise>.
5. When successfully completed, include <promise>NO MORE TASKS</promise>.
