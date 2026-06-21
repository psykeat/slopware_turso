# Capability: `import.importProfile.saveMappings`

> **Module**: import | **Entity**: importProfile | **Operation**: saveMappings
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Replace connector mappings for a profile
- **DE**: Connector-Mappings eines Profils ersetzen

## Input Schema

| Field             | Type            | Optional | Description / Notes |
| :---------------- | :-------------- | :------- | :------------------ |
| profileId         | uuid            | No       |                     |
| tenantConnectorId | uuid            | No       |                     |
| rows              | array of object | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `tenantConnectorMapping`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
