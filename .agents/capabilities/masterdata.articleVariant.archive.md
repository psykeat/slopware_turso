# Capability: `masterdata.articleVariant.archive`

> **Module**: masterdata | **Entity**: articleVariant | **Operation**: archive
> **Kind**: archive | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary
- **EN**: Archive article variants
- **DE**: Artikelvarianten archivieren

## Description
- **EN**: Soft delete: variants are deactivated and their inventory items are marked untracked.
- **DE**: Soft Delete: Varianten werden deaktiviert und ihre Lagerartikel als nicht verfolgt markiert.

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| articleId | uuid | No | |
| variantIds | array of uuid | Yes | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `articleVariant`, `inventoryItem`
- **Side Effects**: "marks inventory items as untracked"
- **Idempotent**: Yes
- **Supports Dry Run**: No
