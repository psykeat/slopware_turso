# Capability: `import.importProfile.update`

> **Module**: import | **Entity**: importProfile | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Update an import profile
- **DE**: Import-Profil ändern

## Input Schema

| Field     | Type   | Optional | Description / Notes |
| :-------- | :----- | :------- | :------------------ |
| profileId | uuid   | No       |                     |
| patch     | object | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `importProfile`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
