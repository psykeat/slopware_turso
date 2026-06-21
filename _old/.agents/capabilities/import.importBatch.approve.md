# Capability: `import.importBatch.approve`

> **Module**: import | **Entity**: importBatch | **Operation**: approve
> **Kind**: process | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary

- **EN**: Approve an import batch
- **DE**: Import-Batch freigeben

## Description

- **EN**: Marks a pending/validating batch as approved so it can be posted.
- **DE**: Markiert einen Batch im Status pending/validating als freigegeben, damit er gebucht werden kann.

## Input Schema

| Field   | Type | Optional | Description / Notes |
| :------ | :--- | :------- | :------------------ |
| batchId | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `importBatch`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
