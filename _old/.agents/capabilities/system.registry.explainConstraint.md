# Capability: `system.registry.explainConstraint`

> **Module**: system | **Entity**: registry | **Operation**: explainConstraint
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Explain constraint
- **DE**: Constraint erklaeren

## Description

- **EN**: Explains a registry-known business constraint by id.
- **DE**: Erklaert eine in der Registry bekannte fachliche Constraint anhand ihrer ID.

## Input Schema

| Field   | Type   | Optional | Description / Notes |
| :------ | :----- | :------- | :------------------ |
| errorId | string | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
