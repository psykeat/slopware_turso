# Capability: `masterdata.articleVariantTemplate.applyToArticle`

> **Module**: masterdata | **Entity**: articleVariantTemplate | **Operation**: applyToArticle
> **Kind**: process | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Apply a variant template's axes to an article
- **DE**: Achsen einer Variantenvorlage auf einen Artikel anwenden

## Description

- **EN**: Merge-only: existing options and values on the article are matched and kept, nothing is deleted.
- **DE**: Nur Merge: vorhandene Optionen und Werte des Artikels werden gematcht und behalten, nichts wird gelöscht.

## Input Schema

| Field      | Type | Optional | Description / Notes |
| :--------- | :--- | :------- | :------------------ |
| articleId  | uuid | No       |                     |
| templateId | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `articleOption`, `articleOptionValue`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
