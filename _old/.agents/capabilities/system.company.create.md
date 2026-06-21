# Capability: `system.company.create`

> **Module**: system | **Entity**: company | **Operation**: create
> **Kind**: create | **Min Role**: tenant_admin | **Exposure (LLM)**: safe

## Summary

- **EN**: Create company
- **DE**: company anlegen

## Input Schema

No input required, or dynamic input object.

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `company`
- **Side Effects**: None
- **Idempotent**: No
- **Supports Dry Run**: No
