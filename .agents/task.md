# EntityMask @tanstack/react-form Migration Tasks

- `[x]` Refactor `EntityMask`
  - `[x]` Replace `useState` `formData` with `useForm` hook, initializing with `initialValues` or fetched `record`.
  - `[x]` Remove `readFieldValue` and `writeFieldValue` in favor of form pathing.
  - `[x]` Extract `FieldInput` rendering into a proper `<form.Field>` wrapper to enforce granular subscriptions.
  - `[x]` Implement robust JSONB pathing within the form value tree to handle deep structures cleanly.
  - `[x]` Re-implement ZIP + Country -> City logic using `listeners` or async validators hooked to those specific fields (derived autofill).
  - `[x]` Refactor the save action (`onSubmit`) to use `form.handleSubmit`.
  - `[x]` Map server 400/500 errors into the `form.setError` mechanism (differentiating from local validation).
  - `[x]` Ensure designer state (`editorFieldKey`, `metaFields`, `delta`) stays strictly outside the form value tree.
- `[x]` Run linter to ensure no type errors.
- `[x]` Verify functionality.
