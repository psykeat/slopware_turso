# Capability: `masterdata.priceList.archive`

> **Module**: masterdata | **Entity**: priceList | **Operation**: archive
> **Kind**: archive | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary
- **EN**: Archive a price list
- **DE**: Preisliste archivieren

## Description
- **EN**: Soft delete: the price list is archived, never hard-deleted.
- **DE**: Soft Delete: die Preisliste wird archiviert, nie hart gelöscht.

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| priceListId | uuid | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `priceList`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
