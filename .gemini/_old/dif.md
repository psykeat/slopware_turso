# Architecture Gap Analysis (DIF)

This document tracks the difference between the idealized core architecture and the actual implementation state ("As-Built"). It serves as a bridge for developers to understand current gaps, sanctioned deviations, and upcoming implementation phases.

## 1. Alterations through Implementation

The following shifts in architecture have been sanctioned as valid implementation choices:

*   **Domain Layer Consolidation:** The intended `packages/domain` was merged into `@repo/db/src/services/` (e.g., `document-service.ts`) to reduce cross-package overhead while maintaining service-based encapsulation.
*   **API Pattern Shift:** The project has adopted RESTful API route handlers in `apps/web/src/routes/api/` as the primary mutation and data-access pattern, complementing TanStack server functions.
*   **Derived Data Strategy:** PostgreSQL **Materialized Views (MVs)** are the primary mechanism for statistics, triggered by `pg_notify` and refreshed via `pg_cron` or service-level triggers.
*   **Specialized Settings UX:** The `SettingsView` is a sanctioned deviation from the TriView pattern to better handle the "Pseudo-Singleton" nature of Company Master Data and grouped settings.

## 2. Comprehensive Status & Gaps

### UI/UX Gaps
- [ ] **applyDeltaEffect Trigger:** UI trigger and dialog for line quantity corrections on posted documents.
- [ ] **F8 Duplicate / F2 Edit:** Final wiring and registration for record duplication and editing across core modules.
- [ ] **Pricing Audit:** Final validation of article pricing/tax resolution in the Document Lines editor.

### Settings Module
- [ ] **SettingsView Component:** Implementation of the 2-column settings workspace.
- [ ] **Grouped Sidebar:** Navigation for all 20 settings entities in 5 thematic groups.
- [ ] **Tenant Fields Seed:** Execution of the metadata seed script for all settings-related tables.

### Statistics Module
- [ ] **Fiscal Automation:** Automatic generation of fiscal periods during company creation.
- [ ] **Extended MVs:** Creation of specialized materialized views for article groups and address categories.
- [ ] **Period Comparison:** Implementation of the dedicated `/app/statistics/period-comparison` route.

### AI Feedback Service
- [ ] **Docker Integration:** Addition of the LiteLLM Python microservice to the environment orchestration.
- [ ] **Secret Management:** Implementation of encrypted storage for LLM and GitHub secrets.
- [ ] **Snapshot Capture:** Final logic for capturing workspace state during feedback submission.

## 3. Implementation Roadmap (Feature Slices)

The following documents serve as active "flight plans" and checklists for ongoing feature implementation:

- **Frontend Redesign:** `.gemini/04_redesign.md` (Standard component completion, route rewrites, global commands).
- **Documents & Statistics:** `.gemini/05_documents.md` (Posting engine wiring, materialized views, fiscal periods, stock ledger).
- **Settings & Firmenstamm:** `.gemini/_toimplement/firmenstamm.md` (Company master data, helper tables).
- **AI Feedback:** `.gemini/_toimplement/ticket_service.md` (LiteLLM integration, issue reporting).

## 4. Architectural Alignment

| Vision (Core Docs) | Reality (Implementation) | Rationale |
|---|---|---|
| Separate Domain Package | Logic in `@repo/db/services` | Reduced build complexity and tighter schema integration. |
| Server Functions only | API Route Handlers | Standardized REST pattern for complex mutations and external hooks. |
| Generic TriView everywhere | Custom `SettingsView` | Ergonomic necessity for dense, non-hierarchical configuration data. |
| Controlled CRUD | Materialized Views | Performance-critical read scaling for analytics and dashboards. |

---
*Last updated: Friday, May 15, 2026*
ementation) | Rationale |
|---|---|---|
| Separate Domain Package | Logic in `@repo/db/services` | Reduced build complexity and tighter schema integration. |
| Server Functions only | API Route Handlers | Standardized REST pattern for complex mutations and external hooks. |
| Generic TriView everywhere | Custom `SettingsView` | Ergonomic necessity for dense, non-hierarchical configuration data. |
| Controlled CRUD | Materialized Views | Performance-critical read scaling for analytics and dashboards. |

---
*Last updated: Friday, May 15, 2026*
