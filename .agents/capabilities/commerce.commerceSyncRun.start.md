# Capability: `commerce.commerceSyncRun.start`

> **Module**: commerce | **Entity**: commerceSyncRun | **Operation**: start
> **Kind**: process | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary
- **EN**: Start a commerce sync run
- **DE**: Shop-Abgleich starten

## Description
- **EN**: Runs the first modular outbound commerce sync slice. V1 supports push sync for addresses and articles.
- **DE**: Fuehrt den ersten modularen ausgehenden Shop-Abgleich aus. V1 unterstuetzt Push fuer Adressen und Artikel.

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| salesChannelId | uuid | No | |
| direction | unknown | No | |
| mode | unknown | No | |
| entities | array of unknown | No | |
| dryRun | boolean | Yes | |
| batchSize | number | Yes | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `commerceSyncRun`, `commerceSyncRunStep`, `externalSyncMapping`
- **Side Effects**: "pushes selected entities to the configured commerce platform unless dryRun is true"
- **Idempotent**: No
- **Supports Dry Run**: Yes
