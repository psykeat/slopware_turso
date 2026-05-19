# Project Foundation Specification

## Purpose

This document defines the foundational structure of the project as a metadata-driven, database-centered, multi-tenant business platform with strict row-level security, controlled domain commands, generic UI composition, a platform-wide command and focus system, and tenant-aware extensibility.[cite:1][cite:2]

## Foundation statement

Everything business-facing is modeled as a module. Every approved module can be interpreted through common components, presentation is configurable through metadata, validation is centralized and metadata-driven, keyboard and focus behavior are standardized across the entire interface, and posting, security, and derived data remain controlled by domain commands and database invariants.[cite:1][cite:2]

## Core application shape

The primary business-facing frontend remains intentionally narrow and centered on three core areas: Addresses, Articles, and Documents. Additional business tables and helper structures belong primarily in company master data and configuration areas rather than becoming first-class top-level modules by default.[cite:1][cite:2]

This preserves coherence while still allowing extensibility through metadata, registries, helper tables, commands, layouts, and context-aware standard components.[cite:1][cite:2]

## Module model

A module is not simply a raw database table. A module is a business-facing entity definition composed of entity identity, permissions, effective metadata, default presentation, optional commands, and optional posting behavior.[cite:2][cite:1]

Every approved business-facing entity should be interpretable as a list view through common components, but not every entity should automatically receive unrestricted CRUD behavior. Master data usually supports generic CRUD flows, transaction drafts support state-aware CRUD plus commands, posted transactions support controlled commands but not free editing, and derived data stays read-only except for controlled rebuild or maintenance paths.[cite:2][cite:1]

## Generic entity contract

The platform should treat new business-facing work as a generic entity first, not as a custom screen by default.

The default contract is:

- `DataGrid` for list and grid interpretation.
- `EntityMask` for generic create, detail, patch, and archive flows.
- `Dropdown` and lookup behavior for foreign-key selection, backed by the effective lookup metadata and helper registries.
- `TriViewWorkspace` for hierarchy + list + dependent context modules.
- `DocumentEditor` for document entry and line-oriented transactional editing.

Custom views are allowed only when the generic contract cannot cover a documented business or ergonomic requirement.

## Module categories

| Category            | Examples                                                                    | Generic List View           | Generic CRUD                  | Commands                                     | Posting / Derived Behavior    |
| ------------------- | --------------------------------------------------------------------------- | --------------------------- | ----------------------------- | -------------------------------------------- | ----------------------------- |
| Master Data         | address, article, company [cite:1]                                          | Yes [cite:2]                | Yes, metadata-driven [cite:2] | Optional [cite:2]                            | No posting [cite:2]           |
| Transaction Drafts  | document, documentline before posting [cite:1]                              | Yes [cite:2]                | Yes, state-aware [cite:2]     | Yes [cite:2]                                 | Not yet posted [cite:2]       |
| Posted Transactions | posted documents [cite:1]                                                   | Yes [cite:2]                | No unrestricted CRUD [cite:2] | Yes, only allowed lifecycle actions [cite:2] | Controlled lifecycle [cite:2] |
| Derived Data        | inventory balances, inventory movements, facts, ledger projections [cite:1] | Yes, read-oriented [cite:2] | No [cite:2]                   | Internal rebuild only [cite:2]               | Strictly derived [cite:2]     |

## UI foundation

The UI is generic-first and built from a small family of platform standard components. New business-facing surfaces must use these shared building blocks before introducing specialized views.[cite:2][cite:1]

The standard component family is:

- DataGrid.[cite:1][cite:2]
- EntityMask.[cite:1]
- Dropdown and LookupTable.[cite:1][cite:2]
- NavigationTree.[cite:1]
- TriViewWorkspace.[cite:1][cite:2]
- StatisticsModule.[cite:1][cite:2]
- DocumentEditor.[cite:1][cite:2]
- ActionBar.[cite:1]
- InspectorPanel.[cite:1]
- ContextTabs.[cite:1]
- StatusBar.[cite:1]

Each of these components must consume effective metadata, participate in the shared command and focus system, support German and English metadata-based labels, and reuse the common validation and issue model.[cite:1][cite:2]

## Standard workspace patterns

### EntityPage

EntityPage is the standard list-detail-create-patch shell for generic business-facing entities. It is suitable for master data and for draft-oriented entities where unrestricted editing is allowed by the domain model.[cite:2][cite:1]

Use EntityPage for simple CRUD cases; prefer TriViewWorkspace or DocumentEditor when hierarchy, dependent context, or line editing is required.

### TriViewWorkspace

TriViewWorkspace is the standard three-region workspace for modules that combine hierarchy, record selection, and dependent context. It contains a left-side NavigationTree, an upper-right primary DataGrid, and a lower-right dependent context area rendered through InspectorPanel, ContextTabs, subordinate grids, or other approved standard components.[cite:1][cite:2]

TriViewWorkspace is the default pattern for:

- Articles: article group tree, article grid, article warehouse or stock-related context.[cite:1]
- Addresses: address category tree, address grid, contacts, delivery addresses, or related documents in the lower context region.[cite:1]
- Documents: document type or group tree, document grid, and document lines in the lower context region.[cite:1]

### DocumentEditor

DocumentEditor is a focused editing workspace for transactional document entry. It should separate document browsing from document editing and present a lightweight header region above a dedicated line editor, while still using the shared command, validation, lookup, and issue contracts.[cite:1][cite:2]

