# Capability: `masterdata.fiscalPeriod.create`

> **Module**: masterdata | **Entity**: fiscalPeriod | **Operation**: create
> **Kind**: create | **Min Role**: tenant_admin | **Exposure (LLM)**: safe

## Summary

- **EN**: Create a fiscal period
- **DE**: Geschäftsperiode anlegen

## Input Schema

| Field      | Type    | Optional | Description / Notes |
| :--------- | :------ | :------- | :------------------ |
| companyId  | uuid    | No       |                     |
| fiscalYear | number  | No       |                     |
| periodNo   | number  | No       |                     |
| startDate  | string  | No       |                     |
| endDate    | string  | No       |                     |
| isClosed   | boolean | Yes      |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `fiscalPeriod`
- **Side Effects**: None
- **Idempotent**: No
- **Supports Dry Run**: No
