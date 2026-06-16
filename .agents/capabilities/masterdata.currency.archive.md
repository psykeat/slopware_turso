# Capability: `masterdata.currency.archive`

> **Module**: masterdata | **Entity**: currency | **Operation**: archive
> **Kind**: archive | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary
- **EN**: Archive a currency
- **DE**: Währung archivieren

## Description
- **EN**: Soft delete: the currency is archived, never hard-deleted.
- **DE**: Soft Delete: die Währung wird archiviert, nie hart gelöscht.

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| currencyId | uuid | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `currency`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
