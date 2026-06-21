# Capability: `system.tenantLlmConfig.update`

> **Module**: system | **Entity**: tenantLlmConfig | **Operation**: update
> **Kind**: update | **Min Role**: tenant_admin | **Exposure (LLM)**: safe

## Summary

- **EN**: Update tenantLlmConfig
- **DE**: tenantLlmConfig ändern

## Input Schema

| Field | Type       | Optional | Description / Notes |
| :---- | :--------- | :------- | :------------------ |
| id    | uuid       | No       |                     |
| patch | record/map | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `tenantLlmConfig`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
