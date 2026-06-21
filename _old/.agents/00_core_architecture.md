# Core Architecture Specification

## Purpose

This document defines the non-negotiable architecture rules of the platform. It establishes a metadata-driven, database-centered, split-panel-capable, multi-tenant business platform with a modern application layer while preserving a deliberately authoritative relational core.[cite:1][cite:2]

## Core position

The platform is not a frontend-first CRUD application. The tenant database, database constraints, effective metadata resolution, and controlled domain commands remain the source of truth for operational data, metadata, import staging, and derived data.[cite:1][cite:2]

TanStack Start is the application runtime for routing, SSR, middleware, loaders, server functions, and workspace composition, but it does not replace database invariants, tenant isolation, or effective metadata resolvers.[cite:2][cite:3]

## Persistence target

The target persistence architecture is Turso/libSQL with physical
database-per-tenant isolation. The current PostgreSQL/RLS implementation is a
compatibility adapter until the schema, migrations, and operational tooling are
ported. New domain-facing modules should avoid deepening PostgreSQL-specific
interfaces unless the task explicitly targets that adapter.

The Turso target requires a central configuration database for tenant routing
and global metadata, tenant databases in a Turso group, and a libSQL
`busy_timeout` of at least 5000 ms for concurrent write safety.

## Foundational invariants

- The authoritative persistence layer is the server-selected tenant database. In the Turso target, each tenant has a separate libSQL database; in the current PostgreSQL compatibility adapter, tenant-aware access patterns and RLS remain required.[cite:2]
- Every tenant-scoped persistence path must be protected server-side by physical database selection or, in the compatibility adapter, row-level security and tenant-aware access patterns.[cite:1][cite:2]
- Framework logic never replaces database invariants.[cite:2]
- Frontend, backend, imports, and assistant flows consume only effective metadata views, not raw metadata tables.[cite:1][cite:2]
- Mutations occur only through validated paths (REST-style route handlers or server functions) or explicit domain commands.[cite:1][cite:2] The architecture prioritizes authentication, validation, and controlled domain commands over specific transport implementations.
- Posting and derived-data generation remain controlled domain concerns and must never degrade into unrestricted CRUD behavior.[cite:1][cite:2]
- Hard delete is forbidden for business master data; archive or deactivate semantics must be used instead.[cite:2]

## Layer model

### Database layer

The database layer contains tables, foreign keys, constraints, row-level security, indexes, effective views, and where necessary trigger or function-based enforcement for hard invariants.[cite:2] Cross-tenant references must be technically prevented through tenant-safe key design where appropriate.[cite:2]

### Domain layer

The domain layer is the primary server-side application core. It contains read services, command services, entity registries, lookup services, effective metadata resolvers, posting orchestration, and assistant-safe mutation paths.[cite:2]

### App layer

The application layer contains routes, layouts, SSR, middleware, loaders, pending and error UI, workspace orchestration, and generic business interface composition.[cite:2][cite:3] It renders and coordinates, but it must not become the home of business invariants, posting logic, or tenant authorization truth.[cite:2]

### Maintenance Cost vs. Data Flow (Cognitive Map)

Although a request flows through up to 8 logical layers from UI to database, developers only actively maintain **1 to 2 layers** per entity. The remaining layers are generic or automated:

