# Capability: `communication.emailTemplate.update`

> **Module**: communication | **Entity**: emailTemplate | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Update emailTemplate
- **DE**: emailTemplate ändern

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| id | uuid | No | |
| patch | object | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `emailTemplate`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
