# Table: `delivery_address`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| delivery_address_id | delivery_address_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| address_id | address_id | uuid | — | NOT NULL |  |
| name | name | text | — |  |  |
| address_line_1 | address_line_1 | text | — | NOT NULL |  |
| address_line_2 | address_line_2 | text | — |  |  |
| postal_code | postal_code | text | — | NOT NULL |  |
| city | city | text | — | NOT NULL |  |
| country_code | country_code | char(2) | — | NOT NULL |  |
| default_for_shipping | default_for_shipping | boolean | — |  |  |
| archived | archived | boolean | — | NOT NULL |  |
| custom_attributes | custom_attributes | jsonb | — |  |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |
| updated_at | updated_at | timestamp with time zone | — |  |  |

> INDEX `idx_delivery_address_partner` (address_id) [btree]
> INDEX `idx_delivery_address_tenant` (tenant_id) [btree]

