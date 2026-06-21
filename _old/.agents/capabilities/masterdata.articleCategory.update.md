# Capability: `masterdata.articleCategory.update`

> **Module**: masterdata | **Entity**: articleCategory | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Update an article category link
- **DE**: Artikel-Kategorien-Zuordnung ändern

## Input Schema

| Field             | Type   | Optional | Description / Notes |
| :---------------- | :----- | :------- | :------------------ |
| articleCategoryId | uuid   | No       |                     |
| patch             | object | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `articleCategory`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
