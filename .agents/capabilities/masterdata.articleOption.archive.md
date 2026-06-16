# Capability: `masterdata.articleOption.archive`

> **Module**: masterdata | **Entity**: articleOption | **Operation**: archive
> **Kind**: archive | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary
- **EN**: Archive an article option
- **DE**: Artikeloption archivieren

## Description
- **EN**: Soft delete: the article option is archived, never hard-deleted.
- **DE**: Soft Delete: die Artikeloption wird archiviert, nie hart gelöscht.

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| optionId | uuid | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `articleOption`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
