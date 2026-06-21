# Capability: `masterdata.postalCode.archive`

> **Module**: masterdata | **Entity**: postalCode | **Operation**: archive
> **Kind**: archive | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary

- **EN**: Archive postalCode
- **DE**: postalCode archivieren

## Input Schema

| Field | Type | Optional | Description / Notes |
| :---- | :--- | :------- | :------------------ |
| id    | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `postalCode`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
