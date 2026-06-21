# Capability: `masterdata.country.get`

> **Module**: masterdata | **Entity**: country | **Operation**: get
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Get a country by id
- **DE**: Land per ID lesen

## Input Schema

| Field     | Type | Optional | Description / Notes |
| :-------- | :--- | :------- | :------------------ |
| countryId | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
