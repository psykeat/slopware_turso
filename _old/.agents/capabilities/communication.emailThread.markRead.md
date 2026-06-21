# Capability: `communication.emailThread.markRead`

> **Module**: communication | **Entity**: emailThread | **Operation**: markRead
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Mark an email thread read/unread
- **DE**: E-Mail-Thread (un)gelesen markieren

## Input Schema

| Field    | Type    | Optional | Description / Notes |
| :------- | :------ | :------- | :------------------ |
| threadId | uuid    | No       |                     |
| read     | boolean | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `emailThread`, `emailMessage`
- **Side Effects**: "updates the read state at the email provider"
- **Idempotent**: Yes
- **Supports Dry Run**: No
