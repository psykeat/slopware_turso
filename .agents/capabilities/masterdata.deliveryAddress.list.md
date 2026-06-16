# Capability: `masterdata.deliveryAddress.list`

> **Module**: masterdata | **Entity**: deliveryAddress | **Operation**: list
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: List delivery addresses
- **DE**: Lieferadressen auflisten

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| addressId | uuid | Yes | |
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
