# Capability: `system.tenantGroups.update`

> **Module**: system | **Entity**: tenantGroups | **Operation**: update
> **Kind**: update | **Min Role**: tenant_admin | **Exposure (LLM)**: safe

## Summary

- **EN**: Update tenantGroups
- **DE**: tenantGroups ändern

## Input Schema

| Field | Type       | Optional | Description / Notes |
| :---- | :--------- | :------- | :------------------ |
| id    | uuid       | No       |                     |
| patch | record/map | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `tenantGroups`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
