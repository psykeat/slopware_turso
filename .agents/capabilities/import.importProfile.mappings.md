# Capability: `import.importProfile.mappings`

> **Module**: import | **Entity**: importProfile | **Operation**: mappings
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Get connector mappings for a profile
- **DE**: Connector-Mappings eines Profils lesen

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| profileId | uuid | No | |
| tenantConnectorId | uuid | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
