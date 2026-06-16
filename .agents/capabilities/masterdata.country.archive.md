# Capability: `masterdata.country.archive`

> **Module**: masterdata | **Entity**: country | **Operation**: archive
> **Kind**: archive | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary
- **EN**: Archive a country
- **DE**: Land archivieren

## Description
- **EN**: Soft delete: the country is archived, never hard-deleted.
- **DE**: Soft Delete: das Land wird archiviert, nie hart gelöscht.

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| countryId | uuid | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `country`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
