# Capability: `masterdata.address.search`

> **Module**: masterdata | **Entity**: address | **Operation**: search
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Search addresses for lookup
- **DE**: Adressen für Lookup suchen

## Description
- **EN**: Type-ahead lookup over addressNo, company, city and search text.
- **DE**: Type-ahead-Lookup über Adressnummer, Firma, Ort und Suchtext.

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| q | string | No | |
| limit | number | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
