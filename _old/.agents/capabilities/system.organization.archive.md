# Capability: `system.organization.archive`

> **Module**: system | **Entity**: organization | **Operation**: archive
> **Kind**: archive | **Min Role**: tenant_admin | **Exposure (LLM)**: confirm

## Summary

- **EN**: Archive organization
- **DE**: organization archivieren

## Input Schema

| Field | Type | Optional | Description / Notes |
| :---- | :--- | :------- | :------------------ |
| id    | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `organization`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
