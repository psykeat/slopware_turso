# Capability: `accounting.glAccount.update`

> **Module**: accounting | **Entity**: glAccount | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Update glAccount
- **DE**: glAccount ändern

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| id | uuid | No | |
| patch | record/map | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `glAccount`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
