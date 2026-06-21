# Capability: `masterdata.incoterm.archive`

> **Module**: masterdata | **Entity**: incoterm | **Operation**: archive
> **Kind**: archive | **Min Role**: tenant_admin | **Exposure (LLM)**: confirm

## Summary

- **EN**: Archive incoterm
- **DE**: incoterm archivieren

## Input Schema

| Field | Type | Optional | Description / Notes |
| :---- | :--- | :------- | :------------------ |
| id    | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `incoterm`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
