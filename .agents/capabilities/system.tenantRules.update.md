# Capability: `system.tenantRules.update`

> **Module**: system | **Entity**: tenantRules | **Operation**: update
> **Kind**: update | **Min Role**: tenant_admin | **Exposure (LLM)**: safe

## Summary
- **EN**: Update tenantRules
- **DE**: tenantRules ändern

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| id | uuid | No | |
| patch | record/map | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `tenantRules`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
