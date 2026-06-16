# Capability: `sales.document.post`

> **Module**: sales | **Entity**: document | **Operation**: post
> **Kind**: process | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary
- **EN**: Post a document
- **DE**: Beleg verbuchen

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| documentId | uuid | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `document`, `documentLine`, `inventoryMovement`, `inventoryBalance`, `journalEntry`, `journalLine`
- **Side Effects**: "creates inventory and accounting postings"
- **Idempotent**: No
- **Supports Dry Run**: No
