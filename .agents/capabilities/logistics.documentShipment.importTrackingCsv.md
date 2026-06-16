# Capability: `logistics.documentShipment.importTrackingCsv`

> **Module**: logistics | **Entity**: documentShipment | **Operation**: importTrackingCsv
> **Kind**: process | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Import tracking CSV
- **DE**: Tracking-CSV importieren

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| csvContent | string | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `documentShipment`
- **Side Effects**: "updates tracking IDs and statuses"
- **Idempotent**: No
- **Supports Dry Run**: No
