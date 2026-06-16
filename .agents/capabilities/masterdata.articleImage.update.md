# Capability: `masterdata.articleImage.update`

> **Module**: masterdata | **Entity**: articleImage | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Update an article image
- **DE**: Artikelbild ändern

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| articleImageId | uuid | No | |
| patch | object | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `articleImage`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
