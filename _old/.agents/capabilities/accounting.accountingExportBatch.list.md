# Capability: `accounting.accountingExportBatch.list`

> **Module**: accounting | **Entity**: accountingExportBatch | **Operation**: list
> **Kind**: read | **Min Role**: tenant_admin | **Exposure (LLM)**: safe

## Summary

- **EN**: List accounting export batches
- **DE**: Buchungsexport-Batches auflisten

## Input Schema

| Field     | Type | Optional | Description / Notes |
| :-------- | :--- | :------- | :------------------ |
| companyId | uuid | Yes      |                     |

## Output Schema

- **Type**: `array of object`

## Invariants & Side Effects

- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
