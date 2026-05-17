# Frontend Base Design Specification

## Vision

The frontend is implemented as a generic, metadata-driven business application shell whose primary business focus is deliberately constrained to the three core modules **Addresses**, **Articles**, and **Documents**.[cite:1][cite:3] This follows the platform rule that the main application should remain intentionally narrow and that additional business tables should not automatically become their own top-level modules.[cite:1]

The visual language is based on `design.md`: a dark app shell, light work surfaces, indigo as the primary color, compact pill-shaped actions, tabular figures for numeric values, and a dense B2B-appropriate UI rhythm.[cite:2] The result should feel operational and precise rather than decorative.[cite:2]

## UI Architecture Principles

The UI must rely on the standard platform component family: **TriViewWorkspace**, **DataGrid**, **EntityMask**, **NavigationTree**, **DocumentEditor**, **ActionBar**, **ContextTabs**, **InspectorPanel**, and **StatusBar**.[cite:1][cite:3] New business-facing surfaces should use these shared building blocks before introducing custom views.[cite:1][cite:3]

For the three core modules, the default workspace pattern is TriView: a left navigation tree, a primary grid in the upper-right region, and a dependent context area in the lower-right region.[cite:1][cite:3] For transactional document editing, the frontend must use a separate DocumentEditor because document browsing and document editing are intentionally distinct modes.[cite:1][cite:3]

The interface must be keyboard-first and must route actions through the shared command and focus system rather than ad hoc handlers.[cite:1][cite:4] Representative global shortcuts include `Alt+1` for Addresses, `Alt+2` for Articles, `Alt+3` for Documents, and `Alt+0` for Company Master Data and Settings.[cite:1][cite:4]

## App Shell

The application shell consists of three permanent zones.

1. A left sidebar for primary navigation and context switching.[cite:2][cite:3]
2. A top context bar for title, breadcrumbs, global actions, language switching, and user context.[cite:3][cite:4]
3. A central workspace for TriView, entity pages, editor views, and configuration forms.[cite:1][cite:3]

A StatusBar is recommended at the bottom of the shell to keep the active tenant, company, module, record context, and state information visible.[cite:3]

## Navigation Model

Navigation is intentionally split into business, tenant, and system-administrative areas. This separation follows the specification that the main application should remain focused on the core business modules while extra tables and configuration objects belong in Settings or Company Master Data.[cite:1]

### Main Navigation

The main navigation is always visible for users who have the necessary business permissions.

- Addresses.[cite:1][cite:3]
- Articles.[cite:1][cite:3]
- Documents.[cite:1][cite:3]

These three entries form the operational center of the application.[cite:1]

### Settings Menu

The Settings menu groups all tenant-specific helper tables and all business configuration that does not belong to global system administration.[cite:1][cite:4] It is part of the normal business shell, but it should only be shown to users who are authorized in the active tenant.[cite:4]

Recommended structure:

- Helper tables and lookup support.[cite:1]
- Lookup configuration.[cite:3][cite:4]
- Number ranges, defaults, and rules within the allowed scope.[cite:4]
- Layout and mask overrides at tenant level.[cite:4]
- Other tenant-specific master data configuration.[cite:1]

Settings must only contain allowed metadata and presentation adjustments. They must not control security, tenant isolation, posting logic, or derived data.[cite:4][cite:3]

### Admin Menu

The Admin menu is visible and accessible only when `app_user.is_system_admin = true`.[cite:4] It contains the system-level administration screens for:

- User.
- Organization.
- Tenant.
- Company.

These objects belong in a clearly separated administrative layer because they affect organization-wide or cross-tenant concerns and should not be mixed with normal work modules.[cite:4]

### Base Tenant Area

The Base Tenant is not a normal work tenant but a protected configuration area for global base definitions.[cite:4] According to the architecture, the Base Tenant is reserved exclusively for global metadata and must not contain operational tenant-specific movement data or master data.[cite:4]

The Base Tenant area is therefore:

- visible only to `is_system_admin`.[cite:4]
- clearly marked as a special mode in the UI.[cite:4]
- accessed separately from normal tenant operations.[cite:4]
- used only for global base configuration.[cite:4]

Recommended content:

- global fields, layouts, rules, and defaults.[cite:4]
- global lookups and the effective metadata base.[cite:4]
- global commands and presentation definitions within the allowed model.[cite:4]

## Tenant Switcher

The Tenant Switcher should be placed prominently in the upper part of the sidebar, directly below the logo or product identity.[cite:3] It is a central orientation element because tenant and company are part of the application context and should also be visible in the StatusBar.[cite:3]

Requirements:

- Show `Organization > Tenant` and, when relevant, additional company context.[cite:3][cite:4]
- Normal users should see only their assigned operational tenants.[cite:4]
- System administrators should additionally see a separate entry for the **Base Tenant**.[cite:4]
- When the tenant changes, navigation, effective metadata, lookups, layouts, and configuration context must be fully reloaded because only effective views may be consumed.[cite:4][cite:3]

The Base Tenant should not appear as an ordinary tenant in the switcher. It should be clearly marked as a special configuration context, for example with the label “Base Tenant / global configuration”.[cite:4]

## Language Switcher

The interface must include a **Language Switcher**. This is necessary because the specification expects German and English labels and texts in standard components and effective metadata.[cite:1][cite:3]

