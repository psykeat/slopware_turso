# Capability: `system.registry.generateFixture`

> **Module**: system | **Entity**: registry | **Operation**: generateFixture
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Generate fixture
- **DE**: Fixture erzeugen

## Description

- **EN**: Creates a deterministic synthetic payload from the registry definition.
- **DE**: Erzeugt einen deterministischen synthetischen Payload aus der Registry-Definition.

## Input Schema

| Field      | Type   | Optional | Description / Notes |
| :--------- | :----- | :------- | :------------------ |
| entityName | string | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