| #   | Layer                                                                                                                                             | Maintenance Type        | Responsibility                                                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Database Schema** ([app.schema.ts](file:///home/ubuntu/slopware/packages/db/src/schema/app.schema.ts))                                          | **Active** (Per-Entity) | Table structure, constraints, RLS policies.                                                                                                                                                                                                                                                 |
| 2   | **Data Service** ([data.ts](file:///home/ubuntu/slopware/packages/db/src/services/data.ts))                                                       | **Generic** (Zero)      | Shared tenant-scoped query generation, RLS injection.                                                                                                                                                                                                                                       |
| 3   | **Capability Definition** (e.g. [masterdata.article.ts](file:///home/ubuntu/slopware/packages/db/src/capabilities/modules/masterdata.article.ts)) | **Active / Factory**    | Inputs/outputs, roles, LLM exposure. Factory-generated for simple CRUD (see the `crud` helper in [masterdata.remaining.ts](file:///home/ubuntu/slopware/packages/db/src/capabilities/modules/masterdata.remaining.ts)); customized only for complex business domain logic (e.g. `article`). |
| 4   | **Generated Manifest** (`manifest.generated.ts`)                                                                                                  | **Automated** (Zero)    | Project-wide capabilities registry compiled via CLI.                                                                                                                                                                                                                                        |
| 5   | **HTTP-Router** ([execute.ts](file:///home/ubuntu/slopware/apps/web/src/routes/api/capabilities/$key/execute.ts))                                 | **Generic** (Zero)      | Standard catch-all REST gateway (`/api/capabilities/*`).                                                                                                                                                                                                                                    |
| 6   | **Client-side Transport** ([entity-ops.ts](file:///home/ubuntu/slopware/packages/db/src/capabilities/entity-ops.ts))                              | **Generic** (Zero)      | Maps standard CRUD intents (List, Save, Delete) to capabilities.                                                                                                                                                                                                                            |
| 7   | **Generic UI** (`DataGrid` / `EntityMask`)                                                                                                        | **Generic** (Zero)      | Renders dynamically from schema metadata.                                                                                                                                                                                                                                                   |

- **For Simple CRUD Entities (e.g. Warehouse):** Only **1.05 layers** (Drizzle schema + 1 line in `masterdata.remaining.ts` calling the `crud()` factory).
- **For Complex Domain Entities (e.g. Article):** Only **2 layers** (Drizzle schema + custom capability file for validation/conflict/side-effect logic).

## Multi-tenancy

Multi-tenancy is mandatory and hard-enforced at database and server layers. Tenant context must always be resolved server-side from session, membership, and authorization state, and must never be trusted from arbitrary client payload, panel state, or query input except in explicitly protected administrative flows.[cite:1][cite:2]

The target isolation model is physical database-per-tenant selection through the
server-side tenant routing registry. Shared-table tenant IDs remain a
compatibility concern for the existing PostgreSQL adapter and must not leak into
client-provided capability input.

The Base Tenant is reserved for global metadata only and must never contain operational tenant data. Organization-level and tenant-level overrides are resolved into effective metadata views that the rest of the platform consumes.[cite:1][cite:2]

## Effective metadata

Effective metadata is the only valid consumable view for UI, orchestration, imports, and assistant-driven flows. The platform should expose effective contracts such as effective fields, layouts, rules, settings, lookups, validations, calculations, and commands, merged from Base Tenant, organization, and tenant scope by precedence.[cite:1][cite:2]

Tenant-defined extensions are allowed only inside the controlled extensibility model. They may influence presentation, validation, lookup behavior, defaulting, or declarative calculations, but they may not bypass security, redefine tenant isolation, or inject uncontrolled posting behavior.[cite:1][cite:2]

## Generic-first UI

The platform is generic-first. Standard panels and metadata-driven views are preferred over bespoke screens; specialized panels are allowed only when they solve a documented ergonomic or business need. The canonical generic entity contract is defined in the foundation and introspection specifications.[cite:2][cite:1]

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

## AI overlay standard

AI-assisted workflows must use a shared overlay host that behaves like the rest of the platform's transient UI. The host is context-bound, zero-footprint by default, and opened only through registered commands in `CommandProvider`; it must close through the same escape and focus rules as other overlays.[cite:1][cite:2]

AI surfaces are module-scoped by context, not by separate layout reservations or bespoke sidebars. Modules may vary their review and apply content, but they must reuse the shared overlay runtime and may not introduce local AI-only shell regions, permanent inspector columns, or ad hoc keyboard handlers.[cite:1][cite:2]

### Enforcing consistency

Consistency must be enforced structurally:

- Every panel declares its supported commands.[cite:1]
- The global keymap maps key bindings to commands, not to panel-specific handlers.[cite:1]
- The active focus context determines which commands are enabled, visible, disabled, or unsupported.[cite:1]
- The shortcut cheat sheet is generated from the command registry rather than maintained manually.[cite:1]
- New UI primitives are not considered done until they implement their required keyboard contract.[cite:1][cite:2]

## Platform standard components

The platform standardizes a small reusable component family for lists, forms, lookups, hierarchies, workspaces, commands, and status display. The canonical component contract is defined in the foundation and introspection specifications.[cite:1][cite:2]

### Component governance

All standard components must participate in the same command system, focus system, i18n model, effective metadata model, and validation model. A component that does not integrate with these platform contracts is not a standard component.[cite:1][cite:2]

Localized labels, helper texts, and command names are part of the effective UI contract. Static shell chrome may use locale resources, while entity-facing labels should primarily resolve from effective metadata.

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

### Canonical document types

The `document_type` / movement-type vocabulary is part of the core schema, not a UI convenience. These types are the canonical business grammar for the document module, posting engine, inventory derivation, financial facts, and audit chain. They must remain explicitly documented here and in the schema because they define the behavior of the entire document lifecycle.[cite:1][cite:2]

| Type | Label              | Direction  | Inventory effect                          | Reservation effect      | Finance effect         |
| ---- | ------------------ | ---------- | ----------------------------------------- | ----------------------- | ---------------------- |
| `N`  | Angebot            | Outbound   | None                                      | None                    | None                   |
| `A`  | Auftrag            | Outbound   | None                                      | `reserved +`            | None                   |
| `L`  | Lieferschein       | Outbound   | `on_hand -`                               | `reserved -` from `A`   | Sales fact             |
| `R`  | Rechnung           | Outbound   | None if `L` exists, otherwise `on_hand -` | None                    | Revenue, AR, tax, COGS |
| `G`  | Gutschrift         | Outbound   | `on_hand +`                               | None                    | Revenue -, AR -        |
| `b`  | Bestellung         | Inbound    | None                                      | None                    | None                   |
| `l`  | Wareneingang       | Inbound    | `on_hand +`                               | `expected -` from `b`   | Purchase fact          |
| `r`  | Eingangsrechnung   | Inbound    | None if `l` exists, otherwise `on_hand +` | None                    | Cost, AP, AVCO         |
| `g`  | Eingangsgutschrift | Inbound    | `on_hand -`                               | None                    | Cost -, AP -           |
| `V`  | Inventur           | Adjustment | Absolute set                              | None                    | Stock correction fact  |
| `U`  | Umbuchung          | Adjustment | `wh_a -`, `wh_b +`                        | None                    | None                   |
| `Z`  | Zugang             | Inbound    | `on_hand +`                               | None                    | Valuation fact         |
| `E`  | Entnahme           | Outbound   | `on_hand -`                               | None                    | Valuation fact         |
| `p`  | Fertigungsauftrag  | Outbound   | None                                      | Component reservation + | None                   |
| `q`  | Fertigmeldung      | Inbound    | Product `+`, components `-`               | Component reservation - | Production fact        |

### Audit and chain rules

- `transactionId` is the chain key for audit navigation across conversions and storno. It is copied through conversion and reversal chains, not regenerated for those operations.[cite:1][cite:2]
- `parentDocumentId` tracks the immediate predecessor document.
- `stornoDocumentId` links a posted invoice to its reversing document.
- Conversion and storno must preserve the audit chain even when a new `documentId` or `documentNo` is created.[cite:1][cite:2]
- Posting must continue to treat type-specific inventory and finance effects as domain logic, not as frontend state derivation.[cite:1][cite:2]

## Priority of truth

In case of conflict, architecture priority should remain:

1. Core architecture specification.[cite:2]
2. Database schema, constraints, RLS policies, and effective views.[cite:1][cite:2]
3. Project foundation and derived platform specifications.[cite:1][cite:2]
4. Implementation patterns and UI artifacts.[cite:2][cite:3]
