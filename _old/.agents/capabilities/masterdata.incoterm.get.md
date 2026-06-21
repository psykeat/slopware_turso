# Capability: `masterdata.incoterm.get`

> **Module**: masterdata | **Entity**: incoterm | **Operation**: get
> **Kind**: read | **Min Role**: tenant_admin | **Exposure (LLM)**: safe

## Summary

- **EN**: Get incoterm
- **DE**: incoterm lesen

## Input Schema

| Field | Type | Optional | Description / Notes |
| :---- | :--- | :------- | :------------------ |
| id    | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
