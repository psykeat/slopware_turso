# Capability: `masterdata.articleMedia.create`

> **Module**: masterdata | **Entity**: articleMedia | **Operation**: create
> **Kind**: create | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Create an article media link
- **DE**: Artikelmedien-Verknüpfung anlegen

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| articleId | uuid | No | |
| variantId | uuid (nullable) | Yes | |
| mediaAssetId | uuid | No | |
| role | string | Yes | |
| sortOrder | number | Yes | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `articleMedia`
- **Side Effects**: None
- **Idempotent**: No
- **Supports Dry Run**: No
