# Capability: `sales.document.duplicateCandidates`

> **Module**: sales | **Entity**: document | **Operation**: duplicateCandidates
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: List duplicate target groups for a document
- **DE**: Duplikat-Zielgruppen eines Belegs auflisten

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| documentId | uuid | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
