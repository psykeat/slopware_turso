# Capability: `masterdata.article.list`

> **Module**: masterdata | **Entity**: article | **Operation**: list
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: List articles
- **DE**: Artikel auflisten

## Description
- **EN**: Archived articles are always excluded. Free-text search covers article number, name and text fields.
- **DE**: Archivierte Artikel sind immer ausgeschlossen. Die Freitextsuche umfasst Artikelnummer, Name und Textfelder.

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| articleGroupId | uuid | Yes | |
| search | string | Yes | |
| orderBy | string | Yes | |
| filterRules | array of object | Yes | |
| limit | number | No | |
| offset | number | No | |
| withTotal | boolean | Yes | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