### Placement

The Language Switcher should be placed in the **top context bar on the right side**, near the user menu. It can also be mirrored in the user menu, but the primary access point should be directly visible in the shell so language changes remain fast and discoverable.[cite:3]

### Behavior

- Support at least **DE** and **EN**.[cite:1][cite:3]
- The active language affects navigation labels, field labels, help texts, group titles, tabs, command labels, and designer metadata.[cite:1][cite:3]
- Language switching is a UI and metadata-context change only; it does not change permissions or data access.[cite:3][cite:4]
- The last selected language should be stored as a user preference in **User Config**, not as a tenant-wide setting.[cite:3]

### UI Form

A compact switcher with a globe icon and language code (`DE`, `EN`) or a segmented control in the design language is recommended.[cite:2] The switcher must be reachable through keyboard interaction and integrated into the global command and focus model.[cite:1][cite:4]

## User Menu and User Config

The User Menu should be placed at the bottom of the sidebar or alternatively in the top context bar. It must be separate from Settings because it contains personal preferences, not tenant-wide configuration.[cite:3]

User Config should include at least:

- Language and preferred language.[cite:1][cite:3]
- Theme: light, dark, or system, matching the shell/work-surface split from `design.md`.[cite:2]
- UI density, compact versus comfortable.
- Preferred start module.
- Personal default tenant or last active tenant.
- Personal grid and list preferences within the allowed scope.
- Shortcut help and personal productivity preferences.

## Frontend Access Model

Visibility in the navigation is not enough. The specification explicitly separates UI guarding from actual server-side authorization.[cite:5] Therefore, access must be implemented in three layers:

1. Navigation visibility: menu items are shown only when the role and permissions allow them.[cite:4][cite:5]
2. Route protection: sensitive areas such as `/admin/*` and `/base-tenant/*` are protected through route guards.[cite:5]
3. Server authorization: server functions and mutations check authorization again through middleware or authoritative user context.[cite:5]

For the Admin menu and the Base Tenant area, the same rule applies in all three layers: access is only allowed when `app_user.is_system_admin = true`.[cite:4][cite:5]

## Module-Specific UX Patterns

### Addresses

Addresses should use a TriView layout with a category tree on the left, an address grid in the upper-right area, and dependent context tabs in the lower-right area for contacts, delivery addresses, and related documents.[cite:1][cite:3]

### Articles

Articles should also use TriView with a group tree on the left, an article grid in the upper-right area, and warehouse or inventory-related context in the lower-right area.[cite:1][cite:3]

### Documents

Documents should support two modes:

- Browse mode in TriView with document types or groups on the left, a document list in the upper-right area, and lines or dependent context in the lower-right area.[cite:1][cite:3]
- Edit mode in a separate DocumentEditor with a compact header and a dedicated line editor.[cite:1][cite:3]

### Settings

Settings should be implemented as generic EntityPage or TriView combinations depending on the structure of the specific helper table. The emphasis should be on fast configuration through standard components rather than on custom one-off dialogs.[cite:1][cite:3]

### Admin

Admin screens may be more list- and form-oriented for pragmatic reasons, but they should still use the same standard components, command rules, and focus concepts.[cite:1][cite:3]

## Design System Translation from `design.md`

The visual system should be translated as follows:

- Shell and sidebar: dark background in `brand-dark-900` or an ink tone.[cite:2]
- Content surfaces: `canvas` and `canvas-soft` for main panels and cards.[cite:2]
- Primary actions: `primary` as the indigo action color for main CTAs and active navigation.[cite:2]
- Forms: light inputs with `hairline-input` borders and `primary` focus state.[cite:2]
- Cards and panels: light cards with `hairline` borders and `lg` radius.[cite:2]
- Buttons: short pill-shaped buttons for primary actions and row actions.[cite:2]
- Numeric values: always use `tabular-nums` or tabular figures.[cite:2]
- Text colors: avoid pure black; use `ink` and `ink-mute` for hierarchy.[cite:2]

The UI should feel calm, dense, professional, and operational. Its priority is readability, fast orientation, and stable data work, not decorative expression.[cite:2][cite:1]

## Recommended Sidebar Structure

```text
[Logo / Product]
[Tenant Switcher]

Addresses
Articles
Documents

Settings

Administration         (only if is_system_admin)
Base Tenant            (only if is_system_admin)

--------------------
[User / Avatar]
- User Config
- Language Switcher (optional mirror)
- Sign out
```

## Routing Recommendation

Under an auth-protected shell layout, the following structure is recommended:[cite:5]

- `/addresses`
- `/articles`
- `/documents`
- `/settings/*`
- `/admin/*`
- `/base-tenant/*`
- `/user-config`

The protected shell should consume the authoritative user context from the auth loader so that child routes and components use the same identity and permissions state.[cite:5]

## Non-Goals and Boundaries

The following concerns are explicitly **not** part of frontend responsibility as freely editable UI behavior:

- Posting logic.[cite:1][cite:4]
- Derived-data CRUD.[cite:1][cite:4]
- Tenant isolation.[cite:4]
- Security boundaries.[cite:4][cite:5]
- Redefining system invariants through settings or designer tools.[cite:3][cite:4]

The frontend may display these states and initiate authorized commands, but it must not own business invariants, security rules, or derived posting logic.[cite:1][cite:4]
