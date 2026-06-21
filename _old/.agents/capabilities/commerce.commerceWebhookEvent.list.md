# Capability: `commerce.commerceWebhookEvent.list`

> **Module**: commerce | **Entity**: commerceWebhookEvent | **Operation**: list
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: List inbound shop webhook events
- **DE**: Eingehende Shop-Webhook-Ereignisse auflisten

## Description

- **EN**: Returns recent inbound webhook events (e.g. Shopware App-System), newest first, optionally filtered by sales channel and status.
- **DE**: Gibt die letzten eingehenden Webhook-Ereignisse (z. B. Shopware App-System) zurueck, neueste zuerst, optional gefiltert nach Verkaufskanal und Status.

## Input Schema

| Field          | Type    | Optional | Description / Notes |
| :------------- | :------ | :------- | :------------------ |
| salesChannelId | uuid    | Yes      |                     |
| status         | unknown | Yes      |                     |
| limit          | number  | Yes      |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
