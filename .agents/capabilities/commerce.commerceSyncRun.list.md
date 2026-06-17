# Capability: `commerce.commerceSyncRun.list`

> **Module**: commerce | **Entity**: commerceSyncRun | **Operation**: list
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: List commerce sync runs
- **DE**: Shop-Abgleiche auflisten

## Description
- **EN**: Returns recent commerce sync runs, newest first, optionally filtered by sales channel and status.
- **DE**: Gibt die letzten Shop-Abgleiche zurueck, neueste zuerst, optional gefiltert nach Verkaufskanal und Status.

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| salesChannelId | uuid | Yes | |
| status | string | Yes | |
| limit | number | Yes | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
