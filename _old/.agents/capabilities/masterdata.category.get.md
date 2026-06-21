# Capability: `masterdata.category.get`

> **Module**: masterdata | **Entity**: category | **Operation**: get
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Get a category
- **DE**: Kategorie lesen

## Input Schema

| Field      | Type | Optional | Description / Notes |
| :--------- | :--- | :------- | :------------------ |
| categoryId | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
