# Capability: `system.registry.resolveProjection`

> **Module**: system | **Entity**: registry | **Operation**: resolveProjection
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Resolve projection
- **DE**: Projektion aufloesen

## Description

- **EN**: Returns list/form/lookup/api/ai projection metadata for one registry entity.
- **DE**: Liefert List/Form/Lookup/API/AI-Projektionsmetadaten fuer eine Registry-Entitaet.

## Input Schema

| Field      | Type    | Optional | Description / Notes |
| :--------- | :------ | :------- | :------------------ |
| entityName | string  | No       |                     |
| type       | unknown | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
