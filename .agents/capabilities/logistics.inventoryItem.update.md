# Capability: `logistics.inventoryItem.update`

> **Module**: logistics | **Entity**: inventoryItem | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Update inventoryItem
- **DE**: inventoryItem ändern

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| id | uuid | No | |
| patch | record/map | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `inventoryItem`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
