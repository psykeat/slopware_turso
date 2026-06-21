# Capability: `masterdata.address.upsert`

> **Module**: masterdata | **Entity**: address | **Operation**: upsert
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Create or update an address by address number
- **DE**: Adresse per Adressnummer anlegen oder ändern

## Description

- **EN**: Address number is the natural key inside a tenant: an existing address is patched, otherwise a new one is created (name and address lines required).
- **DE**: Die Adressnummer ist der natürliche Schlüssel im Tenant: eine vorhandene Adresse wird gepatcht, sonst wird neu angelegt (Name und Adressdaten erforderlich).

## Input Schema

| Field                    | Type                  | Optional | Description / Notes |
| :----------------------- | :-------------------- | :------- | :------------------ |
| addressNo                | string                | No       |                     |
| isCustomer               | boolean               | Yes      |                     |
| isSupplier               | boolean               | Yes      |                     |
| companyName              | string (nullable)     | Yes      |                     |
| firstName                | string (nullable)     | Yes      |                     |
| lastName                 | string (nullable)     | Yes      |                     |
| notiztext                | string (nullable)     | Yes      |                     |
| langtext                 | string (nullable)     | Yes      |                     |
| warntext                 | string (nullable)     | Yes      |                     |
| addressLine1             | string                | Yes      |                     |
| addressLine2             | string (nullable)     | Yes      |                     |
| postalCode               | string                | Yes      |                     |
| city                     | string                | Yes      |                     |
| stateProvince            | string (nullable)     | Yes      |                     |
| countryCode              | string                | Yes      |                     |
| vatId                    | string (nullable)     | Yes      |                     |
| taxClassId               | uuid (nullable)       | Yes      |                     |
| currencyId               | string (nullable)     | Yes      |                     |
| paymentTermId            | uuid (nullable)       | Yes      |                     |
| customAttributes         | record/map (nullable) | Yes      |                     |
| defaultDeliveryAddressId | uuid (nullable)       | Yes      |                     |
| addressCategoryId        | uuid (nullable)       | Yes      |                     |
| salutation               | string (nullable)     | Yes      |                     |
| phoneLandline            | string (nullable)     | Yes      |                     |
| phoneFax                 | string (nullable)     | Yes      |                     |
| phoneMobile              | string (nullable)     | Yes      |                     |
| email                    | string (nullable)     | Yes      |                     |
| homepage                 | string (nullable)     | Yes      |                     |
| leitwegId                | string (nullable)     | Yes      |                     |
| peppolId                 | string (nullable)     | Yes      |                     |
| coordinates              | object (nullable)     | Yes      |                     |
| agentId                  | uuid (nullable)       | Yes      |                     |
| commissionRate           | string (nullable)     | Yes      |                     |
| creditRatingScore        | string (nullable)     | Yes      |                     |
| shopActive               | boolean (nullable)    | Yes      |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `address`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
