# Capability: `sales.document.duplicate`

> **Module**: sales | **Entity**: document | **Operation**: duplicate
> **Kind**: process | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Duplicate a document
- **DE**: Beleg duplizieren

## Input Schema

| Field         | Type | Optional | Description / Notes |
| :------------ | :--- | :------- | :------------------ |
| documentId    | uuid | No       |                     |
| targetGroupId | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `document`, `documentLine`, `documentLineTracking`
- **Side Effects**: "copies active document lines and tracking rows"
- **Idempotent**: No
- **Supports Dry Run**: No
