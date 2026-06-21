# Capability: `logistics.documentShipment.savePackages`

> **Module**: logistics | **Entity**: documentShipment | **Operation**: savePackages
> **Kind**: process | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Replace shipment packages
- **DE**: Sendungspakete ersetzen

## Input Schema

| Field              | Type            | Optional | Description / Notes |
| :----------------- | :-------------- | :------- | :------------------ |
| documentShipmentId | uuid            | No       |                     |
| packageLines       | array of object | No       |                     |

## Output Schema

- **Type**: `array of object`

## Invariants & Side Effects

- **Writes Tables**: `documentShipmentPackage`
- **Side Effects**: "replaces all package rows for the shipment"
- **Idempotent**: Yes
- **Supports Dry Run**: No
