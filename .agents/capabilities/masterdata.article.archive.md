# Capability: `masterdata.article.archive`

> **Module**: masterdata | **Entity**: article | **Operation**: archive
> **Kind**: archive | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary
- **EN**: Archive an article
- **DE**: Artikel archivieren

## Description
- **EN**: Soft delete: the article is archived, never hard-deleted.
- **DE**: Soft Delete: der Artikel wird archiviert, nie hart gelöscht.

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| articleId | uuid | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `article`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
