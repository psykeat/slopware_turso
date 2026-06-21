# Capability: `commerce.salesChannel.archive`

> **Module**: commerce | **Entity**: salesChannel | **Operation**: archive
> **Kind**: archive | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary

- **EN**: Deactivate a sales channel
- **DE**: Verkaufskanal deaktivieren

## Input Schema

| Field          | Type | Optional | Description / Notes |
| :------------- | :--- | :------- | :------------------ |
| salesChannelId | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `salesChannel`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
