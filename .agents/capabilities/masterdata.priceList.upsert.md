# Capability: `masterdata.priceList.upsert`

> **Module**: masterdata | **Entity**: priceList | **Operation**: upsert
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Create or update a price list by name
- **DE**: Preisliste per Name anlegen oder ändern

## Description
- **EN**: Name is the natural key inside a tenant: an existing price list is patched, otherwise a new one is created (currencyId required).
- **DE**: Der Name ist der natürliche Schlüssel im Tenant: eine vorhandene Preisliste wird gepatcht, sonst wird neu angelegt (currencyId erforderlich).

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| name | string | No | |
| currencyId | string | Yes | |
| isNet | boolean | Yes | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `priceList`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
