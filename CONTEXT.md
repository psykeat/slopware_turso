# slopware Context

slopware is a metadata-driven, multi-tenant business platform. This glossary defines the project’s shared domain language so UI, services, docs, and review sessions use the same terms.

## Business Domain

**Module**:
A business-facing area of the product with its own records, commands, and workspace pattern.
_Avoid_: Screen, page, route

**Address**:
A tenant-owned business record for a person or organization location/contact identity.
_Avoid_: Customer, account, client

**Article**:
A tenant-owned item or product record used in the core business modules.
_Avoid_: Product, SKU, item unless the context specifically means that

**Article variant**:
The sellable SKU-level form of an article, used when price, stock, and document lines need variant-level truth.
_Avoid_: Variant, SKU, child article unless the article context is explicit

**Document**:
A transactional business record that is browsed in TriView and edited in DocumentEditor.
_Avoid_: Order, invoice, voucher unless a document type is being named specifically

**Document line**:
An item row belonging to a document, usually representing quantities, prices, or related business details.
_Avoid_: Line item, row if the document context is unclear

**Master data**:
Stable reference data such as addresses, articles, companies, and helper tables.
_Avoid_: Static data, config data when the business meaning is more specific

**Transaction draft**:
A document or other business record that is still editable before posting or finalization.
_Avoid_: Draft, unsaved record when the lifecycle meaning matters

**Posted transaction**:
A finalized transaction that no longer behaves like unrestricted CRUD data.
_Avoid_: Closed record, committed record when the posting meaning matters

**Derived data**:
Read-only data produced from business records, such as balances, movements, facts, or ledger projections.
_Avoid_: Cached data, generated data unless the context is explicitly about derivation

**Ledger**:
The derived movement history or balance view used to explain stock or financial changes over time.
_Avoid_: Journal, history unless the balance/movement context is explicit

**Fact**:
A derived reporting event or aggregate used for analytics and reporting.
_Avoid_: Event, statistic unless the derived reporting meaning is intended

**Archive**:
The lifecycle action used instead of hard delete for business master data.
_Avoid_: Delete, remove

## Organization Model

**Tenant**:
The isolation boundary for operational business data and tenant-specific metadata.
_Avoid_: Workspace, account, customer

**Organization**:
The higher-level business grouping that can sit above one or more tenants.
_Avoid_: Company, tenant

**Company**:
The company record shown in the product’s master-data and settings areas.
_Avoid_: Organization, tenant unless the UI specifically refers to the company record

**Base Tenant**:
The reserved tenant used for global metadata only.
_Avoid_: Default tenant, system tenant

**Tenant-scoped**:
Limited to one tenant and protected by server-side tenant resolution.
_Avoid_: User-scoped, global

## Metadata and Introspection

**Effective metadata**:
The merged, consumable metadata view used by UI, imports, and assistant flows.
_Avoid_: Raw metadata, schema tables

**Effective entity definition**:
The resolved entity contract that drives grids, masks, lookups, navigation, and contextual panels.
_Avoid_: Table definition, model class

**Helper table**:
A supporting table that provides display values, code values, sorting, filtering, or lookup behavior.
_Avoid_: Lookup table when the support role is the point rather than selection UI

**Lookup metadata**:
The resolved lookup contract for foreign-key selection and display behavior.
_Avoid_: Foreign key metadata, picker config

**Lifecycle-aware requiredness**:
Requiredness that changes by state, such as draft, save, import, or posting.
_Avoid_: Required flag, hard required unless the rule is truly unconditional

**Inventory item**:
The operative stock anchor for a sellable article variant.
_Avoid_: Stock record, inventory row unless the booking-anchor meaning matters

**Inventory level**:
The projected quantity for an inventory item at a specific warehouse or channel.
_Avoid_: Stock balance, availability row unless the projection meaning matters

**Price list item**:
The price rule row that defines how a sellable record is priced.
_Avoid_: Price row, tariff row unless the pricing-rule meaning matters

## Workspace and UI

**DataGrid**:
The standard list interpretation component for business entities and large datasets.
_Avoid_: Table, list view unless the standard component is meant

