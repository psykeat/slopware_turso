# Capability: `communication.emailThread.archive`

> **Module**: communication | **Entity**: emailThread | **Operation**: archive
> **Kind**: archive | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Archive an email thread
- **DE**: E-Mail-Thread archivieren

## Description

- **EN**: Soft-archives the thread and removes it from the provider inbox. No data is deleted.
- **DE**: Archiviert den Thread (soft) und entfernt ihn aus der Provider-Inbox. Es werden keine Daten gelöscht.

## Input Schema

| Field    | Type | Optional | Description / Notes |
| :------- | :--- | :------- | :------------------ |
| threadId | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `emailThread`
- **Side Effects**: "removes the INBOX label at the email provider"
- **Idempotent**: Yes
- **Supports Dry Run**: No
