# Capability: `masterdata.paymentTerm.create`

> **Module**: masterdata | **Entity**: paymentTerm | **Operation**: create
> **Kind**: create | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Create a payment term
- **DE**: Zahlungsbedingung anlegen

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| name | record/map | No | |
| netDays | number | No | |
| discountDays | number (nullable) | Yes | |
| discountPercentage | unknown (nullable) | Yes | |
| customAttributes | record/map (nullable) | Yes | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `paymentTerm`
- **Side Effects**: None
- **Idempotent**: No
- **Supports Dry Run**: No
