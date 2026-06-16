# Capability: `system.company.update`

> **Module**: system | **Entity**: company | **Operation**: update
> **Kind**: update | **Min Role**: tenant_admin | **Exposure (LLM)**: safe

## Summary
- **EN**: Update company
- **DE**: company ändern

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| id | uuid | No | |
| patch | record/map | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `company`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
