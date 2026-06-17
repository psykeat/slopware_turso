# Capability: `commerce.salesChannel.create`

> **Module**: commerce | **Entity**: salesChannel | **Operation**: create
> **Kind**: create | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary
- **EN**: Create a sales channel
- **DE**: Verkaufskanal anlegen

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| name | string | No | |
| platform | unknown | No | |
| apiUrl | string | No | |
| credentials | object (nullable) | Yes | |
| masterDataPolicy | string (nullable) | Yes | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `salesChannel`
- **Side Effects**: None
- **Idempotent**: No
- **Supports Dry Run**: No
