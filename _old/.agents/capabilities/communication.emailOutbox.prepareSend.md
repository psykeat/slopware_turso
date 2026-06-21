# Capability: `communication.emailOutbox.prepareSend`

> **Module**: communication | **Entity**: emailOutbox | **Operation**: prepareSend
> **Kind**: create | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Prepare a document email draft (no send)
- **DE**: Beleg-E-Mail-Entwurf vorbereiten (kein Versand)

## Description

- **EN**: Creates a draft outbox entry with resolved recipients, body and the document PDF attachment reference. Sending requires communication.emailOutbox.confirmSend with the returned outbox id. The PDF file itself must already be materialized by the caller (web layer renders it).
- **DE**: Erzeugt einen Outbox-Entwurf mit aufgelösten Empfängern, Text und PDF-Anhang-Referenz. Der Versand erfordert communication.emailOutbox.confirmSend mit der zurückgegebenen Outbox-Id. Die PDF-Datei selbst muss vom Aufrufer bereits materialisiert sein (Rendering liegt im Web-Layer).

## Input Schema

| Field           | Type              | Optional | Description / Notes |
| :-------------- | :---------------- | :------- | :------------------ |
| documentId      | uuid              | No       |                     |
| emailIdentityId | uuid              | No       |                     |
| templateId      | uuid (nullable)   | Yes      |                     |
| language        | string (nullable) | Yes      |                     |
| to              | array of object   | Yes      |                     |
| cc              | array of object   | Yes      |                     |
| bcc             | array of object   | Yes      |                     |
| subject         | string (nullable) | Yes      |                     |
| bodyText        | string (nullable) | Yes      |                     |
| bodyHtml        | string (nullable) | Yes      |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `emailThread`, `emailMessage`, `emailOutbox`, `emailAttachment`
- **Side Effects**: None
- **Idempotent**: No
- **Supports Dry Run**: No
