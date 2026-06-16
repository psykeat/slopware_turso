# Capability: `import.importBatch.upload`

> **Module**: import | **Entity**: importBatch | **Operation**: upload
> **Kind**: create | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Upload a CSV as an import batch
- **DE**: CSV als Import-Batch hochladen

## Description
- **EN**: Parses the CSV against the active mapping version of the connector/profile pair and stages the rows as a pending batch.
- **DE**: Parst die CSV gegen die aktive Mapping-Version des Connector/Profil-Paars und legt die Zeilen als pending Batch ab.

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| csvText | string | No | |
| profileId | uuid | No | |
| tenantConnectorId | uuid | No | |
| delimiter | string | Yes | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `importBatch`
- **Side Effects**: "stages parsed CSV rows for review"
- **Idempotent**: No
- **Supports Dry Run**: No
