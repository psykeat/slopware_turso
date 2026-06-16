# Capability: `masterdata.articleGroup.archive`

> **Module**: masterdata | **Entity**: articleGroup | **Operation**: archive
> **Kind**: archive | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary
- **EN**: Archive an article group
- **DE**: Artikelgruppe archivieren

## Description
- **EN**: Soft delete: the article group is archived, never hard-deleted.
- **DE**: Soft Delete: die Artikelgruppe wird archiviert, nie hart gelöscht.

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| articleGroupId | uuid | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `articleGroup`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
