# Capability: `masterdata.addressCategory.update`

> **Module**: masterdata | **Entity**: addressCategory | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Update addressCategory
- **DE**: addressCategory ändern

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| id | uuid | No | |
| patch | record/map | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `addressCategory`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
