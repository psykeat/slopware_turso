# Capability: `system.userTenant.update`

> **Module**: system | **Entity**: userTenant | **Operation**: update
> **Kind**: update | **Min Role**: tenant_admin | **Exposure (LLM)**: safe

## Summary
- **EN**: Update userTenant
- **DE**: userTenant ändern

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| id | uuid | No | |
| patch | record/map | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `userTenant`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
