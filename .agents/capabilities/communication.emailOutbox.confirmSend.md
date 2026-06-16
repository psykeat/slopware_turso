# Capability: `communication.emailOutbox.confirmSend`

> **Module**: communication | **Entity**: emailOutbox | **Operation**: confirmSend
> **Kind**: process | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary
- **EN**: Send a prepared email draft
- **DE**: Vorbereiteten E-Mail-Entwurf versenden

## Description
- **EN**: Final, irreversible send of a draft created by prepareSend (or the drafts UI). The outbox id is the confirmation token.
- **DE**: Finaler, nicht umkehrbarer Versand eines mit prepareSend (oder dem Drafts-UI) erzeugten Entwurfs. Die Outbox-Id ist das Bestätigungstoken.

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| outboxId | uuid | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `emailOutbox`, `emailMessage`, `emailThread`
- **Side Effects**: "sends the email through the provider"
- **Idempotent**: No
- **Supports Dry Run**: No