**EntityMask**:
The standard detail and CRUD mask for generic create, patch, and archive flows.
_Avoid_: Form, editor unless the generic component contract is meant

**TriViewWorkspace**:
The standard three-region workspace with a navigation tree, primary grid, and dependent context area.
_Avoid_: Split view, master-detail unless the specific TriView pattern is meant

**DocumentEditor**:
The focused transactional editor for document entry and line editing.
_Avoid_: Document form, invoice form unless the dedicated editor is meant

**NavigationTree**:
The hierarchical navigation component for categories, groups, and type-based filtering.
_Avoid_: Sidebar tree, folder tree unless the component contract is meant

**LookupTable**:
The keyboard-first selection surface for choosing referenced records.
_Avoid_: Picker, chooser, selector when the lookup contract is intended

**Dropdown**:
The inline foreign-key selection pattern used for smaller lookup sets.
_Avoid_: Select menu, combobox unless the lookup pattern is intended

**InspectorPanel**:
A compact dependent-context panel for secondary details or subordinate record context.
_Avoid_: Side panel, details pane unless the standard component is intended

**ContextTabs**:
The sibling-context switcher for related views such as contacts, delivery addresses, or audit information.
_Avoid_: Tab bar, sub-tabs when the dependent-context meaning matters

**ActionBar**:
The visible command surface that shows available actions, labels, and shortcut hints.
_Avoid_: Toolbar, command strip unless the platform component is intended

**StatusBar**:
The bottom bar that shows tenant, module, record, and connection state.
_Avoid_: Footer, status line unless the product context is meant

**StatisticsModule**:
A read-only context module for metrics and context-sensitive KPIs.
_Avoid_: Dashboard, analytics panel unless the shared module contract is meant

**Inline Designer**:
The metadata-driven design-time customization surface for layout and presentation.
_Avoid_: Page builder, form designer when the product-specific contract is meant

**Focus context**:
The active workspace, panel, entity, record, field, row, and mode that determine command resolution.
_Avoid_: UI state, selection state unless the command system is specifically involved

**Command**:
A registered action with scope, label, enablement, shortcut metadata, and context rules.
_Avoid_: Button click, handler when the platform contract matters

## Keyboard and Behavior

**Keyboard-first**:
The product behavior model where commands, navigation, and editing are designed around keyboard use first.
_Avoid_: Keyboard-friendly

**Command registry**:
The shared registry that defines available commands and their metadata.
_Avoid_: Shortcut map, action list unless the registry contract is intended

**Shortcut cheat sheet**:
The generated reference for keyboard bindings and command availability.
_Avoid_: Help overlay, shortcut list unless the generated sheet is meant

**Escape resolution**:
The deterministic priority order used to close overlays, dialogs, editors, and panels.
_Avoid_: Escape handling, cancel behavior unless the priority contract is intended

## AI Workflow

**AI overlay**:
The shared temporary overlay host for AI-assisted flows.
_Avoid_: AI sidebar, assistant panel, permanent drawer

**Review**:
The inspection step in an AI-assisted flow where proposed changes or interpretations are checked.
_Avoid_: Approval, validation unless the AI workflow is being discussed

**Resolve**:
The step where ambiguous input is mapped onto concrete project language or data.
_Avoid_: Parse, infer unless the assistant workflow is being discussed

**Validate**:
The step where proposed changes are checked against rules and metadata.
_Avoid_: Verify, lint unless the AI workflow is being discussed

**Apply**:
The step where an approved AI-assisted result is committed into the system.
_Avoid_: Save, execute unless the AI workflow is being discussed

## Identifiers and Labels

**Business code**:
A human-readable code used instead of a raw UUID in normal business-facing UI.
_Avoid_: ID, primary key unless the technical meaning matters

**Record number**:
The visible number or code used to identify a business record.
_Avoid_: UUID, database ID unless technical identification is intended

**Lookup value**:
The displayable value chosen for a referenced record in a lookup flow.
_Avoid_: Raw key, foreign key value
