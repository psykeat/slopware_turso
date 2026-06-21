# 11 - Tax Refactor

## Problem Statement

The tax model is present, but the runtime wiring is not yet strong enough for
reliable tax calculation across countries, customer contexts, and differing
delivery addresses.

The schema already separates the relevant concepts:

- `tax_class` classifies customers and articles.
- `tax_code` represents the executable tax key and rate.
- `tax_rule` maps customer tax class, article tax class, country, and validity
  range to a tax code.

The current sales pricing path does not consistently use `tax_rule` as the
central decision point. The most critical issue is that `resolveVariantPricing()`
can return an article `taxClassId` as `taxCodeId`. That treats a classifier as if
it were an executable tax key, and the document editor can then persist that
value into document lines.

Differing delivery addresses are also modeled in documents and logistics, but
the tax calculation path does not currently account for the delivery country.
For EU and export scenarios, this is too implicit.

## Goals

- Introduce a central server-side tax resolver.
- Ensure document lines only store real `tax_code.tax_code_id` values.
- Use `tax_rule` as the runtime source of truth for tax code resolution.
- Include delivery country in the sales pricing and document tax path.
- Keep tax calculation out of the UI.
- Make B2B/B2C, EU, and export behavior testable.

## Non-Goals

- Full OSS / One-Stop-Shop automation.
- External VAT ID validation.
- Incoterms and advanced cross-border edge cases.
- Migration of historical document lines.
- A complex tax-rule management UI.
- Legal validation of country-specific tax rules.

## Target Architecture

The refactor should separate tax handling into three layers.

### Tax Classification Layer

This layer collects classification data from master data:

- `customerTaxClassId`
- `articleTaxClassId`
- `vatId`
- `billingCountryCode`
- `deliveryCountryCode`
- optional country metadata such as `country.is_eu`

It should not decide the final tax code by itself.

### Tax Resolution Layer

This layer is a domain service that resolves a concrete `taxCodeId` from the
classification inputs. It owns the lookup into `tax_rule` and returns an explicit
resolved tax result.

Suggested input:

```ts
type ResolveTaxInput = {
  tenantId: string;
  documentDate: string;
  customerId: string | null;
  billingCountryCode: string | null;
  deliveryCountryCode: string | null;
  articleTaxClassId: string | null;
  documentType?: string | null;
};
```

Suggested output:

```ts
type ResolvedTaxResult = {
  taxCodeId: string | null;
  taxRate: string | null;
  ruleId: string | null;
  countryCodeUsed: string | null;
  customerTaxClassId: string | null;
  articleTaxClassId: string | null;
  reason: string;
};
```

`reason` is intentionally part of the result. Tax calculation needs to be
debuggable and explainable.

### Document Pricing Layer

Document pricing asks the tax resolver for tax information. It does not perform
tax-rule interpretation directly.

The document editor should only consume the server result and store the
resolved `taxCodeId`. It must not infer tax codes from tax classes.

## Runtime Rules

Initial sales behavior:

- Use `deliveryCountryCode` as the tax-relevant country when present.
- Fall back to `billingCountryCode`.
- Resolve `customerTaxClassId` from the customer address.
- Resolve `articleTaxClassId` from the article.
- Look up `tax_rule` by tenant, validity range, customer tax class, article tax
  class, and country.

Suggested lookup order:

1. Exact customer tax class, exact article tax class, exact country.
2. Exact customer tax class, exact article tax class, `countryCode IS NULL`.
3. `customerTaxClassId IS NULL`, exact article tax class, exact country.
4. `customerTaxClassId IS NULL`, exact article tax class, `countryCode IS NULL`.
5. Controlled fallback or no result.

The resolver must not silently return an arbitrary tax code when no rule
matches.

## Implementation Plan

### 1. Stabilize Tax Terminology

Rename local variables and types where `taxClassId` and `taxCodeId` are
currently ambiguous.

This commit should not change behavior. It should make the current misuse easier
to see and reduce the risk of accidental identifier mixing during the refactor.

### 2. Add `TaxResolutionService`

Create a central service in the domain/database service layer.

Initial method:

- `resolveTaxCode(input: ResolveTaxInput): Promise<ResolvedTaxResult>`

The first version should be callable by tests but not yet wired into the
document editor.

### 3. Implement `tax_rule` Specificity Lookup

Implement tenant-scoped, validity-aware rule lookup.

The resolver should:

- Filter by `tenantId`.
- Filter by `validFrom <= documentDate`.
- Filter by `validTo IS NULL OR validTo >= documentDate`.
- Prefer the most specific rule.
- Return `taxCodeId`, `taxRate`, `ruleId`, and `reason`.

### 4. Resolve Customer Tax Context

Load the customer address server-side when `customerId` is present.

Use:

- `address.taxClassId`
- `address.vatId`
- `address.countryCode`

In the first refactor stage, use the explicitly assigned `address.taxClassId`.
Do not silently infer B2B or B2C from VAT ID unless a separate policy is defined.

### 5. Resolve Country Context

