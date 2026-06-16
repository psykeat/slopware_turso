# Capability: `masterdata.taxRule.update`

> **Module**: masterdata | **Entity**: taxRule | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Update taxRule
- **DE**: taxRule ändern

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| id | uuid | No | |
| patch | record/map | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `taxRule`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
