# Capability: `import.bueroware.listTemplates`

> **Module**: import | **Entity**: bueroware | **Operation**: listTemplates
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: List tenant import templates for a layout
- **DE**: Tenant-Importvorlagen für ein Layout auflisten

## Input Schema

| Field    | Type | Optional | Description / Notes |
| :------- | :--- | :------- | :------------------ |
| layoutId | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
