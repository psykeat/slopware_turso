# Capability: `sales.documentLine.tracking`

> **Module**: sales | **Entity**: documentLine | **Operation**: tracking
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Get document line tracking
- **DE**: Belegzeilen-Tracking laden

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| documentLineId | uuid | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
