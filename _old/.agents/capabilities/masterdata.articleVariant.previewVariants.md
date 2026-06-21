# Capability: `masterdata.articleVariant.previewVariants`

> **Module**: masterdata | **Entity**: articleVariant | **Operation**: previewVariants
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Preview article variants
- **DE**: Artikelvarianten vorschauen

## Input Schema

| Field      | Type | Optional | Description / Notes |
| :--------- | :--- | :------- | :------------------ |
| articleId  | uuid | No       |                     |
| templateId | uuid | Yes      |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
