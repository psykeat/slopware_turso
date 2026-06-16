# Capability: `accounting.glAccount.archive`

> **Module**: accounting | **Entity**: glAccount | **Operation**: archive
> **Kind**: archive | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary
- **EN**: Archive a GL account
- **DE**: Sachkonto archivieren

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| id | uuid | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `glAccount`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
