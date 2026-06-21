# Capability: `system.tenantFields.update`

> **Module**: system | **Entity**: tenantFields | **Operation**: update
> **Kind**: update | **Min Role**: tenant_admin | **Exposure (LLM)**: safe

## Summary

- **EN**: Update tenantFields
- **DE**: tenantFields ändern

## Input Schema

| Field | Type       | Optional | Description / Notes |
| :---- | :--------- | :------- | :------------------ |
| id    | uuid       | No       |                     |
| patch | record/map | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `tenantFields`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
