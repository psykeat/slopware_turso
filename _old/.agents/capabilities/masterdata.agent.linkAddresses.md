# Capability: `masterdata.agent.linkAddresses`

> **Module**: masterdata | **Entity**: agent | **Operation**: linkAddresses
> **Kind**: update | **Min Role**: tenant_admin | **Exposure (LLM)**: safe

## Summary

- **EN**: Link agent records to their address entries and populate address.agentId FKs
- **DE**: Vertreter mit Adresseinträgen verknüpfen und address.agentId FKs befüllen

## Description

- **EN**: Post-import reconciliation: for each address where customAttributes.agentNo is set, find the matching agent by agentNo and write address.agentId. Also ensures agent records exist for all referenced agentNos.
- **DE**: Nach dem Import: für jede Adresse mit customAttributes.agentNo den passenden Vertreter suchen und address.agentId setzen.

## Input Schema

No input required, or dynamic input object.

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `agent`, `address`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
