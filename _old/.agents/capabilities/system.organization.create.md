# Capability: `system.organization.create`

> **Module**: system | **Entity**: organization | **Operation**: create
> **Kind**: create | **Min Role**: tenant_admin | **Exposure (LLM)**: safe

## Summary

- **EN**: Create organization
- **DE**: organization anlegen

## Input Schema

No input required, or dynamic input object.

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `organization`
- **Side Effects**: None
- **Idempotent**: No
- **Supports Dry Run**: No
