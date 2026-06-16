# Capability: `masterdata.taxCode.update`

> **Module**: masterdata | **Entity**: taxCode | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Update taxCode
- **DE**: taxCode ändern

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| id | uuid | No | |
| patch | record/map | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `taxCode`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
