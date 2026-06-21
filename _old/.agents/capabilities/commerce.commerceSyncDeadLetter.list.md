# Capability: `commerce.commerceSyncDeadLetter.list`

> **Module**: commerce | **Entity**: commerceSyncDeadLetter | **Operation**: list
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: List commerce sync dead letter items
- **DE**: Fehlgeschlagene Shop-Sync-Eintraege auflisten

## Description

- **EN**: Returns pending, resolved, or abandoned items from the commerce sync dead letter queue.
- **DE**: Gibt ausstehende, aufgeloeste oder aufgegebene Eintraege aus der Shop-Sync-Warteschlange zurueck.

## Input Schema

| Field          | Type    | Optional | Description / Notes |
| :------------- | :------ | :------- | :------------------ |
| salesChannelId | uuid    | Yes      |                     |
| status         | unknown | Yes      |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
