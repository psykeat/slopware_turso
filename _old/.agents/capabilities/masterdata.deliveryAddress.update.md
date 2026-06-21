# Capability: `masterdata.deliveryAddress.update`

> **Module**: masterdata | **Entity**: deliveryAddress | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Update a delivery address
- **DE**: Lieferadresse ändern

## Input Schema

| Field             | Type   | Optional | Description / Notes |
| :---------------- | :----- | :------- | :------------------ |
| deliveryAddressId | uuid   | No       |                     |
| patch             | object | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `deliveryAddress`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
