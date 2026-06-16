# Capability: `communication.emailThread.link`

> **Module**: communication | **Entity**: emailThread | **Operation**: link
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Link an email thread to an address and/or document
- **DE**: E-Mail-Thread mit Adresse und/oder Beleg verknüpfen

## Description
- **EN**: Pass null to unlink. Omitted fields stay unchanged.
- **DE**: Mit null wird die Verknüpfung entfernt. Nicht übergebene Felder bleiben unverändert.

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| threadId | uuid | No | |
| addressId | uuid (nullable) | Yes | |
| documentId | uuid (nullable) | Yes | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `emailThread`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
