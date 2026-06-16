# Capability: `communication.emailTemplate.create`

> **Module**: communication | **Entity**: emailTemplate | **Operation**: create
> **Kind**: create | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Create emailTemplate
- **DE**: emailTemplate anlegen

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| category | string | No | |
| code | string | No | |
| name | string | No | |
| subjectTemplate | string | No | |
| bodyHtmlTemplate | string | No | |
| bodyTextTemplate | string (nullable) | Yes | |
| language | string (nullable) | Yes | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `emailTemplate`
- **Side Effects**: None
- **Idempotent**: No
- **Supports Dry Run**: No
