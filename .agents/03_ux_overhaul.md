# UX Overhaul & Architectural Advancements

This session focused on a sweeping modernization of the `slopware` architecture, aligning our frontend and backend patterns strictly with the broader TanStack ecosystem based on our `tanmaxx_analysis.md` blueprint. We also refined our End-to-End testing philosophy for complex multi-tenant environments.

## 1. Expanding the TanStack Ecosystem

### 📝 Typsichere Formulare mit `@tanstack/react-form`

The core `EntityMask` component, which serves as the primary generic UI layer for metadata-driven entity editing, was entirely refactored to use `@tanstack/react-form`.

- **Form State vs Designer State Separation**: We decoupled the runtime data editing layer from the visual design overlay mode. The form state (values, validation, dirty status) is now exclusively managed by TanStack Form, preventing `Maximum update depth exceeded` crashes by removing volatile form values from designer `useLayoutEffect` hooks.
- **Granular Subscriptions**: Sub-fields (`FieldInput`) are now cleanly wrapped inside `<form.Field>` boundaries. Typing in a single field updates only that field, avoiding full re-renders of the 1,500-line mask component.
- **Error Mapping**: Re-introduced a `globalErrorNode` to gracefully handle API rejection states (400/422/500 errors), alongside native field-level validation binding.

### 🔄 Dauerhafte Server-Workflows mit `@tanstack/workflow-core`

We replaced the custom, hand-rolled polling loops for background tasks with robust queues powered by `@tanstack/workflow-core`.

- **Email Job Synchronization**: The legacy `EmailJobService` queue mechanisms were migrated to `@tanstack/workflow-core`, providing a standardized, stateful backend engine capable of handling complex background sync and parsing events.

### 💡 Future Outlook: Ephemerer State mit `@tanstack/store`

As part of the UX overhaul, we analyzed how to replace heavily utilized, top-level React Contexts (like `FocusProvider` and `CommandProvider`) with `@tanstack/store`. While `EntityMask` is now fully migrated to React Form, `@tanstack/store` remains our targeted solution for handling ephemeral designer state across the UI without causing broad re-renders.

---

## 2. Testing Philosophy: E2E Playwright vs Backend Integration

### The Playwright Concept (`e2e_playwright_concept.md`)

We heavily iterated on our E2E testing structure for Playwright to accommodate our strict Multi-Tenant setup with Better Auth:

- **Global Auth Setup**: Implemented an `auth.setup.ts` to programmatically authenticate test accounts via the Better Auth API and securely persist `storageState` (cookies) for both `Tenant Alpha` and `Tenant Beta`.
- **Tenant Isolation Testing**: Wrote specific data-leak tests (`data-leak.spec.ts`) validating that `Tenant Beta` absolutely cannot query or access `Tenant Alpha`'s metadata.

### The Shift to Backend Integration Testing

While Playwright is perfect for UI flow verification (like testing the `DocumentEditor` workflow and global Command Palette), we discovered that it is brittle and unnecessary for testing deep background queues.

- **Pivoting the Strategy**: When testing the new `@tanstack/workflow-core` email sync logic, we bypassed the Playwright UI layer entirely. A subagent successfully wrote a fast, reliable Node backend integration test (`job-service.test.ts`) that asserts correct enqueueing and execution status natively in the DB layer, fulfilling the architectural philosophy that async jobs belong in backend integration layers, not DOM-based E2E.

---

## 3. General UX / Accessibility Polish

- **UUID & Foreign Key Resolution**: Added proactive `Id`-based field promotion in `EntityMask`. UUID strings are no longer rendered as raw text inputs. Instead, they dynamically escalate into `<LookupField>` components that fetch human-readable labels and prevent dirty free-text entry.
- **Accessibility Fixes**: Labels wrapped inside buttons had their `tabIndex` explicitly set to `-1` to prevent the keyboard tabulator from confusingly focusing static form labels.
- **Save Actions**: Reconnected `EntityMask`'s `onSaved` callbacks, ensuring that completing a record instantly fires success toast notifications, invalidates TanStack queries, and correctly closes the mask.
