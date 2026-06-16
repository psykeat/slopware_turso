# Capability: `masterdata.articleGroup.upsert`

> **Module**: masterdata | **Entity**: articleGroup | **Operation**: upsert
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Create or update an article group by code
- **DE**: Artikelgruppe per Code anlegen oder ändern

## Description
- **EN**: Code is the natural key: an existing active article group is patched, otherwise a new one is created (name required). Safe to retry.
- **DE**: Code ist der natürliche Schlüssel: eine vorhandene aktive Artikelgruppe wird gepatcht, sonst wird neu angelegt (Name erforderlich). Wiederholbar ohne Doppelanlage.

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| name | string | Yes | |
| taxClassId | uuid (nullable) | Yes | |
| baseUnitId | uuid (nullable) | Yes | |
| salesUnitId | uuid (nullable) | Yes | |
| purchaseUnitId | uuid (nullable) | Yes | |
| trackingMode | string (nullable) | Yes | |
| bomType | string | Yes | |
| printPositionTexts | boolean (nullable) | Yes | |
| code | string | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `articleGroup`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
