# Inline Designer Spec & Action Plan

## 1. Product Model

- **Layout Templates**: Standard predefined templates (two-column CRUD for normal entities, one-column for addresses/articles).
- **Structural Units**:
  - `Frame`: Logical container grouped on metadata. Every field belongs to exactly one frame.
  - `Field`: Metadata-driven input config (backing schema path or custom JSONB path).
- **Invariants**:
  - Active CRUD form (`EntityMask`) stays in the foreground.
  - Overlay editor must be portalled out-of-flow and not cause layout reflow (use `ring-inset`, absolute overlay bodies).
  - Save vs. Apply distinction: `Save` patches local drafts, `Apply` publishes to the active tenant/org schema.

## 2. Component Integration

- `DesignerProvider` (State Anchor) $\rightarrow$ `EntityMask` (Renders Selection Overlay) $\rightarrow$ `InlineDesigner` (Sidebar inspector).
- Commands: Activation and deactivation routed through global `CommandProvider` and `FocusProvider`.

## 3. Active Implementation Gaps (Action Plan)

1. **Fix Duplicate Select Bug**: In `packages/ui/components/entity-mask.tsx` inside `editorOverlay`, remove the duplicated sequential `Source` select select input block (L1173–1194).
2. **Implement Frame Container Rendering**: Replace the flat field grid rendering in `EntityMask` with grouped `<fieldset>` or `<section>` wrappers based on `frameKey` / `parentId` configurations from `delta.fieldConfigs`.
3. **Floating Overlay Collision Guard**: In `EntityMask` `useLayoutEffect`, guard positioning of the floating editor overlay so it shifts leftward/downward if colliding with the sticky right-docked inline designer panel.
4. **Separate Save and Apply Paths**: Update `designer-context.tsx` `persistActiveSurface` to call `/patch` for transient saves and `/apply` for committing mutations, rather than funneling both to `/apply`.
