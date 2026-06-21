# Capability: `masterdata.address.archive`

> **Module**: masterdata | **Entity**: address | **Operation**: archive
> **Kind**: archive | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary

- **EN**: Archive an address
- **DE**: Adresse archivieren

## Description

- **EN**: Soft delete: the address is archived via archivedAt, never hard-deleted.
- **DE**: Soft Delete: die Adresse wird über archivedAt archiviert, nie hart gelöscht.

## Input Schema

| Field     | Type | Optional | Description / Notes |
| :-------- | :--- | :------- | :------------------ |
| addressId | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `address`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
