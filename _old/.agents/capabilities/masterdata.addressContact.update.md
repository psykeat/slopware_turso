# Capability: `masterdata.addressContact.update`

> **Module**: masterdata | **Entity**: addressContact | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Update addressContact
- **DE**: addressContact ändern

## Input Schema

| Field | Type       | Optional | Description / Notes |
| :---- | :--------- | :------- | :------------------ |
| id    | uuid       | No       |                     |
| patch | record/map | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `addressContact`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
