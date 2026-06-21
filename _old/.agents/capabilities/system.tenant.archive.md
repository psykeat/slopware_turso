# Capability: `system.tenant.archive`

> **Module**: system | **Entity**: tenant | **Operation**: archive
> **Kind**: archive | **Min Role**: tenant_admin | **Exposure (LLM)**: confirm

## Summary

- **EN**: Archive tenant
- **DE**: tenant archivieren

## Input Schema

| Field | Type | Optional | Description / Notes |
| :---- | :--- | :------- | :------------------ |
| id    | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `tenant`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
