# Capability: `masterdata.articleVariantTemplate.update`

> **Module**: masterdata | **Entity**: articleVariantTemplate | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Update or archive a variant template
- **DE**: Variantenvorlage ändern oder archivieren

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| templateId | uuid | No | |
| patch | object | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `articleVariantTemplate`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
