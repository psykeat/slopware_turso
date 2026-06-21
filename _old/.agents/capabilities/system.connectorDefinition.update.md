# Capability: `system.connectorDefinition.update`

> **Module**: system | **Entity**: connectorDefinition | **Operation**: update
> **Kind**: update | **Min Role**: tenant_admin | **Exposure (LLM)**: safe

## Summary

- **EN**: Update connectorDefinition
- **DE**: connectorDefinition ändern

## Input Schema

| Field | Type       | Optional | Description / Notes |
| :---- | :--------- | :------- | :------------------ |
| id    | uuid       | No       |                     |
| patch | record/map | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `connectorDefinition`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
