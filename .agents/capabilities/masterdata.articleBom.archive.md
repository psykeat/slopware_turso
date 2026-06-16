# Capability: `masterdata.articleBom.archive`

> **Module**: masterdata | **Entity**: articleBom | **Operation**: archive
> **Kind**: archive | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary
- **EN**: Archive a BOM row
- **DE**: Stücklistenposition archivieren

## Description
- **EN**: Soft delete: the BOM row is archived, never hard-deleted.
- **DE**: Soft Delete: die Stücklistenposition wird archiviert, nie hart gelöscht.

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| bomId | uuid | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `articleBom`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
