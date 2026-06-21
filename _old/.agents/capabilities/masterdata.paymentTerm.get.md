# Capability: `masterdata.paymentTerm.get`

> **Module**: masterdata | **Entity**: paymentTerm | **Operation**: get
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Get a payment term by id
- **DE**: Zahlungsbedingung per ID lesen

## Input Schema

| Field         | Type | Optional | Description / Notes |
| :------------ | :--- | :------- | :------------------ |
| paymentTermId | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
