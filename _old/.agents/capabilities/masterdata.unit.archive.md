# Capability: `masterdata.unit.archive`

> **Module**: masterdata | **Entity**: unit | **Operation**: archive
> **Kind**: archive | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary

- **EN**: Archive a unit
- **DE**: Einheit archivieren

## Description

- **EN**: Soft delete: the unit is archived, never hard-deleted.
- **DE**: Soft Delete: die Einheit wird archiviert, nie hart gelöscht.

## Input Schema

| Field  | Type | Optional | Description / Notes |
| :----- | :--- | :------- | :------------------ |
| unitId | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `unit`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
