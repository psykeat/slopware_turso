# Capability: `masterdata.address.geocode`

> **Module**: masterdata | **Entity**: address | **Operation**: geocode
> **Kind**: update | **Min Role**: tenant_admin | **Exposure (LLM)**: safe

## Summary

- **EN**: Geocode addresses without coordinates
- **DE**: Adressen ohne Koordinaten geocodieren

## Description

- **EN**: Calls OpenStreetMap Nominatim to fill coordinates for addresses that have none. Respects Nominatim's 1 req/s policy. Pass addressId to geocode one address, or omit to batch all missing.
- **DE**: Ruft OpenStreetMap Nominatim auf, um Koordinaten für Adressen ohne Koordinaten zu füllen. Ohne addressId werden alle fehlenden Adressen gecodiert.

## Input Schema

| Field     | Type | Optional | Description / Notes |
| :-------- | :--- | :------- | :------------------ |
| addressId | uuid | Yes      |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `address`
- **Side Effects**: "nominatim_api"
- **Idempotent**: Yes
- **Supports Dry Run**: No
