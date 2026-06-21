# Capability: `logistics.documentShipment.list`

> **Module**: logistics | **Entity**: documentShipment | **Operation**: list
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: List document shipments
- **DE**: Belegsendungen auflisten

## Input Schema

| Field   | Type       | Optional | Description / Notes |
| :------ | :--------- | :------- | :------------------ |
| filters | record/map | No       |                     |
| search  | string     | Yes      |                     |
| limit   | number     | No       |                     |
| offset  | number     | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
