# Capability: `masterdata.articleMedia.update`

> **Module**: masterdata | **Entity**: articleMedia | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Update an article media link
- **DE**: Artikelmedien-Verknüpfung ändern

## Input Schema

| Field          | Type   | Optional | Description / Notes |
| :------------- | :----- | :------- | :------------------ |
| articleMediaId | uuid   | No       |                     |
| patch          | object | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `articleMedia`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
