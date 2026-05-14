# Core Architecture Specification

## Purpose

This document defines the non-negotiable architecture rules of the platform. It establishes a metadata-driven, database-centered, split-panel-capable, multi-tenant business platform with a modern application layer while preserving a deliberately authoritative relational core.[cite:1][cite:2]

## Core position

The platform is not a frontend-first CRUD application. PostgreSQL, constraints, row-level security, effective metadata resolution, and controlled domain commands remain the source of truth for operational data, metadata, import staging, and derived data.[cite:1][cite:2]

TanStack Start is the application runtime for routing, SSR, middleware, loaders, server functions, and workspace composition, but it does not replace database invariants, tenant isolation, or effective metadata resolvers.[cite:2][cite:3]

## Foundational invariants

- PostgreSQL is the authoritative persistence layer for operational data, metadata, import staging data, and derived data.[cite:2]
- Every tenant-scoped table must be protected by row-level security and tenant-aware access patterns.[cite:1][cite:2]
- Framework logic never replaces database invariants.[cite:2]
- Frontend, backend, imports, and assistant flows consume only effective metadata views, not raw metadata tables.[cite:1][cite:2]
- Mutations occur only through validated create, patch, upsert paths or explicit domain commands.[cite:1][cite:2]
- Posting and derived-data generation remain controlled domain concerns and must never degrade into unrestricted CRUD behavior.[cite:1][cite:2]
- Hard delete is forbidden for business master data; archive or deactivate semantics must be used instead.[cite:2]

## Layer model

### Database layer

The database layer contains tables, foreign keys, constraints, row-level security, indexes, effective views, and where necessary trigger or function-based enforcement for hard invariants.[cite:2] Cross-tenant references must be technically prevented through tenant-safe key design where appropriate.[cite:2]

### Domain layer

The domain layer is the primary server-side application core. It contains read services, command services, entity registries, lookup services, effective metadata resolvers, posting orchestration, and assistant-safe mutation paths.[cite:2]

### App layer

The application layer contains routes, layouts, SSR, middleware, loaders, pending and error UI, workspace orchestration, and generic business interface composition.[cite:2][cite:3] It renders and coordinates, but it must not become the home of business invariants, posting logic, or tenant authorization truth.[cite:2]

## Multi-tenancy

Multi-tenancy is mandatory and hard-enforced at database and server layers. Tenant context must always be resolved server-side from session, membership, and authorization state, and must never be trusted from arbitrary client payload, panel state, or query input except in explicitly protected administrative flows.[cite:1][cite:2]

The Base Tenant is reserved for global metadata only and must never contain operational tenant data. Organization-level and tenant-level overrides are resolved into effective metadata views that the rest of the platform consumes.[cite:1][cite:2]

## Effective metadata

Effective metadata is the only valid consumable view for UI, orchestration, imports, and assistant-driven flows. The platform should expose effective contracts such as effective fields, layouts, rules, settings, lookups, validations, calculations, and commands, merged from Base Tenant, organization, and tenant scope by precedence.[cite:1][cite:2]

Tenant-defined extensions are allowed only inside the controlled extensibility model. They may influence presentation, validation, lookup behavior, defaulting, or declarative calculations, but they may not bypass security, redefine tenant isolation, or inject uncontrolled posting behavior.[cite:1][cite:2]

## Generic-first UI

The platform is generic-first. New business-facing surfaces must use standard panels and adapters before introducing custom views, because the architecture explicitly prefers list panels, detail panels, line panels, grids, and metadata-driven views over bespoke UI systems.[cite:2][cite:1]

Specialized panels are allowed only when they provide real ergonomic or business value beyond the generic path. The existence of a special module must never create a parallel UI architecture.[cite:2]

## Platform-wide command and focus system

A platform-wide command and focus system is mandatory. Keyboard behavior, command execution, contextual actions, and focus movement must not be implemented ad hoc inside individual screens or components, but must be resolved through a shared runtime contract aligned with workspaces, panels, intents, and commands.[cite:2][cite:1]

### Command model

Every keyboard shortcut, toolbar action, contextual menu action, and command button must resolve to a registered UI or domain command. Components must never interpret raw key combinations as direct business logic.[cite:2][cite:1]

The platform should distinguish three command scopes:

- Global commands, available almost everywhere, such as opening core modules or showing the shortcut help.[cite:2]
- Context commands, resolved from the active workspace, panel, entity, record, and mode.[cite:2][cite:1]
- Local navigation commands, resolved inside focused controls such as grids, forms, dialogs, lookup tables, and designers.[cite:1]

### Focus model

A central focus manager must track the active workspace, active panel, focus area, selected entity, selected record, current field, current row, and interaction mode. Command resolution must always depend on this active focus context rather than on isolated component state.[cite:2][cite:1]

Suggested focus areas include workspace, panel, grid, form, lookup, dialog, designer, and statistics overlay. This enables consistent contextual behavior for escape handling, lookup invocation, row navigation, save flows, and overlay management across the entire product.[cite:1][cite:2]

