# Capability: `system.tenantGroups.get`

> **Module**: system | **Entity**: tenantGroups | **Operation**: get
> **Kind**: read | **Min Role**: tenant_admin | **Exposure (LLM)**: safe

## Summary

- **EN**: Get tenantGroups
- **DE**: tenantGroups lesen

## Input Schema

| Field | Type | Optional | Description / Notes |
| :---- | :--- | :------- | :------------------ |
| id    | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
