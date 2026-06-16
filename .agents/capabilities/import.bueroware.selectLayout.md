# Capability: `import.bueroware.selectLayout`

> **Module**: import | **Entity**: bueroware | **Operation**: selectLayout
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary
- **EN**: Select the data area (layout) for a pending Büroware batch
- **DE**: Datenbereich (Layout) für einen wartenden Büroware-Batch wählen

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| batchId | uuid | No | |
| layoutId | uuid | No | |
| profileId | uuid | Yes | |
| mappingVersionId | uuid | Yes | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `importBatch`
- **Side Effects**: "binds a data area and mapping to a batch and queues it"
- **Idempotent**: Yes
- **Supports Dry Run**: No
