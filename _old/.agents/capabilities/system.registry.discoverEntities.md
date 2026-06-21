# Capability: `system.registry.discoverEntities`

> **Module**: system | **Entity**: registry | **Operation**: discoverEntities
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Discover entities
- **DE**: Entitaeten entdecken

## Description

- **EN**: Lists TypeScript registry entities and their stable metadata summary.
- **DE**: Listet Entitaeten aus der TypeScript-Registry mit stabiler Metadaten-Zusammenfassung.

## Input Schema

| Field      | Type   | Optional | Description / Notes |
| :--------- | :----- | :------- | :------------------ |
| module     | string | Yes      |                     |
| entityName | string | Yes      |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
