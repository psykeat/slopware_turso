# Capability: `masterdata.agent.get`

> **Module**: masterdata | **Entity**: agent | **Operation**: get
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Get a sales agent by id
- **DE**: Vertreter per ID lesen

## Input Schema

| Field   | Type | Optional | Description / Notes |
| :------ | :--- | :------- | :------------------ |
| agentId | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
