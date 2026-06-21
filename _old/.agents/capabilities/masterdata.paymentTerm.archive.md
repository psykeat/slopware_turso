# Capability: `masterdata.paymentTerm.archive`

> **Module**: masterdata | **Entity**: paymentTerm | **Operation**: archive
> **Kind**: archive | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary

- **EN**: Archive a payment term
- **DE**: Zahlungsbedingung archivieren

## Description

- **EN**: Soft delete: the payment term is archived, never hard-deleted.
- **DE**: Soft Delete: die Zahlungsbedingung wird archiviert, nie hart gelöscht.

## Input Schema

| Field         | Type | Optional | Description / Notes |
| :------------ | :--- | :------- | :------------------ |
| paymentTermId | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `paymentTerm`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
