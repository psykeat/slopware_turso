# Capability: `logistics.documentShipmentPackage.list`

> **Module**: logistics | **Entity**: documentShipmentPackage | **Operation**: list
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: List shipment packages
- **DE**: Sendungspakete auflisten

## Input Schema

| Field              | Type   | Optional | Description / Notes |
| :----------------- | :----- | :------- | :------------------ |
| documentShipmentId | uuid   | Yes      |                     |
| search             | string | Yes      |                     |
| limit              | number | No       |                     |
| offset             | number | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
