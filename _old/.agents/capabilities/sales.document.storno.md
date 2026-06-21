# Capability: `sales.document.storno`

> **Module**: sales | **Entity**: document | **Operation**: storno
> **Kind**: process | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary

- **EN**: Reverse a document
- **DE**: Beleg stornieren

## Input Schema

| Field      | Type | Optional | Description / Notes |
| :--------- | :--- | :------- | :------------------ |
| documentId | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `document`, `documentLine`
- **Side Effects**: "creates a reversal document"
- **Idempotent**: No
- **Supports Dry Run**: No
