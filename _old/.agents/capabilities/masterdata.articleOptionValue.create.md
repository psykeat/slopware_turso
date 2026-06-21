# Capability: `masterdata.articleOptionValue.create`

> **Module**: masterdata | **Entity**: articleOptionValue | **Operation**: create
> **Kind**: create | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Create an article option value
- **DE**: Artikeloptionswert anlegen

## Input Schema

| Field     | Type   | Optional | Description / Notes |
| :-------- | :----- | :------- | :------------------ |
| optionId  | uuid   | No       |                     |
| value     | string | No       |                     |
| sortOrder | number | Yes      |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `articleOptionValue`
- **Side Effects**: None
- **Idempotent**: No
- **Supports Dry Run**: No
