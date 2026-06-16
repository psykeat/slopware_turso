# Capability: `masterdata.agent.upsert`

> **Module**: masterdata | **Entity**: agent | **Operation**: upsert
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary
- **EN**: Create or update a sales agent
- **DE**: Vertreter anlegen oder ändern

## Description
- **EN**: agentNo is the natural key. Optionally link to an address record (external agent) or a system user (internal rep).
- **DE**: agentNo ist der natürliche Schlüssel. Optional kann eine Adresse (externer Vertreter) oder ein Systemuser (interner Mitarbeiter) verknüpft werden.

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| agentNo | string | No | |
| name | string (nullable) | Yes | |
| addressId | uuid (nullable) | Yes | |
| userId | string (nullable) | Yes | |
| commissionRate | string (nullable) | Yes | |
| active | boolean | Yes | |
| customAttributes | record/map (nullable) | Yes | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `agent`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
