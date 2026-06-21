# Capability: `masterdata.shippingMethod.archive`

> **Module**: masterdata | **Entity**: shippingMethod | **Operation**: archive
> **Kind**: archive | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary

- **EN**: Archive shippingMethod
- **DE**: shippingMethod archivieren

## Input Schema

| Field | Type | Optional | Description / Notes |
| :---- | :--- | :------- | :------------------ |
| id    | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `shippingMethod`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
