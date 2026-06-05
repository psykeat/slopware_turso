# Task Prompt: Issue #5

## Title

DataGrid: Spalten verschieben per Drag & Drop (Base/Tenant/User Override)

## Description

## What

Die DataGrid-Komponente soll eine Drag-and-Drop-Umsortierung von Spalten unterstützen. Die Reihenfolge wird über ein Drei-Ebenen-Modell persistiert:

1. Base-Tenant (isBase: true) → schreibt Default über tenant_layouts (scope: global)
2. Tenant-Override → schreibt eigene Reihenfolge über tenant_layouts (scope: tenant)
3. User-Override → schreibt nur in localStorage (Key: col-order:{entityName}:{panelId}:{userId})

Priorität beim Render: localStorage → tenant_layouts (tenant) → tenant_layouts (global) → Code-Default.

## Files

- `packages/ui/components/data-grid.tsx` → Drag-and-Drop-Logik, Spaltenreihenfolge-State
- `apps/web/src/routes/api/metadata/$.ts` → Endpunkt zum Speichern der Tenant-Reihenfolge via tenant_layouts

## Acceptance Criteria

- [ ] Spalten per Drag & Drop umsortierbar (visuelles Drag-Feedback)
- [ ] Reihenfolge nach Drag überlebt Page-Reload (localStorage für User)
- [ ] Base-Tenant-Admin kann globale Default-Reihenfolge über einen "Als Standard speichern"-Button publizieren
- [ ] Tenant-Admin kann Tenant-spezifische Reihenfolge speichern
- [ ] Normale User-Override über localStorage
- [ ] pnpm lint = 0 Fehler

## Instructions

1. Implement the changes requested in this issue.
2. Use "RALPH: fix #5 - DataGrid: Spalten verschieben per Drag & Drop (Base/Tenant/User Override)" for commit messages.
3. Run tests and lint checks (pnpm lint) to verify the fix.
4. If you have open questions or design blockers, write them clearly into a file called ".runs/issue-5.CdFani/blocked.md" and exit with <promise>NO MORE TASKS</promise>.
5. When successfully completed, include <promise>NO MORE TASKS</promise>.
