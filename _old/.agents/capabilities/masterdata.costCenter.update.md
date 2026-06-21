# Capability: `masterdata.costCenter.update`

> **Module**: masterdata | **Entity**: costCenter | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Update costCenter
- **DE**: costCenter ändern

## Input Schema

| Field | Type       | Optional | Description / Notes |
| :---- | :--------- | :------- | :------------------ |
| id    | uuid       | No       |                     |
| patch | record/map | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `costCenter`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
