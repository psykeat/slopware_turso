# Capability: `masterdata.warehouse.archive`

> **Module**: masterdata | **Entity**: warehouse | **Operation**: archive
> **Kind**: archive | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary
- **EN**: Archive warehouse
- **DE**: warehouse archivieren

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| id | uuid | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `warehouse`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
