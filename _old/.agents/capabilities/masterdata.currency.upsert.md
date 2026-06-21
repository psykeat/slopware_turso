# Capability: `masterdata.currency.upsert`

> **Module**: masterdata | **Entity**: currency | **Operation**: upsert
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Create or update a currency by code
- **DE**: Währung per Code anlegen oder ändern

## Description

- **EN**: Code is the natural key: an existing currency is patched, otherwise a new one is created (name required).
- **DE**: Der Code ist der natürliche Schlüssel: eine vorhandene Währung wird gepatcht, sonst wird neu angelegt (Name erforderlich).

## Input Schema

| Field    | Type              | Optional | Description / Notes |
| :------- | :---------------- | :------- | :------------------ |
| name     | record/map        | No       |                     |
| symbol   | string (nullable) | Yes      |                     |
| decimals | number            | Yes      |                     |
| code     | string            | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `currency`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
