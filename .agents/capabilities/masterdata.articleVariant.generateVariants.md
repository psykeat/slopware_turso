# Capability: `masterdata.articleVariant.generateVariants`

> **Module**: masterdata | **Entity**: articleVariant | **Operation**: generateVariants
> **Kind**: process | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Generate article variants
- **DE**: Artikelvarianten erzeugen

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| articleId | uuid | No | |
| templateId | uuid | Yes | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `articleVariant`, `articleVariantOptionValue`, `inventoryItem`
- **Side Effects**: "creates inventory items when missing"
- **Idempotent**: Yes
- **Supports Dry Run**: No
