# Capability: `import.importProfile.create`

> **Module**: import | **Entity**: importProfile | **Operation**: create
> **Kind**: create | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Create an import profile
- **DE**: Import-Profil anlegen

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| slug | string | No | |
| label | string | No | |
| targetEntity | string | No | |
| targetCommandKey | string | No | |
| requiresApproval | boolean | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `importProfile`
- **Side Effects**: None
- **Idempotent**: No
- **Supports Dry Run**: No
