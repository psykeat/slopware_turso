# Capability: `commerce.salesChannel.get`

> **Module**: commerce | **Entity**: salesChannel | **Operation**: get
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Get a sales channel by ID
- **DE**: Verkaufskanal per ID lesen

## Input Schema

| Field          | Type | Optional | Description / Notes |
| :------------- | :--- | :------- | :------------------ |
| salesChannelId | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
