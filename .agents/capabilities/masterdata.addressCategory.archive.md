# Capability: `masterdata.addressCategory.archive`

> **Module**: masterdata | **Entity**: addressCategory | **Operation**: archive
> **Kind**: archive | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary
- **EN**: Archive addressCategory
- **DE**: addressCategory archivieren

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| id | uuid | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `addressCategory`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
