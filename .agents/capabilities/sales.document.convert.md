# Capability: `sales.document.convert`

> **Module**: sales | **Entity**: document | **Operation**: convert
> **Kind**: process | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary
- **EN**: Convert a document
- **DE**: Beleg umwandeln

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| documentId | uuid | No | |
| targetGroupId | uuid | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `document`, `documentLine`, `documentLineAllocation`, `documentLineTracking`
- **Side Effects**: "archives the source document and creates a target draft"
- **Idempotent**: No
- **Supports Dry Run**: No
