# Capability: `import.bueroware.bootstrap`

> **Module**: import | **Entity**: bueroware | **Operation**: bootstrap
> **Kind**: create | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Bootstrap a Büroware mapping from Satzbeschreibung.csv
- **DE**: Büroware-Mapping aus Satzbeschreibung.csv erzeugen

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| profileId | uuid | No | |
| tenantConnectorId | uuid | No | |
| schemaCsvText | string | No | |
| targetFileName | string | No | |
| delimiter | string | Yes | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `importProfileMappingVersion`, `importFieldMapping`
- **Side Effects**: None
- **Idempotent**: No
- **Supports Dry Run**: No
