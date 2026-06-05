# Task Prompt: Issue #7

## Title

Email: address_contact als Kontaktquelle + Inbound Matching

## Description

## What

Die address_contact-Tabelle wird zur Single Source of Truth für Kontakte im Mailclient. Zwei Integrationen:

**A) EmailComposeDialog Autocomplete:**
Das To/CC/BCC-Feld bekommt eine Autocomplete-Suche über GET /api/data/addressContact?q=<term>. Das Ergebnis wird als Dropdown-Liste angezeigt (Format: "Vorname Nachname <email@beispiel.at>").

**B) Inbound Email Matching:**
Im EmailSyncService bei jedem neuen eingehenden Thread/Message: from-Email gegen address_contact.email matchen. Bei Treffer → relatedAddressId auf dem email_thread-Record setzen (falls noch nicht gesetzt).

Kein Import von Google/Outlook-Kontakten.

## Files

- `apps/web/src/components/email/EmailComposeDialog.tsx` → To/CC/BCC-Input mit Autocomplete
- `packages/db/src/services/email/sync-service.ts` → upsertThread / Message-Verarbeitung
- `apps/web/src/routes/api/email/$.ts` → ggf. neuer Autocomplete-Endpunkt

## Acceptance Criteria

- [ ] Tippen im To-Feld zeigt Treffer aus address_contact (Name + Email)
- [ ] Auswahl befüllt das To-Feld mit "Name <email>" Format
- [ ] Inbound Sync setzt relatedAddressId bei Email-Match automatisch
- [ ] Kein Import von Google/Outlook-Kontakten
- [ ] pnpm lint = 0 Fehler

## Instructions

1. Implement the changes requested in this issue.
2. Use "RALPH: fix #7 - Email: address_contact als Kontaktquelle + Inbound Matching" for commit messages.
3. Run tests and lint checks (pnpm lint) to verify the fix.
4. If you have open questions or design blockers, write them clearly into a file called ".runs/issue-7.q29Sim/blocked.md" and exit with <promise>NO MORE TASKS</promise>.
5. When successfully completed, include <promise>NO MORE TASKS</promise>.