### Keyboard contract

The keyboard model should be standardized at platform level. Representative platform shortcuts include:

- `Alt+1` addresses module.[cite:1]
- `Alt+2` articles module.[cite:1]
- `Alt+3` documents module.[cite:1]
- `Alt+0` company master data and settings.[cite:1]
- `Alt+I` statistics module for the current context.[cite:1][cite:2]
- `F3` create new record in current context.[cite:1]
- `F4` delete or archive current record where allowed.[cite:1][cite:2]
- `F5` open lookup table for the active lookup-capable field.[cite:1]
- `F7` execute context transformation such as document conversion.[cite:1]
- `F8` duplicate current record.[cite:1]
- `F9` execute the current primary contextual operation.[cite:1]
- `F10` save and close.[cite:1]
- `?` open the shortcut cheat sheet.[cite:1]
- `Esc` resolve contextual close, back, or cancel behavior through priority-based focus handling.[cite:1][cite:2]

Arrow keys, Home, End, Enter, Tab, and Shift+Tab must behave consistently within grids, forms, trees, dialogs, and lookup tables under the same contract.[cite:1]

### Escape resolution

Escape handling must follow a deterministic platform order. It should first close the most local overlay or transient state, then back out of the current editing context, and only then close panels or move back in workspace navigation.[cite:2][cite:1]

A recommended priority is: shortcut overlay, lookup popup, dialog or drawer, inline edit helper, unsaved edit cancel confirmation, panel-level back action, workspace-level close or previous intent.[cite:1][cite:2]

### Enforcing consistency

Consistency must be enforced structurally:

- Every panel declares its supported commands.[cite:1]
- The global keymap maps key bindings to commands, not to panel-specific handlers.[cite:1]
- The active focus context determines which commands are enabled, visible, disabled, or unsupported.[cite:1]
- The shortcut cheat sheet is generated from the command registry rather than maintained manually.[cite:1]
- New UI primitives are not considered done until they implement their required keyboard contract.[cite:1][cite:2]

## Platform standard components

The platform must standardize a small, reusable component family that covers most business-facing work without introducing parallel UI paradigms.[cite:1][cite:2]

### Required standard components

- DataGrid for list-oriented entity interpretation and large datasets.[cite:1][cite:2]
- EntityMask for generic create, detail, patch, archive, and validation-driven form handling.[cite:1]
- Dropdown and LookupTable for foreign-key and helper-table selection.[cite:1][cite:2]
- NavigationTree for hierarchical filtering and navigation contexts such as address categories, article groups, document types, and document groups.[cite:1][cite:2]
- TriViewWorkspace for the standard three-region business layout.[cite:2][cite:1]
- StatisticsModule for context-sensitive read-only insights invoked from the active context.[cite:1][cite:2]
- DocumentEditor for document-centric editing with a focused header and a line editor.[cite:1][cite:2]
- ActionBar for visible command execution paired with the keyboard system.[cite:1]
- InspectorPanel for compact dependent, read-mostly, or mixed detail contexts.[cite:1]
- ContextTabs for switching between dependent subcontexts inside a panel or inspector area.[cite:1]
- StatusBar for current tenant, company, module, record, state, and context hints.[cite:1]

### Component governance

All standard components must participate in the same command system, focus system, i18n model, effective metadata model, and validation model. A component that does not integrate with these platform contracts is not a standard component.[cite:1][cite:2]

## TriView workspace pattern

TriView should be formalized as a standard workspace pattern rather than implemented independently inside each module. It consists of three coordinated regions: a navigation tree on the left, a primary grid on the upper right, and a secondary contextual panel on the lower right.[cite:2][cite:1]

Representative module mappings are:

- Articles: article group tree, article table, inventory or warehouse-related context for the selected article.[cite:1]
- Addresses: address category tree, address table, tabbed contact, delivery address, or document context for the selected address.[cite:1]
- Documents: document type or document group tree, document table, document line table for the selected document.[cite:1]

The TriView pattern must remain generic in runtime design even when its concrete entity mappings differ by module.[cite:1][cite:2]

## Documents and posting

Document browsing and document editing should be separated. TriView is well suited for document discovery, filtering, and context inspection, while focused document editing should happen in a dedicated DocumentEditor workspace with a lightweight header and line editor.[cite:1][cite:2]

Posting logic, status transitions, inventory effects, ledger generation, and fact generation remain controlled domain concerns and must not be moved into the frontend interaction model.[cite:1][cite:2]

## Priority of truth

In case of conflict, architecture priority should remain:

1. Core architecture specification.[cite:2]
2. Database schema, constraints, RLS policies, and effective views.[cite:1][cite:2]
3. Project foundation and derived platform specifications.[cite:1][cite:2]
4. Implementation patterns and UI artifacts.[cite:2][cite:3]
