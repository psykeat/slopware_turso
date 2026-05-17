# 16 — Deletion & Archive Policy

## Rules

### Documents
| Type | Draft | Posted |
|---|---|---|
| N, q, p | hard delete (try-catch FK) | hard delete (try-catch FK) |
| A, b | hard delete (try-catch FK) | archive + silent stock reversal |
| L, l, V, U, Z, E | hard delete (try-catch FK) | archive only |
| R, G, r, g | **never** | **never** |

**Silent reversal on archive of posted A/b:** within the same DB transaction as setting `archived_at`, insert compensating `inventory_movement` rows (negative delta per line) and update `inventory_balance` (`reserved_qty -= qty` / `available_qty += qty` for A; `expected_purchase_qty -= qty` / `available_qty += qty` for b).

### Storno
Only R→G and r→g. All other storno routes must be removed from `document-service.ts`.

### Non-document entities
All user-CRUD entities: attempt hard `DELETE`, catch Postgres FK violation, show error + "Archive instead?" button. No pre-flight query.

## Archived = hidden
Every list query must filter `WHERE archived = false` (or `archived_at IS NULL` for address/article/document). `DataService` already handles `archived` universally. Dedicated module routes (`/api/documents`, `/api/addresses`, `/api/articles`) must be audited to confirm `archivedAt IS NULL` is applied.

## Schema (already migrated)
- `is_active` removed from all 24 user-CRUD tables (migration `20260516190000_remove_isactive_unify_archived`)
- `document_type` and `document_group` gained `archived boolean NOT NULL DEFAULT false` (backfilled from `NOT is_active`)
- All code call sites updated

## UX
- Delete confirmation prompt: "Permanently delete [name]? This cannot be undone."
- On FK violation: error message + inline "Archive instead" button
- R/G/r/g: no delete option rendered in UI at all
- Posted L/l/V/U/Z/E: no delete option; archive is the only removal action
- Posted A/b: archive triggers silent reversal (transparent to user)
