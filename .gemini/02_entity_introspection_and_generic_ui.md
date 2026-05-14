# Entity Introspection and Standard Component Specification

## Purpose

This document defines how the platform derives generic user interfaces from schema, foreign keys, helper registries, annotations, and effective metadata, and how the standard component family consumes those contracts in a consistent, keyboard-first way.[cite:1][cite:2]

## Introspection position

The platform should not rely on handwritten per-screen field maintenance for the majority of business-facing UI. Generic reads, masks, grids, lookups, validation hints, and contextual component behavior should be derived from schema structure, foreign keys, annotations, helper registries, and effective metadata.[cite:2][cite:1]

This is consistent with the architecture rule that frontend, backend, imports, and assistant flows must consume only effective metadata views and controlled registries rather than raw tables or ad hoc UI definitions.[cite:2][cite:1]

## Sources of entity knowledge

The runtime entity definition should be built from the following sources:

- Physical schema information such as columns, types, nullability, primary keys, foreign keys, and indexes.[cite:1]
- Schema annotations for business names, descriptions, data classes, and module assignment.[cite:1]
- Helper table registries for display columns, code columns, value columns, sorting, and default filters.[cite:1]
- Entity command registrations for available commands and action metadata.[cite:1]
- Tenant field, group, layout, and rule metadata resolved into effective views.[cite:1][cite:2]

The result should be an effective entity definition that can drive DataGrid, EntityMask, LookupTable, NavigationTree, StatisticsModule, and TriViewWorkspace without hand-curating each screen.[cite:2][cite:1]

## Effective entity definition

Each effective entity definition should be able to provide:

- Entity identity and module placement.[cite:1][cite:2]
- Field list and field order.[cite:1]
- Data type, storage kind, and editability.[cite:2][cite:1]
- Labels and help texts in German and English.[cite:1][cite:2]
- Visibility, readonly behavior, requiredness, and lifecycle-aware requirement stages.[cite:2]
- Foreign-key lookup behavior and lookup table contracts.[cite:1][cite:2]
- Default values and declarative calculation hints.[cite:2]
- Grid column defaults, sorting, filtering, and search hints.[cite:1]
- Layout grouping, tabs, sections, and panel composition hints.[cite:1][cite:2]
- Command availability and contextual action metadata.[cite:1][cite:2]

## Foreign-key and lookup behavior

Foreign-key fields should default to a lookup-capable component rather than plain text entry. The runtime should inspect the foreign key target and helper table registry to determine display value, code value, sorting, filtering, and tenant scoping behavior.[cite:1][cite:2]

The standard behavior is:

- Inline dropdown for small result sets where allowed.[cite:1]
- Lookup dialog or lookup table for larger or filterable result sets.[cite:1][cite:2]
- `F5` opens the full lookup table for the active lookup-capable field.[cite:1]
- Lookup selection updates the current form state through standardized field contracts rather than field-specific wiring.[cite:1]

## UUID suppression and display strategy

Raw UUIDs should generally not be displayed as business-facing values except in technical administration contexts. The introspection system should prefer business codes, display columns, names, number fields, or composed labels based on helper registry and annotation information.[cite:1][cite:2]

Primary keys remain technically important but should usually be hidden in default grids, masks, trees, and lookup views unless explicitly requested by technical contexts or designer configuration.[cite:1]

## Standard component family

### DataGrid

DataGrid is the default list interpretation component for business-facing entities and large datasets. It should derive default columns, hidden technical fields, sorting, filtering, display formatting, and keyboard row navigation from the effective entity definition.[cite:2][cite:1]

Required behavior includes row-focus navigation, predictable selection semantics, metadata-driven visible columns, and integration with the platform command and focus system.[cite:1][cite:2]

### EntityMask

EntityMask is the generic detail and CRUD mask. It renders fields from effective metadata, applies lifecycle-aware requiredness, shows structured validation issues, integrates lookup behavior, and supports Inline Designer overlays within allowed scope.[cite:2][cite:1]

EntityMask must not contain handwritten per-entity validation rules as a default approach. It consumes effective field definitions, effective validations, and normalized issue envelopes.[cite:2]