## Platform-wide command and focus system

A platform-wide command and focus system is a first-class foundation concern, not an optional ergonomic enhancement. The entire interface must behave as one coherent keyboard-first environment.[cite:2][cite:1]

### Command principles

- Every action resolves to a command.[cite:2][cite:1]
- Commands have scope, visibility, enablement, disabled reason, label, and shortcut metadata.[cite:1]
- Panels declare command support; they do not invent private shortcut semantics.[cite:1]
- Commands are invoked from keyboard, ActionBar, menus, context menus, and assistant-safe UI surfaces through the same runtime contract.[cite:1][cite:2]

### Focus principles

The active focus context must include workspace, panel, area, entity, record, field, row, and mode where relevant. This active focus drives which commands are available and how keyboard events are resolved.[cite:1][cite:2]

Focus areas should at minimum include workspace, panel, grid, form, lookup, dialog, designer, and statistics overlay.[cite:1]

### Required keyboard behavior

The platform should standardize the following representative bindings:

- `Alt+1` open Addresses.[cite:1]
- `Alt+2` open Articles.[cite:1]
- `Alt+3` open Documents.[cite:1]
- `Alt+0` open company master data and settings.[cite:1]
- `Alt+I` open the StatisticsModule for the current context.[cite:1][cite:2]
- `F3` create new record in the active context.[cite:1]
- `F4` delete or archive the current record if allowed.[cite:1][cite:2]
- `F5` open the lookup table for the active field if lookup-capable.[cite:1]
- `F7` transform the active record such as document conversion.[cite:1]
- `F8` duplicate the current record.[cite:1]
- `F9` execute the current primary contextual process.[cite:1]
- `F10` save and close.[cite:1]
- `?` show the shortcut cheat sheet.[cite:1]
- `Esc` perform contextual close or back behavior.[cite:1][cite:2]

Grid navigation must consistently support arrow up, arrow down, Home, End, Enter, and predictable selection behavior. Forms must consistently support Tab, Shift+Tab, field-level lookup invocation, and non-destructive Escape behavior.[cite:1]

### Enforcement

Keyboard-first design must be enforced through product governance:

- Standard components are incomplete unless their keyboard contract is implemented.[cite:1]
- Shortcut help is generated from the command registry.[cite:1]
- Commands must be visible through ActionBar labels where appropriate.[cite:1]
- End-to-end tests must cover keyboard flows, not only pointer flows.[cite:2][cite:3]

## Inline Designer scope

The Inline Designer remains a design-time customization tool within the allowed metadata model. It may control layout groups, tabs, sections, visibility, ordering, labels, help texts, placeholders, readonly hints, and other presentation behavior, but it may not control row-level security, tenant isolation, posting logic, ledger generation, inventory derivation, or system authorization boundaries.[cite:2][cite:1]

InlineDesigner invocation should integrate with the command system and focus system rather than acting as an isolated feature. It should operate on effective layout, effective field configuration, effective settings, and effective rules resolved from Base Tenant plus organization and tenant overrides.[cite:2][cite:1]

## Validation model

Validation is centralized and metadata-driven. It must apply consistently across forms, imports, commands, and assistant-driven writes through the same effective field definitions and issue envelope.[cite:2][cite:1]

Validation remains layered:

- Client-side guidance for usability.[cite:2]
- Domain-layer authoritative validation for save, patch, upsert, import commit, and command execution.[cite:2]
- Database enforcement for hard integrity, status, foreign keys, tenant isolation, and other non-negotiable rules.[cite:2][cite:1]

Requiredness should be lifecycle-aware rather than represented by a single boolean, so that draft editing, save, import, and posting can have different requirements.[cite:2]

## Posting and derived data

Posting logic does not belong in the frontend. Posting, inventory derivation, journal generation, and fact-table generation remain controlled domain processes separated from ordinary CRUD.[cite:2][cite:1]

Derived tables such as inventory balances, inventory movements, journal entries, and sales facts must never become unrestricted CRUD surfaces. The frontend may initiate commands and display outcomes, but it must not own posting logic.[cite:1][cite:2]

## Initial deliverables

The first implementation phase should stabilize at least the following runtime contracts and surfaces:

- Effective fields, layouts, rules, validations, calculations, lookups, and commands.[cite:2][cite:1]
- Generic list and entity views for Addresses, Articles, and Documents.[cite:1][cite:2]
- TriView workspaces for the three core business modules.[cite:1]
- Command registry and focus manager.[cite:1]
- Keyboard-first ActionBar and shortcut cheat sheet.[cite:1]
- DocumentEditor with command-driven save, transform, and posting handoff.[cite:1][cite:2]
- StatisticsModule invoked from current context.[cite:1]

## Implementation Alignment & As-Built Notes

This section records implementation choices and drifts that differ from the idealized architectural vision while maintaining core invariants.

- **Service Location:** Business logic (posting, conversion, storno) is consolidated in database-backed services within `@repo/db/src/services/` rather than a separate domain package.
- **API Strategy:** The platform utilizes REST-style API route handlers in `apps/web/src/routes/api/` for mutations and specialized data needs, complementing TanStack Start server functions.
- **Derived Data:** Materialized Views (MVs) are the primary engine for statistics and complex aggregations, refreshed via service-level triggers and `pg_notify`.
- **Specialized UI:** High-ergonomy modules like `SettingsView` may use custom layouts while adhering to platform-wide command, focus, and metadata contracts.
