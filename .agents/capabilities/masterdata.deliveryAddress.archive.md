# Capability: `masterdata.deliveryAddress.archive`

> **Module**: masterdata | **Entity**: deliveryAddress | **Operation**: archive
> **Kind**: archive | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary
- **EN**: Archive a delivery address
- **DE**: Lieferadresse archivieren

## Description
- **EN**: Soft delete: the delivery address is archived, never hard-deleted.
- **DE**: Soft Delete: die Lieferadresse wird archiviert, nie hart gelöscht.

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| deliveryAddressId | uuid | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `deliveryAddress`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