Model billing and delivery country as separate inputs.

For sales documents, the initial policy is:

```ts
countryCodeUsed = deliveryCountryCode ?? billingCountryCode;
```

The resolver should expose `countryCodeUsed` in its result so that downstream
debugging is straightforward.

### 6. Fix `resolveVariantPricing()`

`resolveVariantPricing()` must stop returning `article.taxClassId` as
`taxCodeId`.

New behavior:

- Resolve price from price lists as before.
- Load article tax class.
- Resolve tax through `TaxResolutionService`.
- Return only a real `tax_code.tax_code_id` as `taxCodeId`.

If no tax code can be resolved, return `taxCodeId: null` with a clear reason.

### 7. Extend Pricing Endpoint

The article pricing endpoint should accept delivery context.

Inputs to support:

- `customerId`
- `documentDate`
- `deliveryAddressId`
- `deliveryCountryCode`
- `billingCountryCode`

When `deliveryAddressId` is provided, load the delivery address server-side and
tenant-scope the lookup. Do not trust client-provided tenant data.

### 8. Update Document Editor Integration

When an article is selected in the document editor, pass the available context
to the pricing endpoint:

- `customerId`
- `documentDate`
- `deliveryAddressId`
- fallback delivery snapshot country
- billing snapshot country

The editor should apply the resolved tax result. It should not perform tax-rule
interpretation.

### 9. Handle Delivery Address Changes

Changing the delivery address can invalidate the tax code of existing document
lines.

First implementation stage:

- Detect delivery address changes.
- Mark existing line tax context as stale or expose an explicit action to
  refresh line taxes.

Avoid automatic mass changes until the user workflow is clear, because changing
tax codes on existing lines can be surprising in accounting workflows.

### 10. Validate Document Line Tax Codes

Before saving document lines, validate that every non-null `taxCodeId` belongs
to an existing `tax_code` in the same tenant.

This validation should prevent a `taxClassId` or foreign tenant value from being
persisted as a line tax code.

### 11. Prepare Commerce Sync for Shared Tax Resolution

The commerce sync currently reads tax rules only as an article tax-rate mapping.
This should be isolated and later replaced by the same resolver.

Because shop product tax is not always tied to a concrete delivery address,
commerce sync needs an explicit channel/default tax context rather than
borrowing document-specific assumptions.

### 12. Add Resolver Tests

Add focused service tests for `TaxResolutionService`.

Required cases:

- Domestic standard article resolves to domestic tax code.
- EU B2B customer class resolves to intra-community tax code.
- Export customer class resolves to export tax code.
- Delivery country takes precedence over billing country.
- `validFrom` and `validTo` are respected.
- More specific rules beat fallback rules.
- No matching rule returns a controlled no-result response.

### 13. Add Pricing Integration Tests

Add a pricing test through the existing service or capability surface.

The test should seed:

- customer address
- delivery address
- article
- tax classes
- tax codes
- tax rules

Then assert that pricing returns a real `taxCodeId` from `tax_code`, not an
article `taxClassId`.

### 14. Add Document Scenario Coverage

Add a sales document scenario test with a differing delivery address.

Assert that:

- document line `taxCodeId` is resolved through `tax_rule`
- the stored value is a real tax code
- tenant isolation is preserved

### 15. Remove Old Partial Interpretations

After the new resolver path is used by pricing and documents, remove or reduce
old direct tax-rate interpretations that duplicate resolver behavior.

Update documentation to point future work at the resolver as the single runtime
entry point for tax decisions.

## Testing Strategy

Tests should verify external behavior, not internal SQL shape.

Good tests answer: given tenant-scoped master data and a document context, which
tax code is resolved?

Recommended coverage:

- Unit/service tests for tax resolution.
- Pricing integration tests through the existing service or capability surface.
- Sales document scenario tests for persistence behavior.
- Regression test proving `taxClassId` is never returned or persisted as
  `taxCodeId`.

Existing prior art:

- Sales document scenario tests in the capabilities test suite.
- Capability coverage around `resolveVariantPricing`.
- Commerce sync tests for external tax-rate mapping behavior.

## Acceptance Criteria

- `resolveVariantPricing()` never returns an article `taxClassId` as `taxCodeId`.
- New document lines only store real tenant-scoped `tax_code` IDs.
- `tax_rule` is the central runtime source for tax-code selection.
- Delivery country is available to tax resolution.
- The UI does not contain tax-rule decision logic.
- Missing tax rules produce a controlled result or error, not a silent arbitrary
  fallback.
- Tests cover domestic, EU B2B, B2C/default, export, fallback, and differing
  delivery country behavior.

## Open Decisions

- Should B2B/B2C be explicitly stored on the address, inferred from VAT ID, or
  represented only by `address.taxClassId`?
- Should delivery-country changes automatically recalculate existing line taxes,
  or should users trigger recalculation explicitly?
- What is the default tax context for commerce channels that do not have a
  concrete document delivery address?
- Should missing tax rules block saving a document line, or allow saving with
  `taxCodeId: null` and an explicit warning?
