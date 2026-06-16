# Capability: `sales.document.convertCandidates`

> **Module**: sales | **Entity**: document | **Operation**: convertCandidates
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: List conversion target groups for a document
- **DE**: Wandlungs-Zielgruppen eines Belegs auflisten

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
