# Capability: `masterdata.priceList.get`

> **Module**: masterdata | **Entity**: priceList | **Operation**: get
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Get a price list by id
- **DE**: Preisliste per ID lesen

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| priceListId | uuid | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
