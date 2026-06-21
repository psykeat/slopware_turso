# Capability: `masterdata.taxCode.list`

> **Module**: masterdata | **Entity**: taxCode | **Operation**: list
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: List taxCode
- **DE**: taxCode auflisten

## Input Schema

| Field       | Type            | Optional | Description / Notes |
| :---------- | :-------------- | :------- | :------------------ |
| filters     | record/map      | No       |                     |
| search      | string          | Yes      |                     |
| orderBy     | string          | Yes      |                     |
| filterRules | array of object | Yes      |                     |
| limit       | number          | No       |                     |
| offset      | number          | No       |                     |
| withTotal   | boolean         | Yes      |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
