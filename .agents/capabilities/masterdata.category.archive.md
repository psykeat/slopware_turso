# Capability: `masterdata.category.archive`

> **Module**: masterdata | **Entity**: category | **Operation**: archive
> **Kind**: archive | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary
- **EN**: Archive a category
- **DE**: Kategorie archivieren

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| categoryId | uuid | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `category`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
