# Capability: `import.bueroware.saveTemplate`

> **Module**: import | **Entity**: bueroware | **Operation**: saveTemplate
> **Kind**: create | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Save a tenant import template for a layout
- **DE**: Tenant-Importvorlage für ein Layout speichern

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| layoutId | uuid | No | |
| label | string | No | |
| slug | string | Yes | |
| fields | array of object | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `importProfile`, `importProfileMappingVersion`, `importFieldMapping`
- **Side Effects**: "creates or updates a tenant import template"
- **Idempotent**: No
- **Supports Dry Run**: No
