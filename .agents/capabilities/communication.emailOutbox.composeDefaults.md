# Capability: `communication.emailOutbox.composeDefaults`

> **Module**: communication | **Entity**: emailOutbox | **Operation**: composeDefaults
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Resolve compose defaults for a document email
- **DE**: Compose-Vorgaben für eine Beleg-E-Mail ermitteln

## Description
- **EN**: Resolves recipient, subject, body and attachment defaults for sending a document by email. Read-only — nothing is created or sent.
- **DE**: Ermittelt Empfänger, Betreff, Text und Anhang-Vorgaben für den Belegversand per E-Mail. Nur lesend — es wird nichts angelegt oder versendet.

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| documentId | uuid | No | |
| emailIdentityId | uuid | No | |
| templateId | uuid (nullable) | Yes | |
| language | string (nullable) | Yes | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
