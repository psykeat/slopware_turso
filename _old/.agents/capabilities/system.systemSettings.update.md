# Capability: `system.systemSettings.update`

> **Module**: system | **Entity**: systemSettings | **Operation**: update
> **Kind**: update | **Min Role**: tenant_admin | **Exposure (LLM)**: safe

## Summary

- **EN**: Update systemSettings
- **DE**: systemSettings ändern

## Input Schema

| Field | Type       | Optional | Description / Notes |
| :---- | :--------- | :------- | :------------------ |
| id    | uuid       | No       |                     |
| patch | record/map | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `systemSettings`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
