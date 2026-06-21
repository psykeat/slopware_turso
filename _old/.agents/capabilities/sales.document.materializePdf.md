# Capability: `sales.document.materializePdf`

> **Module**: sales | **Entity**: document | **Operation**: materializePdf
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Materialize a document PDF
- **DE**: Beleg-PDF erzeugen

## Description

- **EN**: Renders the document to a PDF and stores it so it can be attached to an email. Its own verb — prepareSend does not render implicitly. Re-running overwrites the same file.
- **DE**: Rendert den Beleg als PDF und speichert ihn, damit er an eine E-Mail angehängt werden kann. Eigenes Verb — prepareSend rendert nicht implizit. Erneutes Ausführen überschreibt dieselbe Datei.

## Input Schema

| Field      | Type | Optional | Description / Notes |
| :--------- | :--- | :------- | :------------------ |
| documentId | uuid | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: None
- **Side Effects**: "renders and stores the document PDF file"
- **Idempotent**: Yes
- **Supports Dry Run**: No
