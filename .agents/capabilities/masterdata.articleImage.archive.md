# Capability: `masterdata.articleImage.archive`

> **Module**: masterdata | **Entity**: articleImage | **Operation**: archive
> **Kind**: archive | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary
- **EN**: Archive an article image
- **DE**: Artikelbild archivieren

## Description
- **EN**: Soft delete: the article image is archived, never hard-deleted.
- **DE**: Soft Delete: das Artikelbild wird archiviert, nie hart gelöscht.

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| articleImageId | uuid | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `articleImage`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
