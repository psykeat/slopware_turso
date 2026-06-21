# Capability: `masterdata.currency.update`

> **Module**: masterdata | **Entity**: currency | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: hidden

## Summary

- **EN**: Update currency by id
- **DE**: currency per ID ändern

## Input Schema

| Field      | Type       | Optional | Description / Notes |
| :--------- | :--------- | :------- | :------------------ |
| currencyId | uuid       | No       |                     |
| patch      | record/map | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `currency`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
