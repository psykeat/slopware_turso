# Capability: `masterdata.articleOption.update`

> **Module**: masterdata | **Entity**: articleOption | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Update an article option
- **DE**: Artikeloption ändern

## Input Schema

| Field    | Type   | Optional | Description / Notes |
| :------- | :----- | :------- | :------------------ |
| optionId | uuid   | No       |                     |
| patch    | object | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `articleOption`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
