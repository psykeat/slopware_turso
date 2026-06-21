# Capability: `masterdata.category.create`

> **Module**: masterdata | **Entity**: category | **Operation**: create
> **Kind**: create | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Create a category
- **DE**: Kategorie anlegen

## Input Schema

| Field            | Type              | Optional | Description / Notes |
| :--------------- | :---------------- | :------- | :------------------ |
| parentCategoryId | uuid (nullable)   | Yes      |                     |
| code             | string (nullable) | Yes      |                     |
| name             | string            | No       |                     |
| slug             | string (nullable) | Yes      |                     |
| description      | string (nullable) | Yes      |                     |
| sortOrder        | number            | Yes      |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `category`
- **Side Effects**: None
- **Idempotent**: No
- **Supports Dry Run**: No
