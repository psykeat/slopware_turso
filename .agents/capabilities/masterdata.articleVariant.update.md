# Capability: `masterdata.articleVariant.update`

> **Module**: masterdata | **Entity**: articleVariant | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Update an article variant
- **DE**: Artikelvariante ändern

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| variantId | uuid | No | |
| patch | object | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `articleVariant`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
