# Capability: `masterdata.articleBom.create`

> **Module**: masterdata | **Entity**: articleBom | **Operation**: create
> **Kind**: create | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Create a BOM row
- **DE**: Stücklistenposition anlegen

## Input Schema

| Field              | Type    | Optional | Description / Notes |
| :----------------- | :------ | :------- | :------------------ |
| headerArticleId    | uuid    | No       |                     |
| componentArticleId | uuid    | No       |                     |
| quantity           | unknown | No       |                     |
| scrapPercentage    | unknown | Yes      |                     |
| sortOrder          | number  | Yes      |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `articleBom`
- **Side Effects**: None
- **Idempotent**: No
- **Supports Dry Run**: No
