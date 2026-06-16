# Capability: `import.importProfile.activateMapping`

> **Module**: import | **Entity**: importProfile | **Operation**: activateMapping
> **Kind**: process | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Activate the current mapping as a version
- **DE**: Aktuelles Mapping als Version aktivieren

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| profileId | uuid | No | |
| tenantConnectorId | uuid | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `importProfileMappingVersion`, `tenantConnectorMapping`
- **Side Effects**: None
- **Idempotent**: No
- **Supports Dry Run**: No
