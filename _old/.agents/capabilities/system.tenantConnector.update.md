# Capability: `system.tenantConnector.update`

> **Module**: system | **Entity**: tenantConnector | **Operation**: update
> **Kind**: update | **Min Role**: tenant_admin | **Exposure (LLM)**: safe

## Summary

- **EN**: Update tenantConnector
- **DE**: tenantConnector ändern

## Input Schema

| Field | Type       | Optional | Description / Notes |
| :---- | :--------- | :------- | :------------------ |
| id    | uuid       | No       |                     |
| patch | record/map | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `tenantConnector`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
