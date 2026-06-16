# Capability: `masterdata.article.upsert`

> **Module**: masterdata | **Entity**: article | **Operation**: upsert
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Create or update an article by article number
- **DE**: Artikel per Artikelnummer anlegen oder ändern

## Description
- **EN**: articleNo is the natural key: an existing active article is patched, otherwise a new one is created (name required). Safe to retry.
- **DE**: articleNo ist der natürliche Schlüssel: ein vorhandener aktiver Artikel wird gepatcht, sonst wird neu angelegt (name erforderlich). Wiederholbar ohne Doppelanlage.

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| name | string | Yes | |
| description | string (nullable) | Yes | |
| kurzbeschreibung | string (nullable) | Yes | |
| langtext | string (nullable) | Yes | |
| notiztext | string (nullable) | Yes | |
| warntext | string (nullable) | Yes | |
| articleGroupId | uuid (nullable) | Yes | |
| taxClassId | uuid (nullable) | Yes | |
| baseUnitId | uuid (nullable) | Yes | |
| salesUnitId | uuid (nullable) | Yes | |
| purchaseUnitId | uuid (nullable) | Yes | |
| defaultWarehouseId | uuid (nullable) | Yes | |
| trackingMode | string (nullable) | Yes | |
| printPositionTexts | boolean (nullable) | Yes | |
| customAttributes | record/map (nullable) | Yes | |
| articleNo | string | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `article`, `articleVariant`
- **Side Effects**: "ensures a default article variant on create"
- **Idempotent**: Yes
- **Supports Dry Run**: No
