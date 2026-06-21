# Capability: `masterdata.taxClass.update`

> **Module**: masterdata | **Entity**: taxClass | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Update taxClass
- **DE**: taxClass ändern

## Input Schema

| Field | Type       | Optional | Description / Notes |
| :---- | :--------- | :------- | :------------------ |
| id    | uuid       | No       |                     |
| patch | record/map | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `taxClass`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
