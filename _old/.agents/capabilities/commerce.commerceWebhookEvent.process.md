# Capability: `commerce.commerceWebhookEvent.process`

> **Module**: commerce | **Entity**: commerceWebhookEvent | **Operation**: process
> **Kind**: process | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary

- **EN**: Process pending shop webhook events
- **DE**: Ausstehende Shop-Webhook-Ereignisse verarbeiten

## Description

- **EN**: Drains pending (and due-for-retry) webhook events for a sales channel. checkout.order.placed triggers an inbound order import; other subscribed events are acknowledged.
- **DE**: Verarbeitet ausstehende (und faellige) Webhook-Ereignisse fuer einen Verkaufskanal. checkout.order.placed loest einen Bestell-Import aus; andere abonnierte Ereignisse werden bestaetigt.

## Input Schema

| Field          | Type   | Optional | Description / Notes |
| :------------- | :----- | :------- | :------------------ |
| salesChannelId | uuid   | No       |                     |
| limit          | number | Yes      |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `commerceWebhookEvent`, `commerceSyncRun`, `commerceSyncRunStep`, `externalSyncMapping`
- **Side Effects**: "may pull orders from the configured commerce platform"
- **Idempotent**: No
- **Supports Dry Run**: No
