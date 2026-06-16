# Capability: `sales.document.update`

> **Module**: sales | **Entity**: document | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Update a document
- **DE**: Beleg ändern

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| documentId | uuid | No | |
| patch | record/map | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `document`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
