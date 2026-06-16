# Capability: `masterdata.article.update`

> **Module**: masterdata | **Entity**: article | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: hidden

## Summary
- **EN**: Update article by id
- **DE**: article per ID ändern

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| articleId | uuid | No | |
| patch | record/map | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `article`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
