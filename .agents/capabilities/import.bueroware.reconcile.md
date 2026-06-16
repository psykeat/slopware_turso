# Capability: `import.bueroware.reconcile`

> **Module**: import | **Entity**: bueroware | **Operation**: reconcile
> **Kind**: process | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary
- **EN**: Reconcile pending Büroware import references
- **DE**: Offene Büroware-Importreferenzen erneut auflösen

## Input Schema
No input required, or dynamic input object.

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `importBatch`, `importRow`
- **Side Effects**: "posts rows whose missing references can now be resolved"
- **Idempotent**: No
- **Supports Dry Run**: No
