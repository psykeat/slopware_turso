# Capability: `system.modules.update`

> **Module**: system | **Entity**: modules | **Operation**: update
> **Kind**: update | **Min Role**: tenant_admin | **Exposure (LLM)**: safe

## Summary
- **EN**: Update modules
- **DE**: modules ändern

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| id | uuid | No | |
| patch | record/map | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `modules`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
