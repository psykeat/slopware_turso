# Capability: `masterdata.bankAccount.archive`

> **Module**: masterdata | **Entity**: bankAccount | **Operation**: archive
> **Kind**: archive | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary

- **EN**: Archive bankAccount
- **DE**: bankAccount archivieren

## Input Schema

| Field | Type | Optional | Description / Notes |
| :---- | :--- | :------- | :------------------ |
| id    | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `bankAccount`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
