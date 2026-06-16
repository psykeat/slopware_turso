# Capability: `masterdata.unit.upsert`

> **Module**: masterdata | **Entity**: unit | **Operation**: upsert
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Create or update a unit by code
- **DE**: Einheit per Code anlegen oder ändern

## Description
- **EN**: Code is the natural key: an existing active unit is patched, otherwise a new one is created (name required). Safe to retry.
- **DE**: Code ist der natürliche Schlüssel: eine vorhandene aktive Einheit wird gepatcht, sonst wird neu angelegt (Name erforderlich). Wiederholbar ohne Doppelanlage.

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| code | string | No | |
| name | record/map | Yes | |
| customAttributes | record/map (nullable) | Yes | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `unit`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
