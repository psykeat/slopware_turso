# Capability: `commerce.commerceSyncRun.cancel`

> **Module**: commerce | **Entity**: commerceSyncRun | **Operation**: cancel
> **Kind**: process | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary
- **EN**: Cancel a commerce sync run
- **DE**: Shop-Abgleich abbrechen

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| runId | uuid | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `commerceSyncRun`
- **Side Effects**: "marks the run for cancellation"
- **Idempotent**: Yes
- **Supports Dry Run**: No
