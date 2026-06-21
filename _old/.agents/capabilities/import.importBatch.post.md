# Capability: `import.importBatch.post`

> **Module**: import | **Entity**: importBatch | **Operation**: post
> **Kind**: process | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary

- **EN**: Post an import batch
- **DE**: Import-Batch buchen

## Description

- **EN**: Writes the approved batch rows into their target entities. The written tables depend on the import profile.
- **DE**: Schreibt die freigegebenen Batch-Zeilen in ihre Ziel-Entitäten. Die geschriebenen Tabellen hängen vom Import-Profil ab.

## Input Schema

| Field   | Type | Optional | Description / Notes |
| :------ | :--- | :------- | :------------------ |
| batchId | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `importBatch`
- **Side Effects**: "writes imported rows into profile target entities"
- **Idempotent**: No
- **Supports Dry Run**: No
