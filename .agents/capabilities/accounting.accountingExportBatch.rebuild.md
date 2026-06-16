# Capability: `accounting.accountingExportBatch.rebuild`

> **Module**: accounting | **Entity**: accountingExportBatch | **Operation**: rebuild
> **Kind**: process | **Min Role**: tenant_admin | **Exposure (LLM)**: safe

## Summary
- **EN**: Rebuild export rows
- **DE**: Exportzeilen neu erzeugen

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| batchId | uuid | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `accountingExportRow`, `accountingExportBatch`
- **Side Effects**: "rebuilds persisted export rows"
- **Idempotent**: No
- **Supports Dry Run**: No
