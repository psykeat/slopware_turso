# Capability: `masterdata.address.update`

> **Module**: masterdata | **Entity**: address | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: hidden

## Summary
- **EN**: Update address by id
- **DE**: address per ID ändern

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| addressId | uuid | No | |
| patch | record/map | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `address`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
