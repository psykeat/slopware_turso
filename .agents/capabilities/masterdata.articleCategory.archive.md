# Capability: `masterdata.articleCategory.archive`

> **Module**: masterdata | **Entity**: articleCategory | **Operation**: archive
> **Kind**: archive | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary
- **EN**: Archive an article category link
- **DE**: Artikel-Kategorien-Zuordnung archivieren

## Description
- **EN**: Soft delete: the article-category link is archived, never hard-deleted.
- **DE**: Soft Delete: die Artikel-Kategorien-Zuordnung wird archiviert, nie hart gelöscht.

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| articleCategoryId | uuid | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `articleCategory`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
