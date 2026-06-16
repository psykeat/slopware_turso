# Capability: `sales.documentLine.archive`

> **Module**: sales | **Entity**: documentLine | **Operation**: archive
> **Kind**: archive | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary
- **EN**: Archive a document line
- **DE**: Belegzeile archivieren

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| id | uuid | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `documentLine`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
