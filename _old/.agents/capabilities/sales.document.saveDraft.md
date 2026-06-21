# Capability: `sales.document.saveDraft`

> **Module**: sales | **Entity**: document | **Operation**: saveDraft
> **Kind**: update | **Min Role**: tenant_user | **Exposure (LLM)**: safe

## Summary

- **EN**: Save a draft document
- **DE**: Entwurf speichern

## Input Schema

| Field                  | Type              | Optional | Description / Notes |
| :--------------------- | :---------------- | :------- | :------------------ |
| documentGroupId        | uuid (nullable)   | Yes      |                     |
| documentType           | string (nullable) | Yes      |                     |
| documentDirection      | string (nullable) | Yes      |                     |
| documentDate           | string (nullable) | Yes      |                     |
| customerId             | uuid (nullable)   | Yes      |                     |
| billingAddress         | unknown           | Yes      |                     |
| deliveryAddress        | unknown           | Yes      |                     |
| deliveryAddressId      | uuid (nullable)   | Yes      |                     |
| customAttributes       | unknown           | Yes      |                     |
| currencyId             | string (nullable) | Yes      |                     |
| warehouseId            | uuid (nullable)   | Yes      |                     |
| paymentTermId          | uuid (nullable)   | Yes      |                     |
| shippingMethodId       | uuid (nullable)   | Yes      |                     |
| noteText               | string (nullable) | Yes      |                     |
| noteTextSourceEntity   | string (nullable) | Yes      |                     |
| noteTextSourceId       | uuid (nullable)   | Yes      |                     |
| noteTextSourceField    | string (nullable) | Yes      |                     |
| noteTextLinkedAt       | string (nullable) | Yes      |                     |
| noteTextOverriddenAt   | string (nullable) | Yes      |                     |
| preText                | string (nullable) | Yes      |                     |
| preTextSourceEntity    | string (nullable) | Yes      |                     |
| preTextSourceId        | uuid (nullable)   | Yes      |                     |
| preTextSourceField     | string (nullable) | Yes      |                     |
| preTextLinkedAt        | string (nullable) | Yes      |                     |
| preTextOverriddenAt    | string (nullable) | Yes      |                     |
| postText               | string (nullable) | Yes      |                     |
| postTextSourceEntity   | string (nullable) | Yes      |                     |
| postTextSourceId       | uuid (nullable)   | Yes      |                     |
| postTextSourceField    | string (nullable) | Yes      |                     |
| postTextLinkedAt       | string (nullable) | Yes      |                     |
| postTextOverriddenAt   | string (nullable) | Yes      |                     |
| stornoText             | string (nullable) | Yes      |                     |
| stornoTextSourceEntity | string (nullable) | Yes      |                     |
| stornoTextSourceId     | uuid (nullable)   | Yes      |                     |
| stornoTextSourceField  | string (nullable) | Yes      |                     |
| stornoTextLinkedAt     | string (nullable) | Yes      |                     |
| stornoTextOverriddenAt | string (nullable) | Yes      |                     |
| documentId             | uuid (nullable)   | Yes      |                     |
| lines                  | array of object   | No       |                     |

## Output Schema

- **Type**: `object`

## Invariants & Side Effects

- **Writes Tables**: `document`, `documentLine`, `documentLineAllocation`
- **Side Effects**: None
- **Idempotent**: Yes
- **Supports Dry Run**: No
