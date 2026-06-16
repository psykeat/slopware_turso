# Capability: `system.organization.update`

> **Module**: system | **Entity**: organization | **Operation**: update
> **Kind**: update | **Min Role**: tenant_admin | **Exposure (LLM)**: safe

## Summary
- **EN**: Update organization
- **DE**: organization ändern

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| id | uuid | No | |
| patch | record/map | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `organization`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
