# Capability: `import.bueroware.listLayouts`

> **Module**: import | **Entity**: bueroware | **Operation**: listLayouts
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: List the data areas (layouts) for a Büroware file
- **DE**: Datenbereiche (Layouts) einer Büroware-Datei auflisten

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| fileName | string | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
