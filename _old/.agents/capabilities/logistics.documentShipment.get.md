# Capability: `logistics.documentShipment.get`

> **Module**: logistics | **Entity**: documentShipment | **Operation**: get
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Get a document shipment
- **DE**: Belegsendung lesen

## Input Schema

| Field      | Type | Optional | Description / Notes |
| :--------- | :--- | :------- | :------------------ |
| documentId | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
