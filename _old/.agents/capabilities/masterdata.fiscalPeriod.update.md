# Capability: `masterdata.fiscalPeriod.update`

> **Module**: masterdata | **Entity**: fiscalPeriod | **Operation**: update
> **Kind**: update | **Min Role**: tenant_admin | **Exposure (LLM)**: safe

## Summary

- **EN**: Update a fiscal period
- **DE**: Geschäftsperiode ändern

## Input Schema

| Field | Type   | Optional | Description / Notes |
| :---- | :----- | :------- | :------------------ |
| id    | uuid   | No       |                     |
| patch | object | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `fiscalPeriod`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
