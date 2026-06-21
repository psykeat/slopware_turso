# Capability: `system.tenantConnector.archive`

> **Module**: system | **Entity**: tenantConnector | **Operation**: archive
> **Kind**: archive | **Min Role**: tenant_admin | **Exposure (LLM)**: confirm

## Summary

- **EN**: Archive tenantConnector
- **DE**: tenantConnector archivieren

## Input Schema

| Field | Type | Optional | Description / Notes |
| :---- | :--- | :------- | :------------------ |
| id    | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `tenantConnector`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
