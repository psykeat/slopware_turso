# Capability: `import.bueroware.loadCatalog`

> **Module**: import | **Entity**: bueroware | **Operation**: loadCatalog
> **Kind**: create | **Min Role**: tenant_admin | **Exposure (LLM)**: hidden

## Summary

- **EN**: Load the central Büroware Satzbeschreibung catalog
- **DE**: Zentralen Büroware-Satzbeschreibungskatalog laden

## Description

- **EN**: Parses the whole Satzbeschreibung.csv into the central record-layout/field catalog (one layout per data area) and generates the central default field mapping per layout.
- **DE**: Parst die komplette Satzbeschreibung.csv in den zentralen Layout-/Feldkatalog (ein Layout pro Datenbereich) und erzeugt je Layout die zentrale Default-Feldzuweisung.

## Input Schema

| Field         | Type   | Optional | Description / Notes |
| :------------ | :----- | :------- | :------------------ |
| schemaCsvText | string | No       |                     |
| delimiter     | string | Yes      |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `buerowareRecordLayout`, `buerowareRecordField`, `importProfileMappingVersion`, `importFieldMapping`
- **Side Effects**: "replaces the active central Büroware catalog and default mappings"
- **Idempotent**: No
- **Supports Dry Run**: No
