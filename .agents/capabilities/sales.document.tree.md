# Capability: `sales.document.tree`

> **Module**: sales | **Entity**: document | **Operation**: tree
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Get the document tree
- **DE**: Belegbaum laden

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| companyId | uuid | Yes | |

## Output Schema
- **Type**: `array of object`

## Invariants & Side Effects
- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
