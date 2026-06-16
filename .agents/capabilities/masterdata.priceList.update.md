# Capability: `masterdata.priceList.update`

> **Module**: masterdata | **Entity**: priceList | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: hidden

## Summary
- **EN**: Update priceList by id
- **DE**: priceList per ID ändern

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| priceListId | uuid | No | |
| patch | record/map | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `priceList`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
