# Capability: `sales.documentLineTracking.update`

> **Module**: sales | **Entity**: documentLineTracking | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Update documentLineTracking
- **DE**: documentLineTracking ändern

## Input Schema

| Field | Type       | Optional | Description / Notes |
| :---- | :--------- | :------- | :------------------ |
| id    | uuid       | No       |                     |
| patch | record/map | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `documentLineTracking`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
