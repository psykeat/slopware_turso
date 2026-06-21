# Capability: `masterdata.category.update`

> **Module**: masterdata | **Entity**: category | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Update a category
- **DE**: Kategorie ändern

## Input Schema

| Field      | Type   | Optional | Description / Notes |
| :--------- | :----- | :------- | :------------------ |
| categoryId | uuid   | No       |                     |
| patch      | object | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `category`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
