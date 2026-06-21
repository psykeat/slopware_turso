# Capability: `masterdata.industry.archive`

> **Module**: masterdata | **Entity**: industry | **Operation**: archive
> **Kind**: archive | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary

- **EN**: Archive industry
- **DE**: industry archivieren

## Input Schema

| Field | Type | Optional | Description / Notes |
| :---- | :--- | :------- | :------------------ |
| id    | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `industry`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
