# Capability: `sales.documentLine.delta`

> **Module**: sales | **Entity**: documentLine | **Operation**: delta
> **Kind**: process | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary
- **EN**: Apply a document line delta
- **DE**: Delta auf Belegzeile anwenden

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| documentLineId | uuid | No | |
| qtyDelta | number | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `inventoryBalance`, `inventoryMovement`
- **Side Effects**: "adjusts stock balances and appends an inventory movement"
- **Idempotent**: No
- **Supports Dry Run**: No
