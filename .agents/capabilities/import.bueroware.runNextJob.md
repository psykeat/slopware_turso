# Capability: `import.bueroware.runNextJob`

> **Module**: import | **Entity**: bueroware | **Operation**: runNextJob
> **Kind**: process | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary
- **EN**: Run the next queued Büroware import job
- **DE**: Nächsten Büroware-Importjob ausführen

## Input Schema
No input required, or dynamic input object.

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `importBatch`, `importRow`
- **Side Effects**: "streams one queued import file into staging rows and validates it"
- **Idempotent**: No
- **Supports Dry Run**: No
