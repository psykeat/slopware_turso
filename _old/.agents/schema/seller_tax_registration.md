# Table: `seller_tax_registration`

> _⚠ pending annotation_

| Column                     | Business Name              | Type                         | Class | Constraints                | Description |
| :------------------------- | :------------------------- | :--------------------------- | :---- | :------------------------- | :---------- |
| seller_tax_registration_id | seller_tax_registration_id | uuid                         | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id                  | tenant_id                  | uuid                         | —     | NOT NULL                   |             |
| company_id                 | company_id                 | uuid                         | —     |                            |             |
| country_code               | country_code               | char(2)                      | —     | NOT NULL                   |             |
| vat_id                     | vat_id                     | text                         | —     |                            |             |
| registration_type          | registration_type          | seller_tax_registration_type | —     | NOT NULL                   |             |
| valid_from                 | valid_from                 | date                         | —     | NOT NULL                   |             |
| valid_to                   | valid_to                   | date                         | —     |                            |             |
| archived                   | archived                   | boolean                      | —     | NOT NULL                   |             |
| created_at                 | created_at                 | timestamp with time zone     | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_seller_tax_registration_lookup` (tenant_id, company_id, country_code, registration_type, valid_from) [btree]
> INDEX `idx_seller_tax_registration_tenant` (tenant_id) [btree]
