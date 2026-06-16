# Capability: `masterdata.agent.archive`

> **Module**: masterdata | **Entity**: agent | **Operation**: archive
> **Kind**: archive | **Min Role**: tenant_user | **Exposure (LLM)**: confirm

## Summary
- **EN**: Archive a sales agent
- **DE**: Vertreter archivieren

## Description
- **EN**: Soft delete: the agent is archived via archivedAt, never hard-deleted.
- **DE**: Soft Delete: der Vertreter wird über archivedAt archiviert, nie hart gelöscht.

## Input Schema
| Field | Type | Optional | Description / Notes |
| :--- | :--- | :--- | :--- |
| agentId | uuid | No | |

## Output Schema
- **Type**: `object`

## Invariants & Side Effects
- **Writes Tables**: `agent`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
