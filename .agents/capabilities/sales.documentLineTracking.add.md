# Capability: `sales.documentLineTracking.add`

> **Module**: sales | **Entity**: documentLineTracking | **Operation**: add
> **Kind**: create | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Add a tracking row to a document line
- **DE**: Tracking-Zeile zur Belegzeile hinzufügen

## Description
- **EN**: Exactly one of serialNumberId, serialNo or batchNo must be provided.
- **DE**: Genau eines von serialNumberId, serialNo oder batchNo muss übergeben werden.

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| documentId | uuid | No | |
| documentLineId | uuid | No | |
| serialNumberId | uuid | Yes | |
| serialNo | string | Yes | |
| batchNo | string | Yes | |
| qty | unknown | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `documentLineTracking`
- **Side Effects**: None
- **Idempotent**: No
- **Supports Dry Run**: No
