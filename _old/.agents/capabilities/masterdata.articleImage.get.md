# Capability: `masterdata.articleImage.get`

> **Module**: masterdata | **Entity**: articleImage | **Operation**: get
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Get an article image by id
- **DE**: Artikelbild per ID lesen

## Input Schema

| Field          | Type | Optional | Description / Notes |
| :------------- | :--- | :------- | :------------------ |
| articleImageId | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
