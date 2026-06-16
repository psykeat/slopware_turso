# Capability: `accounting.accountingExportBatch.buildRows`

> **Module**: accounting | **Entity**: accountingExportBatch | **Operation**: buildRows
> **Kind**: process | **Min Role**: tenant_admin | **Exposure (LLM)**: safe

## Summary
- **EN**: Build export rows
- **DE**: Exportzeilen erzeugen

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| batchId | uuid | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `accountingExportRow`, `accountingExportBatch`
- **Side Effects**: "aggregates journal data into export rows"
- **Idempotent**: No
- **Supports Dry Run**: No
