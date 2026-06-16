# Capability: `masterdata.postalCode.update`

> **Module**: masterdata | **Entity**: postalCode | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Update postalCode
- **DE**: postalCode ändern

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| id | uuid | No | |
| patch | record/map | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `postalCode`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
