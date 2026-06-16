# Capability: `masterdata.articleVariantOptionValue.list`

> **Module**: masterdata | **Entity**: articleVariantOptionValue | **Operation**: list
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: List variant option assignments
- **DE**: Varianten-Optionszuweisungen auflisten

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| variantId | uuid | Yes | |
| valueId | uuid | Yes | |
| optionId | uuid | Yes | |
| search | string | Yes | |
| limit | number | No | |
| offset | number | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
