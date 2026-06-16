# Capability: `masterdata.productionOrder.archive`

> **Module**: masterdata | **Entity**: productionOrder | **Operation**: archive
> **Kind**: archive | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary
- **EN**: Archive productionOrder
- **DE**: productionOrder archivieren

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| id | uuid | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `productionOrder`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
