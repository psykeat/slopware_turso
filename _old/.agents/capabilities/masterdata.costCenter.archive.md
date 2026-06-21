# Capability: `masterdata.costCenter.archive`

> **Module**: masterdata | **Entity**: costCenter | **Operation**: archive
> **Kind**: archive | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary

- **EN**: Archive costCenter
- **DE**: costCenter archivieren

## Input Schema

| Field | Type | Optional | Description / Notes |
| :---- | :--- | :------- | :------------------ |
| id    | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `costCenter`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
