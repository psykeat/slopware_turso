# Capability: `masterdata.articleOptionValue.archive`

> **Module**: masterdata | **Entity**: articleOptionValue | **Operation**: archive
> **Kind**: archive | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary
- **EN**: Archive an article option value
- **DE**: Artikeloptionswert archivieren

## Description
- **EN**: Soft delete: the article option value is archived, never hard-deleted.
- **DE**: Soft Delete: der Artikeloptionswert wird archiviert, nie hart gelöscht.

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| valueId | uuid | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `articleOptionValue`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
