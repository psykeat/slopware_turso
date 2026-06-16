# Capability: `masterdata.articleCategory.create`

> **Module**: masterdata | **Entity**: articleCategory | **Operation**: create
> **Kind**: create | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Create an article category link
- **DE**: Artikel-Kategorien-Zuordnung anlegen

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| articleId | uuid | No | |
| categoryId | uuid | No | |
| sortOrder | number | Yes | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `articleCategory`
- **Side Effects**: None
- **Idempotent**: No
- **Supports Dry Run**: No
