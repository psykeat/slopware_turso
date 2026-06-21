# Capability: `masterdata.articleVariantOptionValue.get`

> **Module**: masterdata | **Entity**: articleVariantOptionValue | **Operation**: get
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Get a variant option assignment
- **DE**: Varianten-Optionszuweisung lesen

## Input Schema

| Field     | Type | Optional | Description / Notes |
| :-------- | :--- | :------- | :------------------ |
| variantId | uuid | No       |                     |
| valueId   | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
