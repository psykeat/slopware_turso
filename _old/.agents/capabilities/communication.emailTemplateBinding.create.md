# Capability: `communication.emailTemplateBinding.create`

> **Module**: communication | **Entity**: emailTemplateBinding | **Operation**: create
> **Kind**: create | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Create emailTemplateBinding
- **DE**: emailTemplateBinding anlegen

## Input Schema

| Field           | Type              | Optional | Description / Notes |
| :-------------- | :---------------- | :------- | :------------------ |
| emailTemplateId | uuid              | No       |                     |
| documentType    | string (nullable) | Yes      |                     |
| companyId       | uuid (nullable)   | Yes      |                     |
| language        | string (nullable) | Yes      |                     |
| emailIdentityId | uuid (nullable)   | Yes      |                     |
| priority        | number            | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `emailTemplateBinding`
- **Side Effects**: None
- **Idempotent**: No
- **Supports Dry Run**: No
