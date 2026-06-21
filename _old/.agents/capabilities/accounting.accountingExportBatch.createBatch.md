# Capability: `accounting.accountingExportBatch.createBatch`

> **Module**: accounting | **Entity**: accountingExportBatch | **Operation**: createBatch
> **Kind**: create | **Min Role**: tenant_admin | **Exposure (LLM)**: safe

## Summary

- **EN**: Create an accounting export batch
- **DE**: Buchungsexport-Batch anlegen

## Input Schema

| Field          | Type | Optional | Description / Notes |
| :------------- | :--- | :------- | :------------------ |
| companyId      | uuid | No       |                     |
| fiscalPeriodId | uuid | No       |                     |
| createdBy      | uuid | Yes      |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `accountingExportBatch`
- **Side Effects**: None
- **Idempotent**: No
- **Supports Dry Run**: No
