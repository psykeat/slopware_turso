# Capability: `masterdata.incoterm.update`

> **Module**: masterdata | **Entity**: incoterm | **Operation**: update
> **Kind**: update | **Min Role**: tenant_admin | **Exposure (LLM)**: safe

## Summary

- **EN**: Update incoterm
- **DE**: incoterm ändern

## Input Schema

| Field | Type       | Optional | Description / Notes |
| :---- | :--------- | :------- | :------------------ |
| id    | uuid       | No       |                     |
| patch | record/map | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `incoterm`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
