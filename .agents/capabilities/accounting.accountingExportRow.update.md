# Capability: `accounting.accountingExportRow.update`

> **Module**: accounting | **Entity**: accountingExportRow | **Operation**: update
> **Kind**: update | **Min Role**: tenant_admin | **Exposure (LLM)**: safe

## Summary
- **EN**: Update accountingExportRow
- **DE**: accountingExportRow ändern

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| id | uuid | No | |
| patch | record/map | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `accountingExportRow`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
