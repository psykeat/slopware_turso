# Capability: `import.bueroware.queueFile`

> **Module**: import | **Entity**: bueroware | **Operation**: queueFile
> **Kind**: create | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary

- **EN**: Queue a Büroware SEDB file already stored on disk
- **DE**: Bereits gespeicherte Büroware-SEDB-Datei einreihen

## Input Schema

| Field            | Type    | Optional | Description / Notes |
| :--------------- | :------ | :------- | :------------------ |
| layoutId         | uuid    | Yes      |                     |
| profileId        | uuid    | Yes      |                     |
| mappingVersionId | uuid    | Yes      |                     |
| sourceFileName   | string  | Yes      |                     |
| filePath         | string  | No       |                     |
| isDryRun         | boolean | Yes      |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `importBatch`
- **Side Effects**: "queues a stored import file for asynchronous processing"
- **Idempotent**: No
- **Supports Dry Run**: No
