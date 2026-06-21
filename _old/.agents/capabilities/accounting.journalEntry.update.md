# Capability: `accounting.journalEntry.update`

> **Module**: accounting | **Entity**: journalEntry | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Update journalEntry
- **DE**: journalEntry ändern

## Input Schema

| Field | Type       | Optional | Description / Notes |
| :---- | :--------- | :------- | :------------------ |
| id    | uuid       | No       |                     |
| patch | record/map | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `journalEntry`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
