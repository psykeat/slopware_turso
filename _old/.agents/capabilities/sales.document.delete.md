# Capability: `sales.document.delete`

> **Module**: sales | **Entity**: document | **Operation**: delete
> **Kind**: archive | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary

- **EN**: Delete a document safely
- **DE**: Beleg sicher löschen

## Description

- **EN**: Business documents are never hard-deleted; drafts are cancelled and posted documents are reversed through the existing document lifecycle.
- **DE**: Belege werden nie hart gelöscht; Entwürfe werden storniert und gebuchte Belege über den bestehenden Beleg-Lifecycle rückgängig gemacht.

## Input Schema

| Field      | Type | Optional | Description / Notes |
| :--------- | :--- | :------- | :------------------ |
| documentId | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `document`, `documentLine`, `documentLineAllocation`, `inventoryMovement`, `inventoryBalance`, `serialNumber`
- **Side Effects**: "cancels the document or reverts its movements"
- **Idempotent**: No
- **Supports Dry Run**: No
