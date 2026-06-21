# Capability: `masterdata.articleGroup.update`

> **Module**: masterdata | **Entity**: articleGroup | **Operation**: update
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: hidden

## Summary

- **EN**: Update articleGroup by id
- **DE**: articleGroup per ID ändern

## Input Schema

| Field          | Type       | Optional | Description / Notes |
| :------------- | :--------- | :------- | :------------------ |
| articleGroupId | uuid       | No       |                     |
| patch          | record/map | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `articleGroup`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
