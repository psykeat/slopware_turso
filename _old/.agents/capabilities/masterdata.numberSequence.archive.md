# Capability: `masterdata.numberSequence.archive`

> **Module**: masterdata | **Entity**: numberSequence | **Operation**: archive
> **Kind**: archive | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary

- **EN**: Archive numberSequence
- **DE**: numberSequence archivieren

## Input Schema

| Field | Type | Optional | Description / Notes |
| :---- | :--- | :------- | :------------------ |
| id    | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `numberSequence`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
