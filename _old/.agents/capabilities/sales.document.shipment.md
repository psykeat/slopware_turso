# Capability: `sales.document.shipment`

> **Module**: sales | **Entity**: document | **Operation**: shipment
> **Kind**: process | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Resolve the shipment for a document
- **DE**: Sendung zum Beleg auflösen

## Input Schema

| Field      | Type | Optional | Description / Notes |
| :--------- | :--- | :------- | :------------------ |
| documentId | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `documentShipment`, `documentShipmentPackage`
- **Side Effects**: "creates a shipment when none exists"
- **Idempotent**: Yes
- **Supports Dry Run**: No
