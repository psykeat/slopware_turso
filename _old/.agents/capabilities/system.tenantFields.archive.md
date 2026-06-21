# Capability: `system.tenantFields.archive`

> **Module**: system | **Entity**: tenantFields | **Operation**: archive
> **Kind**: archive | **Min Role**: tenant_admin | **Exposure (LLM)**: confirm

## Summary

- **EN**: Archive tenantFields
- **DE**: tenantFields archivieren

## Input Schema

| Field | Type | Optional | Description / Notes |
| :---- | :--- | :------- | :------------------ |
| id    | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `tenantFields`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
