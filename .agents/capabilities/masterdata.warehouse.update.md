# Capability: `masterdata.warehouse.update`

> **Module**: masterdata | **Entity**: warehouse | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Update warehouse
- **DE**: warehouse ändern

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| id | uuid | No | |
| patch | record/map | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `warehouse`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
