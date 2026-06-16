# Capability: `masterdata.articleVariant.copyVariantAxes`

> **Module**: masterdata | **Entity**: articleVariant | **Operation**: copyVariantAxes
> **Kind**: process | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Copy variant axes from another article
- **DE**: Variantenachsen von anderem Artikel kopieren

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| targetArticleId | uuid | No | |
| sourceArticleId | uuid | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `articleOption`, `articleOptionValue`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
