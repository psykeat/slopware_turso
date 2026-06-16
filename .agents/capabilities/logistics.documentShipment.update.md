# Capability: `logistics.documentShipment.update`

> **Module**: logistics | **Entity**: documentShipment | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Update a document shipment
- **DE**: Belegsendung ändern

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| documentId | uuid | No | |
| patch | record/map | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `documentShipment`, `documentShipmentPackage`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
