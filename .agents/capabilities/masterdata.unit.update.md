# Capability: `masterdata.unit.update`

> **Module**: masterdata | **Entity**: unit | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: hidden

## Summary
- **EN**: Update unit by id
- **DE**: unit per ID ändern

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| unitId | uuid | No | |
| patch | record/map | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `unit`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
