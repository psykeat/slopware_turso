# Capability: `sales.document.pricing`

> **Module**: sales | **Entity**: document | **Operation**: pricing
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Resolve document pricing
- **DE**: Belegpreis ermitteln

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| variantId | uuid | No | |
| customerId | uuid (nullable) | Yes | |
| documentDate | string | Yes | |
| deliveryAddressId | uuid (nullable) | Yes | |
| deliveryCountryCode | string (nullable) | Yes | |
| billingCountryCode | string (nullable) | Yes | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
