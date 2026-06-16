# Capability: `masterdata.country.update`

> **Module**: masterdata | **Entity**: country | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: hidden

## Summary
- **EN**: Update country by id
- **DE**: country per ID ändern

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| countryId | uuid | No | |
| patch | record/map | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `country`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
