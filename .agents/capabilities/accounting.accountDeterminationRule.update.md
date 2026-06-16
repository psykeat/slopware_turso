# Capability: `accounting.accountDeterminationRule.update`

> **Module**: accounting | **Entity**: accountDeterminationRule | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Update accountDeterminationRule
- **DE**: accountDeterminationRule ändern

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| id | uuid | No | |
| patch | record/map | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `accountDeterminationRule`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
