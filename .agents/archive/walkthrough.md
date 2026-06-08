# EntityMask Refactor Walkthrough

The `EntityMask` component has been successfully migrated to `@tanstack/react-form`. This refactor greatly simplifies the internal state logic while preserving the component's highly dynamic nature and strict boundary between form state and designer capabilities.

## What Changed

### 1. Replaced Custom State with `useForm`

- **Before**: `EntityMask` maintained an internal `formData` object via `useState` and manually manipulated paths using `splitPath()`, `readFieldValue()`, and `writeFieldValue()`.
- **After**: State management, dirty checking, and JSONB path traversal are now handled entirely by the `useForm` engine. The API submission (POST/PATCH) has been cleanly wrapped inside the `onSubmit` handler, and all 400/422 validation array issues returned by the backend are dynamically mapped back onto specific form fields using `formApi.setFieldMeta()`.

### 2. Isolated Re-renders with `<form.Field>`

- The custom `FieldInput` elements inside `renderFieldCard` are now strictly encapsulated within `<form.Field>`. This creates granular subscriptions, meaning typing into one field will no longer force a re-render of the entire 1,500-line mask component or the `editorOverlay` logic.
- We added `form.Subscribe` listeners explicitly around the global Save button to ensure its `isSubmitting` / `canSubmit` state stays updated without triggering top-level churn.

### 3. Field-Domain Rules and Validation Hooks

- **City Autofill**: Instead of an ad-hoc effect watching the entire `formData` payload, the ZIP Code and Country Code lookup is now a self-contained async side effect triggered by the `validators.onChangeAsync` hook, taking advantage of React Form's native `asyncDebounceMs: 500`.
- **Slug Generation**: The auto-slug functionality has been modeled directly as an `onChange` listener bound to the `name` field, cleanly setting the `slug` value at the field level.

## Validation Results

- I ran a full TypeScript analysis (`pnpm exec tsc --noEmit`) within the `@repo/ui` workspace. All type conflicts were resolved, including eliminating a duplicated import and ensuring that `formApi.setFieldMeta` properly handles dynamic metadata assignments for the `issues` array payload mapping.
- There are no compiler errors remaining in `entity-mask.tsx`.

## Next Steps

With the core `EntityMask` layout stable and migrated to TanStack conventions, you are now free to take advantage of these deeply nested types on the UI. Let me know if you would like me to tackle the remaining aspects of the `tanmaxx_analysis.md` blueprint (e.g., implementing `@tanstack/store` for global tenant/designer layouts)!
