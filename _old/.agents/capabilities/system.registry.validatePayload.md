# Capability: `system.registry.validatePayload`

> **Module**: system | **Entity**: registry | **Operation**: validatePayload
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Validate payload
- **DE**: Payload pruefen

## Description

- **EN**: Validates a payload against the registry-derived API schema for an entity.
- **DE**: Prueft einen Payload gegen das aus der Registry abgeleitete API-Schema.

## Input Schema

| Field      | Type       | Optional | Description / Notes |
| :--------- | :--------- | :------- | :------------------ |
| entityName | string     | No       |                     |
| payload    | record/map | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
