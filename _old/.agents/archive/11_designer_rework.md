# 11 - Designer Rework

## Goal

Rework the designer into a compact, field-first metadata editor that works directly on top of the live CRUD surface.

The designer must support:

- field ordering within frames
- field visibility
- readonly and required state
- label styling and simple formatting
- adding and removing fields
- adding and removing frames
- moving fields between frames
- JSONB-backed field definition and editing

The designer must not become a general tree editor or a second application surface.

## Why

The current implementation direction is closer to the right model than the original sheet-based designer, but the interaction contract still needs to be stated clearly.

The real product needs are simple and constrained:

- the live CRUD mask stays in the foreground
- layouts are template-driven, not free-form
- fields are grouped into frames
- every field belongs to exactly one frame
- complex business blocks are handled as structured containers, not as arbitrary nested canvas objects

The goal is a beautiful, compact editing experience that feels natural on top of the actual form, while keeping presentation stable and predictable.

## Product Model

The designer works with a fixed structural model.

### Layout templates

Base layouts are not freely editable canvases. They are predefined templates:

- standard two-column CRUD layout for normal entities
- one-column layout with additional right-side elements for address/article style surfaces

The designer may configure content inside those templates, but it should not redefine the template itself.

### Structural units

The editable structure is intentionally small:

- `Frame`
- `Field`

Rules:

- every field must belong to exactly one frame
- frames may contain multiple fields
- the renderer may auto-render everything else from metadata
- frames can be added or removed where the template allows it

### Invariants

- the live CRUD mask remains the foreground presentation
- the designer modifies metadata, not the measured geometry of the base surface
- overlay chrome must not increase the height of the rendered surface
- selection and editing must be out-of-flow
- the metadata model should remain stable across base and tenant overrides

## Canonical Scope

The designer may edit:

- field order within a frame
- field visibility
- field readonly state
- field required state
- label text
- label tone
- label emphasis or style
- simple formatting tokens
- field backing path
- JSONB field binding
- frame order
- frame creation and deletion
- field creation and deletion
- move field to another frame
- placement-related metadata needed for rendering

The designer may not edit:

- security boundaries
- tenant isolation rules
- posting behavior
- direct database mutation logic
- raw SQL
- unrestricted layout geometry
- arbitrary CSS or theme authoring

## Interaction Model

The primary interaction is selection-based.

- click selects a field or frame
- double-click opens a compact edit overlay for the selected item
- the overlay is anchored to the live surface or shown as a floating inspector
- selection must not replace the live CRUD surface

### Field editing overlay

The per-field overlay should expose only the controls needed for this domain:

- visibility toggle
- readonly toggle
- required toggle
- label text
- label tone
- label style
- simple formatting selection
- backing path
- schema vs JSONB field mode
- move up / move down within the frame
- move to frame
- add field
- add frame
- remove field
- remove frame

The overlay should feel compact and calm. It should look like an in-place affordance, not a separate editor application.

### Structural editing

The user should not need a tree editor for normal work.

Instead, the designer should support a simple frame-local structure view or inline numbered ordering that is good enough for:

- reordering fields
- moving fields between frames
- adding frames
- inserting fields

This keeps the interaction close to the data model and avoids a second hierarchy UI.

### Visual feedback

When a field or frame is selected:

- show a subtle outline or highlight
- show the compact edit affordance
- keep the base form readable
- avoid layout reflow

When editing nested or complex blocks:

- show enough structure to make placement obvious
- do not introduce a full canvas or arbitrary drag workspace

## Formatting Model

Formatting should be limited and safe.

Preferred formatting controls:

- label tone
- label emphasis
- font weight style
- a small set of presentation tokens

Avoid:

- free-form CSS editing
- arbitrary color pickers for the whole surface
- unconstrained typography changes
- theme-level authoring from the field editor

The goal is to make labels and field chrome expressive enough for common CRUD needs without turning the designer into a design tool.

## JSONB Fields

JSONB-backed fields must behave like first-class fields in the designer.

Required behavior:

- they can be created and removed from the same field editing flow
- they can be assigned to a stable backing path
- the path must be validated against the schema contract before save or apply
- they can be shown, hidden, reordered, and styled like ordinary fields
- they should render through the same effective field contract as physical fields

The designer must not treat JSONB as a special separate editor class that cannot participate in normal field placement.

## Frames and Complex Blocks

Frames are the primary structural container.

The following should be handled as frame-backed groups rather than as ad hoc nested tree nodes:

- addresses
- contacts
- delivery addresses
- bank accounts
- article blocks
- other repeated business substructures

These blocks may have internal fields and may require more constrained placement rules, but they still fit the same frame/field model.

## Runtime Contract

The designer must operate through the platform runtime, not through ad hoc local UI state alone.

Requirements:

- activation goes through `CommandProvider`
- focus state remains visible to the platform
- selection changes must be reflected in the inspector
- escape should cancel transient edits before closing the designer
- the base CRUD surface remains usable while the designer is active

The designer should behave like a mode on top of the existing shell, not like a separate route that owns the whole page.

## Non-Goals

The rework is explicitly not:

- a general tree editor
- a free-form layout builder
- a Figma-like design canvas
- a second CRUD application
- a theming system
- a CSS authoring tool
- a server-side business rule editor

It should stay narrow and domain-specific.

## Implementation Shape

The implementation should follow the current code direction:

- `DesignerProvider` remains the state anchor
- `EntityMask` renders the live surface and the selection overlays
- the inspector edits metadata for the selected frame or field
- structural operations are expressed as metadata updates
- preview changes are local until applied or saved

The editor should use a compact out-of-flow overlay rather than a surface that changes the layout height of the form.

## Acceptance Criteria

The rework is complete when:

- selecting a field shows a compact edit affordance without changing the form height
- double-click opens field formatting and metadata controls
- visibility, readonly, required, and label styling can be changed per field
- fields can be moved within and across frames
- new fields and frames can be added
- fields can be removed
- JSONB-backed fields can be created and bound to a valid path
- complex blocks such as addresses and bank accounts can be organized inside frames
- the live CRUD surface remains the foreground presentation throughout

## Open Design Rule

If a control would make the live surface feel like a separate editor, it is too heavy for this slice.

The designer should be expressive, but it must stay visually lightweight and structurally bounded.
