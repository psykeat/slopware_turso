# Capability: `masterdata.articleImage.create`

> **Module**: masterdata | **Entity**: articleImage | **Operation**: create
> **Kind**: create | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Create an article image
- **DE**: Artikelbild anlegen

## Input Schema

| Field      | Type              | Optional | Description / Notes |
| :--------- | :---------------- | :------- | :------------------ |
| articleId  | uuid              | No       |                     |
| storageKey | string            | No       |                     |
| fileName   | string            | No       |                     |
| mimeType   | string            | No       |                     |
| fileSize   | number            | No       |                     |
| width      | number (nullable) | Yes      |                     |
| height     | number (nullable) | Yes      |                     |
| altText    | string (nullable) | Yes      |                     |
| sortOrder  | number            | Yes      |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `articleImage`
- **Side Effects**: None
- **Idempotent**: No
- **Supports Dry Run**: No
