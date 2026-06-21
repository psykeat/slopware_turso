# Capability: `communication.emailTemplateBinding.archive`

> **Module**: communication | **Entity**: emailTemplateBinding | **Operation**: archive
> **Kind**: archive | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary

- **EN**: Archive emailTemplateBinding
- **DE**: emailTemplateBinding archivieren

## Description

- **EN**: Soft delete: the record is archived, never hard-deleted.
- **DE**: Soft Delete: der Datensatz wird archiviert, nie hart gelöscht.

## Input Schema

| Field | Type | Optional | Description / Notes |
| :---- | :--- | :------- | :------------------ |
| id    | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `emailTemplateBinding`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
