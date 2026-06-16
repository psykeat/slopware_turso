# Capability: `logistics.serialNumber.update`

> **Module**: logistics | **Entity**: serialNumber | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Update serialNumber
- **DE**: serialNumber ändern

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| id | uuid | No | |
| patch | record/map | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `serialNumber`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
