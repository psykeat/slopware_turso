# Capability: `sales.documentLine.create`

> **Module**: sales | **Entity**: documentLine | **Operation**: create
> **Kind**: create | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Create a document line
- **DE**: Belegzeile anlegen

## Input Schema

No input required, or dynamic input object.

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `documentLine`
- **Side Effects**: "recomputes document totals", "explodes BOM components"
- **Idempotent**: No
- **Supports Dry Run**: No
