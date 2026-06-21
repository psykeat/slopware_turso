# Capability: `masterdata.articleVariant.archiveBulk`

> **Module**: masterdata | **Entity**: articleVariant | **Operation**: archiveBulk
> **Kind**: archive | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Archive variants of an article
- **DE**: Varianten eines Artikels archivieren

## Description

- **EN**: Archives all variants of the article, or only the given variantIds.
- **DE**: Archiviert alle Varianten des Artikels oder nur die übergebenen variantIds.

## Input Schema

| Field      | Type          | Optional | Description / Notes |
| :--------- | :------------ | :------- | :------------------ |
| articleId  | uuid          | No       |                     |
| variantIds | array of uuid | Yes      |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `articleVariant`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
