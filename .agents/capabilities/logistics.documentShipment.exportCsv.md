# Capability: `logistics.documentShipment.exportCsv`

> **Module**: logistics | **Entity**: documentShipment | **Operation**: exportCsv
> **Kind**: process | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Export shipments as CSV
- **DE**: Sendungen als CSV exportieren

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| documentIds | array of uuid | No | |

## Output Schema
- **Type**: `string`

## Invariants & Side Effects
- **Writes Tables**: `documentShipment`
- **Side Effects**: "marks shipments as exported"
- **Idempotent**: No
- **Supports Dry Run**: No
