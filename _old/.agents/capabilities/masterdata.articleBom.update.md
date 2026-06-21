# Capability: `masterdata.articleBom.update`

> **Module**: masterdata | **Entity**: articleBom | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Update a BOM row
- **DE**: Stücklistenposition ändern

## Input Schema

| Field | Type   | Optional | Description / Notes |
| :---- | :----- | :------- | :------------------ |
| bomId | uuid   | No       |                     |
| patch | object | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `articleBom`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
