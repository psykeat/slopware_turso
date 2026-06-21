# Capability: `sales.documentLine.update`

> **Module**: sales | **Entity**: documentLine | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Update documentLine
- **DE**: documentLine ändern

## Input Schema

| Field | Type       | Optional | Description / Notes |
| :---- | :--------- | :------- | :------------------ |
| id    | uuid       | No       |                     |
| patch | record/map | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `documentLine`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
