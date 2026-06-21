# Capability: `masterdata.priceListItem.update`

> **Module**: masterdata | **Entity**: priceListItem | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Update priceListItem
- **DE**: priceListItem ändern

## Input Schema

| Field | Type       | Optional | Description / Notes |
| :---- | :--------- | :------- | :------------------ |
| id    | uuid       | No       |                     |
| patch | record/map | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `priceListItem`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
