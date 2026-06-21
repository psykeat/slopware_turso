# Capability: `masterdata.addressContact.search`

> **Module**: masterdata | **Entity**: addressContact | **Operation**: search
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Search contacts for lookup
- **DE**: Kontakte für Lookup suchen

## Description

- **EN**: Type-ahead lookup over contact name, email and external identity values; returns a compact row with a display name for pickers.
- **DE**: Type-ahead-Lookup über Kontaktname, E-Mail und externe Identitätswerte; liefert eine kompakte Zeile mit Anzeigename für Picker.

## Input Schema

| Field | Type   | Optional | Description / Notes |
| :---- | :----- | :------- | :------------------ |
| q     | string | No       |                     |
| limit | number | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
