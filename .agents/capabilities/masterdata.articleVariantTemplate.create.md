# Capability: `masterdata.articleVariantTemplate.create`

> **Module**: masterdata | **Entity**: articleVariantTemplate | **Operation**: create
> **Kind**: create | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Create a variant template
- **DE**: Variantenvorlage anlegen

## Description
- **EN**: Creates a reusable product-type template with variant axes, exclusion rules and SKU pattern.
- **DE**: Legt eine wiederverwendbare Produkttyp-Vorlage mit Variantenachsen, Ausschlussregeln und SKU-Muster an.

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| slug | string | No | |
| label | string | No | |
| articleGroupId | uuid (nullable) | Yes | |
| definition | object | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `articleVariantTemplate`
- **Side Effects**: None
- **Idempotent**: No
- **Supports Dry Run**: No
