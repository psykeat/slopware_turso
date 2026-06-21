# Capability: `commerce.salesChannel.testConnection`

> **Module**: commerce | **Entity**: salesChannel | **Operation**: testConnection
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary

- **EN**: Test the connection to a sales channel
- **DE**: Verbindung zum Verkaufskanal testen

## Description

- **EN**: Attempts an OAuth2 token fetch against the configured API URL to verify credentials.
- **DE**: Versucht einen OAuth2-Token-Abruf gegen die konfigurierte API-URL, um die Zugangsdaten zu prüfen.

## Input Schema

| Field       | Type    | Optional | Description / Notes |
| :---------- | :------ | :------- | :------------------ |
| apiUrl      | unknown | No       |                     |
| credentials | object  | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: None
- **Side Effects**: "performs an HTTP request to the configured shop API"
- **Idempotent**: Yes
- **Supports Dry Run**: No
