# Capability: `communication.emailThread.list`

> **Module**: communication | **Entity**: emailThread | **Operation**: list
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: List email threads
- **DE**: E-Mail-Threads auflisten

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| accountId | uuid | Yes | |
| labelId | string | Yes | |
| folder | string | Yes | |
| search | string | Yes | |
| limit | number | No | |
| offset | number | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
