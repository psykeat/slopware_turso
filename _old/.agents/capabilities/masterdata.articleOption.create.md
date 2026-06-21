# Capability: `masterdata.articleOption.create`

> **Module**: masterdata | **Entity**: articleOption | **Operation**: create
> **Kind**: create | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Create an article option
- **DE**: Artikeloption anlegen

## Input Schema

| Field     | Type   | Optional | Description / Notes |
| :-------- | :----- | :------- | :------------------ |
| articleId | uuid   | No       |                     |
| name      | string | No       |                     |
| sortOrder | number | Yes      |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `articleOption`
- **Side Effects**: None
- **Idempotent**: No
- **Supports Dry Run**: No
