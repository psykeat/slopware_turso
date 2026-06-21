# Capability: `logistics.inventoryBalance.update`

> **Module**: logistics | **Entity**: inventoryBalance | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Update inventoryBalance
- **DE**: inventoryBalance ändern

## Input Schema

| Field | Type       | Optional | Description / Notes |
| :---- | :--------- | :------- | :------------------ |
| id    | uuid       | No       |                     |
| patch | record/map | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `inventoryBalance`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
