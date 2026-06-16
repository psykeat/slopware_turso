# Capability: `masterdata.currency.list`

> **Module**: masterdata | **Entity**: currency | **Operation**: list
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: List currencies
- **DE**: Währungen auflisten

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| code | string | Yes | |
| search | string | Yes | |
| orderBy | string | Yes | |
| filterRules | array of object | Yes | |
| limit | number | No | |
| offset | number | No | |
| withTotal | boolean | Yes | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
