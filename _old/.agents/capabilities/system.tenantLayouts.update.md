# Capability: `system.tenantLayouts.update`

> **Module**: system | **Entity**: tenantLayouts | **Operation**: update
> **Kind**: update | **Min Role**: tenant_admin | **Exposure (LLM)**: safe

## Summary

- **EN**: Update tenantLayouts
- **DE**: tenantLayouts ändern

## Input Schema

| Field | Type       | Optional | Description / Notes |
| :---- | :--------- | :------- | :------------------ |
| id    | uuid       | No       |                     |
| patch | record/map | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `tenantLayouts`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
