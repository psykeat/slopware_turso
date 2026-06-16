# Capability: `masterdata.shippingMethod.update`

> **Module**: masterdata | **Entity**: shippingMethod | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Update shippingMethod
- **DE**: shippingMethod ändern

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| id | uuid | No | |
| patch | record/map | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `shippingMethod`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
