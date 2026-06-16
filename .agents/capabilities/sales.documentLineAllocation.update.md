# Capability: `sales.documentLineAllocation.update`

> **Module**: sales | **Entity**: documentLineAllocation | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Update documentLineAllocation
- **DE**: documentLineAllocation ändern

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| id | uuid | No | |
| patch | record/map | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `documentLineAllocation`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
