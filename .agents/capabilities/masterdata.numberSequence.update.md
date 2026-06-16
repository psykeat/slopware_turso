# Capability: `masterdata.numberSequence.update`

> **Module**: masterdata | **Entity**: numberSequence | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Update numberSequence
- **DE**: numberSequence ändern

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| id | uuid | No | |
| patch | record/map | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `numberSequence`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
