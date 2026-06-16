# Capability: `masterdata.article.search`

> **Module**: masterdata | **Entity**: article | **Operation**: search
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Search articles for lookup
- **DE**: Artikel für Lookup suchen

## Description
- **EN**: Type-ahead lookup over articleNo and name; returns a compact row for pickers.
- **DE**: Type-ahead-Lookup über Artikelnummer und Name; liefert eine kompakte Zeile für Picker.

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
