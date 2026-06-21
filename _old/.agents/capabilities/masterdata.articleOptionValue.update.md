# Capability: `masterdata.articleOptionValue.update`

> **Module**: masterdata | **Entity**: articleOptionValue | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Update an article option value
- **DE**: Artikeloptionswert ändern

## Input Schema

| Field   | Type   | Optional | Description / Notes |
| :------ | :----- | :------- | :------------------ |
| valueId | uuid   | No       |                     |
| patch   | object | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `articleOptionValue`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
