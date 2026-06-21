# Capability: `masterdata.taxClass.archive`

> **Module**: masterdata | **Entity**: taxClass | **Operation**: archive
> **Kind**: archive | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary

- **EN**: Archive taxClass
- **DE**: taxClass archivieren

## Input Schema

| Field | Type | Optional | Description / Notes |
| :---- | :--- | :------- | :------------------ |
| id    | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `taxClass`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
