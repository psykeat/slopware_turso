# Capability: `import.importBatch.get`

> **Module**: import | **Entity**: importBatch | **Operation**: get
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Get an import batch with rows
- **DE**: Import-Batch mit Zeilen lesen

## Input Schema

| Field   | Type | Optional | Description / Notes |
| :------ | :--- | :------- | :------------------ |
| batchId | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
