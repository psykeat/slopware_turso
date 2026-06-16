# Capability: `communication.emailTemplate.archive`

> **Module**: communication | **Entity**: emailTemplate | **Operation**: archive
> **Kind**: archive | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary
- **EN**: Archive emailTemplate
- **DE**: emailTemplate archivieren

## Description
- **EN**: Soft delete: the record is archived, never hard-deleted.
- **DE**: Soft Delete: der Datensatz wird archiviert, nie hart gelöscht.

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| id | uuid | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `emailTemplate`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
