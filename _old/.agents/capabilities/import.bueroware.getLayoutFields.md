# Capability: `import.bueroware.getLayoutFields`

> **Module**: import | **Entity**: bueroware | **Operation**: getLayoutFields
> **Kind**: read | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Get catalog fields and resolved assignment for a layout
- **DE**: Katalogfelder und aufgelöste Zuweisung eines Layouts lesen

## Input Schema

| Field             | Type | Optional | Description / Notes |
| :---------------- | :--- | :------- | :------------------ |
| layoutId          | uuid | No       |                     |
| mappingVersionId  | uuid | Yes      |                     |
| templateProfileId | uuid | Yes      |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: None
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
