# Capability: `commerce.salesChannel.update`

> **Module**: commerce | **Entity**: salesChannel | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary

- **EN**: Update a sales channel
- **DE**: Verkaufskanal aktualisieren

## Input Schema

| Field          | Type   | Optional | Description / Notes |
| :------------- | :----- | :------- | :------------------ |
| salesChannelId | uuid   | No       |                     |
| patch          | object | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `salesChannel`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
