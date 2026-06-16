# Capability: `masterdata.paymentTerm.update`

> **Module**: masterdata | **Entity**: paymentTerm | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Update a payment term
- **DE**: Zahlungsbedingung ändern

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| paymentTermId | uuid | No | |
| patch | object | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `paymentTerm`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
