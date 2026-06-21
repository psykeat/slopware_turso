# Capability: `masterdata.addressContact.archive`

> **Module**: masterdata | **Entity**: addressContact | **Operation**: archive
> **Kind**: archive | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary

- **EN**: Archive addressContact
- **DE**: addressContact archivieren

## Input Schema

| Field | Type | Optional | Description / Notes |
| :---- | :--- | :------- | :------------------ |
| id    | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `addressContact`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
