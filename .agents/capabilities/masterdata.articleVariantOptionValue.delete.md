# Capability: `masterdata.articleVariantOptionValue.delete`

> **Module**: masterdata | **Entity**: articleVariantOptionValue | **Operation**: delete
> **Kind**: process | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary
- **EN**: Unlink an option value from a variant
- **DE**: Optionswert von Variante lösen

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| variantId | uuid | No | |
| valueId | uuid | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `articleVariantOptionValue`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
