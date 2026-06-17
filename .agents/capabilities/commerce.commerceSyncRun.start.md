# Capability: `commerce.commerceSyncRun.start`

> **Module**: commerce | **Entity**: commerceSyncRun | **Operation**: start
> **Kind**: process | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary
- **EN**: Start a commerce sync run
- **DE**: Shop-Abgleich starten

## Description
- **EN**: Runs the modular commerce sync. Outbound push (direction=push) for categories, addresses, media and articles, incremental by default; set forceFullSync to re-push everything. Inbound order import (direction=pull, entities=[document]) pulls shop orders as draft sales orders, incrementally by order date.
- **DE**: Fuehrt den modularen Shop-Abgleich aus. Ausgehender Push (direction=push) fuer Kategorien, Adressen, Medien und Artikel, standardmaessig inkrementell; forceFullSync erzwingt einen vollstaendigen Push. Eingehender Bestell-Import (direction=pull, entities=[document]) holt Shop-Bestellungen als Auftrags-Entwuerfe, inkrementell nach Bestelldatum.

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| salesChannelId | uuid | No | |
| direction | unknown | No | |
| mode | unknown | No | |
| entities | array of unknown | No | |
| dryRun | boolean | Yes | |
| batchSize | number | Yes | |
| forceFullSync | boolean | Yes | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `commerceSyncRun`, `commerceSyncRunStep`, `externalSyncMapping`
- **Side Effects**: "pushes selected entities to the configured commerce platform unless dryRun is true"
- **Idempotent**: No
- **Supports Dry Run**: Yes
