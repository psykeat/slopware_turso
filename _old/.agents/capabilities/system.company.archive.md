# Capability: `system.company.archive`

> **Module**: system | **Entity**: company | **Operation**: archive
> **Kind**: archive | **Min Role**: tenant_admin | **Exposure (LLM)**: confirm

## Summary

- **EN**: Archive company
- **DE**: company archivieren

## Input Schema

| Field | Type | Optional | Description / Notes |
| :---- | :--- | :------- | :------------------ |
| id    | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `company`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