### Dropdown and LookupTable

Dropdown and LookupTable together form the standard foreign-key selection pattern. Their behavior should derive from foreign keys, helper table registries, display columns, filters, tenant scoping, and effective lookup metadata.[cite:1][cite:2]

LookupTable must support keyboard-first navigation, selection, filtering, and Escape handling under the platform-wide focus system.[cite:1]

### NavigationTree

NavigationTree is the standard hierarchical context component used for category, group, and type-based filtering. It is appropriate for structures such as address categories, article groups, and document types or document groups.[cite:1][cite:2]

NavigationTree should not own business data mutation logic. Its role is contextual filtering, navigation intent emission, and focus-aware selection.[cite:2]

### TriViewWorkspace

TriViewWorkspace is the standard three-region module workspace. It composes NavigationTree, DataGrid, and a dependent context area into one coordinated keyboard-first surface.[cite:1][cite:2]

Standard module mappings are:

- Articles: article group tree, article grid, warehouse or stock context.[cite:1]
- Addresses: address category tree, address grid, contacts, delivery addresses, or related documents.[cite:1]
- Documents: document type or document group tree, document grid, document lines.[cite:1]

### StatisticsModule

StatisticsModule is a read-only context tool that resolves its dataset from the active entity and record context. It should open through the shared command model, typically through `Alt+I`, and show only approved statistic definitions for the current context.[cite:1][cite:2]

It must not become a backdoor to unrestricted table browsing or derived data mutation.[cite:2]

### DocumentEditor

DocumentEditor is the specialized transactional editor for documents. It should present a compact document header above a dedicated line editor while still reusing lookup behavior, validation contracts, command handling, issue handling, and focus management from the platform core.[cite:1][cite:2]

Document browsing in TriView and document editing in DocumentEditor should remain separate concerns.[cite:1]

### ActionBar

ActionBar is the visible execution surface for commands in the current context. It should display command labels, enablement state, shortcut hints, and contextual availability derived from the command registry and active focus context.[cite:1]

### InspectorPanel

InspectorPanel is a compact dependent-context panel used for secondary record information, read-mostly detail, or subordinate operational context. It is especially useful in the lower-right region of TriView workspaces.[cite:1]

### ContextTabs

ContextTabs are the standard switcher for sibling dependent contexts such as contacts, delivery addresses, related documents, statistics, or audit information. Their availability should derive from the active entity context and effective component configuration.[cite:1]

### StatusBar

StatusBar provides lightweight orientation information such as active tenant, company, module, current record, and relevant state indicators. It should help reinforce context and keyboard-first usability in a dense business application.[cite:1]

## Platform-wide command and focus integration

All standard components must integrate with the same platform-wide command and focus system. This includes:

- Registration of supported commands.[cite:1]
- Participation in active focus resolution.[cite:1]
- Predictable keyboard behavior.[cite:1]
- Visibility and enablement driven by active context.[cite:1]
- Context-sensitive Escape handling.[cite:1][cite:2]

A component that does not participate in this contract is not considered compliant with the platform standard component model.[cite:1]

## Validation and issue handling

All standard components that allow editing must consume the normalized validation issue envelope. Structured issues must be mappable back to fields, rows, or panels without requiring custom error plumbing per entity.[cite:2]

The UI should be able to focus the first blocking issue, visually mark invalid controls, and preserve consistent error semantics across forms, imports, and command execution responses.[cite:2]

## Designer and extensibility boundaries

The Inline Designer may customize layout, labels, ordering, visibility, tabs, grouping, and other allowed presentation concerns, but it may not redefine security, tenant isolation, posting rules, or derived-data semantics.[cite:2][cite:1]

Tenant-defined extensibility should therefore change interpretation and presentation, not fundamental invariants.[cite:2]

## Implementation direction

The implementation should provide a runtime entity introspection pipeline that produces effective entity definitions from schema, annotations, helper registries, command metadata, and effective tenant metadata. Standard components then consume these definitions consistently rather than duplicating entity-specific wiring.[cite:1][cite:2]

This keeps the product generic-first, keyboard-first, metadata-driven, and aligned with the database-centered architecture.[cite:2][cite:1]
