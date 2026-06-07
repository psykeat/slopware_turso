# Refactor EntityMask to use @tanstack/react-form

The goal of this refactor is to migrate the highly complex `EntityMask` component to use `@tanstack/react-form`, providing a headless, type-safe, and highly optimized form state model. This will significantly simplify the component by offloading state management, dirty checking, validation, and submission logic to the library.

## User Review Required

> [!WARNING]
> **Generic Component vs SSR Form Binding**
> The TanStack Start SSR guide typically assumes a static form shape (e.g., a specific `LoginForm` or `SignupForm`) with dedicated `createServerFn` and `formOptions`.
>
> However, `EntityMask` is a **generic, metadata-driven component** that renders dynamic fields based on `entityName`. Since the fields aren't known until runtime (or load time), we cannot statically define `formOptions` with fixed `defaultValues` at module scope in the traditional way.
>
> **Proposed Approach:**
> We will use `useForm` purely as a client-side state manager within `EntityMask` to handle the dynamic fields, subscriptions, and async validators (like the ZIP code lookup). We will continue using the existing `PATCH`/`POST` API endpoints (which you mentioned already handle database constraints and middleware error handling) and map any 400/500 validation errors returned from the server back into the form using `form.setError()`.
>
> Please confirm if this hybrid approach is acceptable, or if you want to completely replace the dynamic API endpoints with a single dynamic Server Action.

## Proposed Changes

### `packages/ui/components/entity-mask.tsx`

#### [MODIFY] `entity-mask.tsx`

We will rewrite the component to use `@tanstack/react-form`:

1. **Remove `useState` for formData**: Replace the custom `formData` state, `readFieldValue`, and `writeFieldValue` with `useForm`. The form will automatically handle nested values (JSONB).
2. **Granular Subscriptions**:
   - We will extract `FieldInput` to use `<form.Field>`. This ensures that only the specific field re-renders when a user types, not the entire `EntityMask`.
   - We will use `form.Subscribe` for the save button to react to `canSubmit` and `isSubmitting`.
3. **Async Validation & Derived Data**:
   - The specific calculation for city name based on `postalCode` and `countryCode` will be moved into a `form.Subscribe` listener or an async validator, leveraging `react-form`'s built-in debouncing so it doesn't fire on every keystroke.
4. **Error Handling**:
   - We will hook the `onSubmit` handler to the `react-form` instance. When the server responds with database constraint errors, we will map them to the form using `form.setError()`.
5. **Headless UI & Designer**:
   - The designer integration (drag-and-drop, draft fields) will remain, but the form state will be completely decoupled from the rendering loop.

## Verification Plan

### Automated Tests

- We will verify that our existing E2E tests and integration tests for entities pass without modification, as the UI structure and API surface should remain largely the same.

### Manual Verification

- We will manually test the `EntityMask` in the application to ensure:
  - Form fields render correctly based on metadata.
  - Granular re-rendering works (typing in one field doesn't re-render others).
  - The ZIP code + country lookup successfully populates the city.
  - Server-side constraint errors highlight the correct fields.
  - Designer features (moving fields, hiding fields) still function.
