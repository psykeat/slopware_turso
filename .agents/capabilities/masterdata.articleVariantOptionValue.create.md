# Capability: `masterdata.articleVariantOptionValue.create`

> **Module**: masterdata | **Entity**: articleVariantOptionValue | **Operation**: create
> **Kind**: create | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Link an option value to a variant
- **DE**: Optionswert einer Variante zuordnen

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
- **Idempotent**: No
- **Supports Dry Run**: No
