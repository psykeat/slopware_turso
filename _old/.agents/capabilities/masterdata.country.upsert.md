# Capability: `masterdata.country.upsert`

> **Module**: masterdata | **Entity**: country | **Operation**: upsert
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Create or update a country by ISO2 code
- **DE**: Land per ISO2-Code anlegen oder ändern

## Description

- **EN**: ISO2 code is the natural key: an existing country is patched, otherwise a new one is created (ISO3, name required).
- **DE**: Der ISO2-Code ist der natürliche Schlüssel: ein vorhandenes Land wird gepatcht, sonst wird neu angelegt (ISO3, Name erforderlich).

## Input Schema

| Field    | Type       | Optional | Description / Notes |
| :------- | :--------- | :------- | :------------------ |
| iso3Code | string     | No       |                     |
| name     | record/map | No       |                     |
| isEu     | boolean    | Yes      |                     |
| iso2Code | string     | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `country`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
