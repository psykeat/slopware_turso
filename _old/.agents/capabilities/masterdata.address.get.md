# Capability: `masterdata.address.get`

> **Module**: masterdata | **Entity**: address | **Operation**: get
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Get an address by id
- **DE**: Adresse per ID lesen

## Input Schema

| Field     | Type | Optional | Description / Notes |
| :-------- | :--- | :------- | :------------------ |
| addressId | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
