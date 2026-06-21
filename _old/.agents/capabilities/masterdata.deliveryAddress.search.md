# Capability: `masterdata.deliveryAddress.search`

> **Module**: masterdata | **Entity**: deliveryAddress | **Operation**: search
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Search delivery addresses for lookup
- **DE**: Lieferadressen für Lookup suchen

## Description

- **EN**: Type-ahead lookup over delivery address and parent address fields; optionally scoped to one addressId.
- **DE**: Type-ahead-Lookup über Liefer- und Stammadressfelder; optional auf eine addressId eingeschränkt.

## Input Schema

| Field     | Type   | Optional | Description / Notes |
| :-------- | :----- | :------- | :------------------ |
| q         | string | No       |                     |
| limit     | number | No       |                     |
| addressId | uuid   | Yes      |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
