# Capability: `accounting.accountingExportBatch.markExported`

> **Module**: accounting | **Entity**: accountingExportBatch | **Operation**: markExported
> **Kind**: process | **Min Role**: tenant_admin | **Exposure (LLM)**: confirm

## Summary

- **EN**: Mark export batch as exported
- **DE**: Export-Batch als exportiert markieren

## Input Schema

| Field   | Type | Optional | Description / Notes |
| :------ | :--- | :------- | :------------------ |
| batchId | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `accountingExportBatch`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
