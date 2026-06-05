# Task Prompt: Issue #6

## Title

Adressen: Ansprechpartner Notiztext als zweispaltiges Layout

## Description

## What

In der Adress-EntityMask gibt es unterhalb der InlineEditGrid für Ansprechpartner eine große, separate "Ansprechpartner-Langtext"-Sektion (Kontaktauswahl-Buttons + LangTextRecordPanel). Diese wird vollständig entfernt und durch ein schlankes, zweispaltiges Layout ersetzt:

- Links: InlineEditGrid (wie bisher, notiztext-Spalte aus Grid entfernen)
- Rechts: Fixes Notizfeld ~280px breit, volle Höhe, zeigt notiztext der selektierten Zeile. Direkt editierbar via PATCH auf die aktuell selektierte Row.

Die selektierte Row der InlineEditGrid steuert das Notizfeld.

## Files

- `apps/web/src/routes/_auth/app/addresses.tsx` → Ersetzen der Langtext-Sektion (L871-L952)

## Acceptance Criteria

- [ ] Bisherige Ansprechpartner-Langtext-Sektion entfernt
- [ ] Zweispaltiges Layout: Grid links, Notizfeld rechts (~280px)
- [ ] Notizfeld zeigt notiztext der aktiv selektierten Zeile
- [ ] Direktes Bearbeiten des Notizfelds patcht via PATCH /api/data/addressContact/:id
- [ ] Bei keiner Selektion: Notizfeld deaktiviert mit Placeholder "Kontakt auswählen"
- [ ] pnpm lint = 0 Fehler

## Instructions

1. Implement the changes requested in this issue.
2. Use "RALPH: fix #6 - Adressen: Ansprechpartner Notiztext als zweispaltiges Layout" for commit messages.
3. Run tests and lint checks (pnpm lint) to verify the fix.
4. If you have open questions or design blockers, write them clearly into a file called ".runs/issue-6.c6dDlM/blocked.md" and exit with <promise>NO MORE TASKS</promise>.
5. When successfully completed, include <promise>NO MORE TASKS</promise>.
