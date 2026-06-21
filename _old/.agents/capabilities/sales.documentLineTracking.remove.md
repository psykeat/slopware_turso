# Capability: `sales.documentLineTracking.remove`

> **Module**: sales | **Entity**: documentLineTracking | **Operation**: remove
> **Kind**: archive | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Remove a tracking row
- **DE**: Tracking-Zeile entfernen

## Description

- **EN**: Tracking rows are pre-posting working data; removing one deletes the row (the underlying movements stay untouched).
- **DE**: Tracking-Zeilen sind Arbeitsdaten vor der Verbuchung; das Entfernen löscht die Zeile (Bewegungen bleiben unberührt).

## Input Schema

| Field          | Type | Optional | Description / Notes |
| :------------- | :--- | :------- | :------------------ |
| documentId     | uuid | No       |                     |
| documentLineId | uuid | No       |                     |
| trackingId     | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `documentLineTracking`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
