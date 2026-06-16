# Capability: `commerce.commerceSyncDeadLetter.retry`

> **Module**: commerce | **Entity**: commerceSyncDeadLetter | **Operation**: retry
> **Kind**: process | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary
- **EN**: Retry pending commerce sync dead letter items
- **DE**: Fehlgeschlagene Shop-Sync-Eintraege erneut versuchen

## Description
- **EN**: Re-attempts all pending dead letter items whose next_retry_at has passed for a given sales channel.
- **DE**: Versucht alle faelligen ausstehenden DLQ-Eintraege fuer einen Verkaufskanal erneut.

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| salesChannelId | uuid | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `commerceSyncDeadLetter`, `externalSyncMapping`
- **Side Effects**: "pushes pending dead letter items to the configured commerce platform"
- **Idempotent**: No
- **Supports Dry Run**: No
