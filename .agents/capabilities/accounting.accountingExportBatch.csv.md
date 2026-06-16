# Capability: `accounting.accountingExportBatch.csv`

> **Module**: accounting | **Entity**: accountingExportBatch | **Operation**: csv
> **Kind**: read | **Min Role**: tenant_admin | **Exposure (LLM)**: safe

## Summary
- **EN**: Generate export CSV
- **DE**: Export-CSV erzeugen

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| batchId | uuid | No | |

## Output Schema
- **Type**: `string`

## Invariants & Side Effects
- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
