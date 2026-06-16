# Capability: `accounting.journalLine.update`

> **Module**: accounting | **Entity**: journalLine | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Update journalLine
- **DE**: journalLine ändern

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| id | uuid | No | |
| patch | record/map | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `journalLine`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
