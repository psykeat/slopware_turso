# Capability: `masterdata.articleMedia.archive`

> **Module**: masterdata | **Entity**: articleMedia | **Operation**: archive
> **Kind**: archive | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary

- **EN**: Archive an article media link
- **DE**: Artikelmedien-Verknüpfung archivieren

## Description

- **EN**: Soft delete: the article media link is archived, never hard-deleted.
- **DE**: Soft Delete: die Artikelmedien-Verknüpfung wird archiviert, nie hart gelöscht.

## Input Schema

| Field          | Type | Optional | Description / Notes |
| :------------- | :--- | :------- | :------------------ |
| articleMediaId | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `articleMedia`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
