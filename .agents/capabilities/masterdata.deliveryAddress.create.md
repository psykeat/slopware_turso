# Capability: `masterdata.deliveryAddress.create`

> **Module**: masterdata | **Entity**: deliveryAddress | **Operation**: create
> **Kind**: create | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Create a delivery address
- **DE**: Lieferadresse anlegen

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| addressId | uuid | No | |
| name | string (nullable) | Yes | |
| addressLine1 | string | No | |
| addressLine2 | string (nullable) | Yes | |
| postalCode | string | No | |
| city | string | No | |
| countryCode | string | No | |
| defaultForShipping | boolean | Yes | |
| customAttributes | record/map (nullable) | Yes | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `deliveryAddress`
- **Side Effects**: None
- **Idempotent**: No
- **Supports Dry Run**: No
