# Slopware — Live Schema

> Generated: 2026-05-15 10:53:06 UTC
> Tables: 64

## Module: uncategorized

### `account`

> _⚠ pending annotation_

| Column                   | Business Name            | Type                     | Class | Constraints             | Description |
| :----------------------- | :----------------------- | :----------------------- | :---- | :---------------------- | :---------- |
| id                       | id                       | text                     | PK    | NOT NULL                |             |
| account_id               | account_id               | text                     | —     | NOT NULL                |             |
| provider_id              | provider_id              | text                     | —     | NOT NULL                |             |
| user_id                  | user_id                  | text                     | —     | NOT NULL                |             |
| access_token             | access_token             | text                     | —     |                         |             |
| refresh_token            | refresh_token            | text                     | —     |                         |             |
| id_token                 | id_token                 | text                     | —     |                         |             |
| access_token_expires_at  | access_token_expires_at  | timestamp with time zone | —     |                         |             |
| refresh_token_expires_at | refresh_token_expires_at | timestamp with time zone | —     |                         |             |
| scope                    | scope                    | text                     | —     |                         |             |
| password                 | password                 | text                     | —     |                         |             |
| created_at               | created_at               | timestamp with time zone | —     | NOT NULL, DEFAULT now() |             |
| updated_at               | updated_at               | timestamp with time zone | —     | NOT NULL, DEFAULT now() |             |

> INDEX `account_userId_idx` (user_id) [btree]

### `account_determination_rule`

> _⚠ pending annotation_

| Column           | Business Name    | Type                     | Class | Constraints                | Description |
| :--------------- | :--------------- | :----------------------- | :---- | :------------------------- | :---------- |
| rule_id          | rule_id          | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id        | tenant_id        | uuid                     | —     | NOT NULL                   |             |
| company_id       | company_id       | uuid                     | —     |                            |             |
| article_group_id | article_group_id | uuid                     | —     |                            |             |
| tax_code_id      | tax_code_id      | uuid                     | —     |                            |             |
| posting_context  | posting_context  | text                     | —     | NOT NULL                   |             |
| gl_account_id    | gl_account_id    | uuid                     | —     |                            |             |
| created_at       | created_at       | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_acct_det_lookup` (tenant_id, posting_context, article_group_id, tax_code_id) [btree]
> INDEX `idx_acct_det_tenant` (tenant_id) [btree]

### `address`

> _⚠ pending annotation_

| Column                      | Business Name               | Type                     | Class | Constraints                | Description |
| :-------------------------- | :-------------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| address_id                  | address_id                  | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id                   | tenant_id                   | uuid                     | —     | NOT NULL                   |             |
| address_no                  | address_no                  | text                     | —     | NOT NULL                   |             |
| address_type                | address_type                | text                     | —     | NOT NULL                   |             |
| is_customer                 | is_customer                 | boolean                  | —     | NOT NULL                   |             |
| is_supplier                 | is_supplier                 | boolean                  | —     | NOT NULL                   |             |
| company_name                | company_name                | text                     | —     |                            |             |
| first_name                  | first_name                  | text                     | —     |                            |             |
| last_name                   | last_name                   | text                     | —     |                            |             |
| address_line_1              | address_line_1              | text                     | —     | NOT NULL                   |             |
| address_line_2              | address_line_2              | text                     | —     |                            |             |
| postal_code                 | postal_code                 | text                     | —     | NOT NULL                   |             |
| city                        | city                        | text                     | —     | NOT NULL                   |             |
| state_province              | state_province              | text                     | —     |                            |             |
| country_code                | country_code                | char(2)                  | —     | NOT NULL                   |             |
| vat_id                      | vat_id                      | text                     | —     |                            |             |
| tax_class_id                | tax_class_id                | uuid                     | —     |                            |             |
| currency_id                 | currency_id                 | char(3)                  | —     |                            |             |
| payment_term_id             | payment_term_id             | uuid                     | —     |                            |             |
| is_active                   | is_active                   | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| archived_at                 | archived_at                 | timestamp with time zone | —     |                            |             |
| custom_attributes           | custom_attributes           | jsonb                    | —     |                            |             |
| created_at                  | created_at                  | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at                  | updated_at                  | timestamp with time zone | —     |                            |             |
| bank_account_id             | bank_account_id             | uuid                     | —     |                            |             |
| default_delivery_address_id | default_delivery_address_id | uuid                     | —     |                            |             |
| search_text                 | search_text                 | text                     | —     |                            |             |
| address_category_id         | address_category_id         | uuid                     | —     |                            |             |

> INDEX `idx_address_category` (tenant_id, address_category_id) [btree]
> INDEX `idx_address_customer` (tenant_id, is_customer) [btree]
> INDEX `idx_address_supplier` (tenant_id, is_supplier) [btree]
> INDEX `idx_address_tenant` (tenant_id) [btree]
> INDEX `idx_address_type` (tenant_id, address_type) [btree]

### `address_category`

> _⚠ pending annotation_

| Column            | Business Name     | Type                     | Class | Constraints                | Description |
| :---------------- | :---------------- | :----------------------- | :---- | :------------------------- | :---------- |
| category_id       | category_id       | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id         | tenant_id         | uuid                     | —     | NOT NULL                   |             |
| name              | name              | jsonb                    | —     | NOT NULL                   |             |
| is_active         | is_active         | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| archived          | archived          | boolean                  | —     | NOT NULL                   |             |
| created_at        | created_at        | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| custom_attributes | custom_attributes | jsonb                    | —     |                            |             |

> INDEX `idx_address_category_tenant` (tenant_id) [btree]

### `address_contact`

> _⚠ pending annotation_

| Column         | Business Name  | Type                     | Class | Constraints                | Description |
| :------------- | :------------- | :----------------------- | :---- | :------------------------- | :---------- |
| contact_id     | contact_id     | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id      | tenant_id      | uuid                     | —     | NOT NULL                   |             |
| address_id     | address_id     | uuid                     | —     | NOT NULL                   |             |
| first_name     | first_name     | text                     | —     |                            |             |
| last_name      | last_name      | text                     | —     | NOT NULL                   |             |
| email          | email          | text                     | —     |                            |             |
| phone_mobile   | phone_mobile   | text                     | —     |                            |             |
| phone_landline | phone_landline | text                     | —     |                            |             |
| role_function  | role_function  | text                     | —     |                            |             |
| is_primary     | is_primary     | boolean                  | —     | NOT NULL                   |             |
| is_active      | is_active      | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| archived       | archived       | boolean                  | —     | NOT NULL                   |             |
| created_at     | created_at     | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_address_contact_address` (address_id) [btree]
> INDEX `idx_address_contact_tenant` (tenant_id) [btree]

### `address_seq`

> _⚠ pending annotation_

| Column    | Business Name | Type    | Class | Constraints         | Description |
| :-------- | :------------ | :------ | :---- | :------------------ | :---------- |
| tenant_id | tenant_id     | uuid    | PK    | NOT NULL            |             |
| next_val  | next_val      | integer | —     | NOT NULL, DEFAULT 1 |             |

> INDEX `idx_address_seq_tenant` (tenant_id) [btree]

### `article`

> _⚠ pending annotation_

| Column               | Business Name        | Type                     | Class | Constraints                | Description |
| :------------------- | :------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| article_id           | article_id           | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id            | tenant_id            | uuid                     | —     | NOT NULL                   |             |
| article_no           | article_no           | text                     | —     | NOT NULL                   |             |
| name                 | name                 | text                     | —     | NOT NULL                   |             |
| description          | description          | text                     | —     |                            |             |
| article_group_id     | article_group_id     | uuid                     | —     |                            |             |
| tax_class_id         | tax_class_id         | uuid                     | —     |                            |             |
| base_unit            | base_unit            | text                     | —     |                            |             |
| sales_unit           | sales_unit           | text                     | —     |                            |             |
| purchase_unit        | purchase_unit        | text                     | —     |                            |             |
| is_active            | is_active            | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| archived_at          | archived_at          | timestamp with time zone | —     |                            |             |
| custom_attributes    | custom_attributes    | jsonb                    | —     |                            |             |
| created_at           | created_at           | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at           | updated_at           | timestamp with time zone | —     |                            |             |
| default_warehouse_id | default_warehouse_id | uuid                     | —     |                            |             |
| tracking_mode        | tracking_mode        | text                     | —     |                            |             |
| bom_type             | bom_type             | text                     | —     | NOT NULL, DEFAULT none     |             |

> INDEX `idx_article_default_wh` (tenant_id, default_warehouse_id) [btree]
> INDEX `idx_article_group_fk` (article_group_id) [btree]
> INDEX `idx_article_tenant` (tenant_id) [btree]
> INDEX `idx_article_tenant_active` (tenant_id, is_active) [btree]

> CHECK `article_bom_type_check`: [object Object]
> CHECK `article_tracking_mode_check`: [object Object]

### `article_bom`

> _⚠ pending annotation_

| Column               | Business Name        | Type                     | Class | Constraints                | Description |
| :------------------- | :------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| bom_id               | bom_id               | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id            | tenant_id            | uuid                     | —     | NOT NULL                   |             |
| header_article_id    | header_article_id    | uuid                     | —     | NOT NULL                   |             |
| component_article_id | component_article_id | uuid                     | —     | NOT NULL                   |             |
| quantity             | quantity             | numeric                  | —     | NOT NULL                   |             |
| scrap_percentage     | scrap_percentage     | numeric                  | —     | NOT NULL, DEFAULT 0        |             |
| is_active            | is_active            | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| archived             | archived             | boolean                  | —     | NOT NULL                   |             |
| created_at           | created_at           | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> CHECK `article_bom_quantity_check`: [object Object]

### `article_group`

> _⚠ pending annotation_

| Column           | Business Name    | Type                     | Class | Constraints                | Description |
| :--------------- | :--------------- | :----------------------- | :---- | :------------------------- | :---------- |
| article_group_id | article_group_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id        | tenant_id        | uuid                     | —     | NOT NULL                   |             |
| code             | code             | text                     | —     | NOT NULL                   |             |
| name             | name             | text                     | —     | NOT NULL                   |             |
| is_active        | is_active        | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| archived         | archived         | boolean                  | —     | NOT NULL                   |             |
| created_at       | created_at       | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_article_group_tenant` (tenant_id) [btree]

### `bank_account`

> _⚠ pending annotation_

| Column            | Business Name     | Type                     | Class | Constraints                | Description |
| :---------------- | :---------------- | :----------------------- | :---- | :------------------------- | :---------- |
| bank_account_id   | bank_account_id   | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id         | tenant_id         | uuid                     | —     | NOT NULL                   |             |
| address_id        | address_id        | uuid                     | —     |                            |             |
| iban              | iban              | text                     | —     | NOT NULL                   |             |
| bic               | bic               | text                     | —     |                            |             |
| bank_name         | bank_name         | text                     | —     |                            |             |
| currency_id       | currency_id       | char(3)                  | —     |                            |             |
| is_default        | is_default        | boolean                  | —     | NOT NULL                   |             |
| is_active         | is_active         | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| archived          | archived          | boolean                  | —     | NOT NULL                   |             |
| created_at        | created_at        | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| custom_attributes | custom_attributes | jsonb                    | —     |                            |             |

> INDEX `idx_bank_account_address` (address_id) [btree]
> INDEX `idx_bank_account_tenant` (tenant_id) [btree]

### `company`

> _⚠ pending annotation_

| Column                  | Business Name           | Type                     | Class | Constraints                | Description |
| :---------------------- | :---------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| company_id              | company_id              | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id               | tenant_id               | uuid                     | —     | NOT NULL                   |             |
| company_no              | company_no              | text                     | —     | NOT NULL                   |             |
| name                    | name                    | text                     | —     | NOT NULL                   |             |
| legal_name              | legal_name              | text                     | —     |                            |             |
| country_code            | country_code            | char(2)                  | —     | NOT NULL                   |             |
| currency_id             | currency_id             | char(3)                  | —     | NOT NULL                   |             |
| vat_id                  | vat_id                  | text                     | —     |                            |             |
| is_active               | is_active               | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| archived                | archived                | boolean                  | —     | NOT NULL                   |             |
| created_at              | created_at              | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| address_line_1          | address_line_1          | text                     | —     |                            |             |
| address_line_2          | address_line_2          | text                     | —     |                            |             |
| city                    | city                    | text                     | —     |                            |             |
| postal_code             | postal_code             | text                     | —     |                            |             |
| phone_landline          | phone_landline          | text                     | —     |                            |             |
| phone_mobile            | phone_mobile            | text                     | —     |                            |             |
| email                   | email                   | text                     | —     |                            |             |
| homepage                | homepage                | text                     | —     |                            |             |
| tax_number              | tax_number              | text                     | —     |                            |             |
| tax_authority           | tax_authority           | text                     | —     |                            |             |
| gln                     | gln                     | text                     | —     |                            |             |
| eori_no                 | eori_no                 | text                     | —     |                            |             |
| duns_no                 | duns_no                 | text                     | —     |                            |             |
| custom_attributes       | custom_attributes       | jsonb                    | —     |                            |             |
| bank_name               | bank_name               | text                     | —     |                            |             |
| bank_bic                | bank_bic                | text                     | —     |                            |             |
| bank_iban               | bank_iban               | text                     | —     |                            |             |
| fiscal_year_start_month | fiscal_year_start_month | integer                  | —     | NOT NULL, DEFAULT 1        |             |

> INDEX `idx_company_tenant` (tenant_id) [btree]
> INDEX `idx_company_tenant_active` (tenant_id, is_active) [btree]

> CHECK `company_fiscal_year_start_month_check`: [object Object]

### `connector_definition`

> _⚠ pending annotation_

| Column           | Business Name    | Type  | Class | Constraints                       | Description |
| :--------------- | :--------------- | :---- | :---- | :-------------------------------- | :---------- |
| connector_id     | connector_id     | uuid  | PK    | NOT NULL, DEFAULT uuidv7()        |             |
| slug             | slug             | text  | —     | NOT NULL                          |             |
| label            | label            | jsonb | —     | NOT NULL                          |             |
| default_mappings | default_mappings | jsonb | —     | NOT NULL, DEFAULT [object Object] |             |
| locked_fields    | locked_fields    | jsonb | —     | NOT NULL, DEFAULT                 |             |
| atomicity_mode   | atomicity_mode   | text  | —     | NOT NULL                          |             |

> INDEX `connector_definition_slug_key` (slug) [btree]

> CHECK `connector_definition_atomicity_mode_check`: [object Object]

### `cost_center`

> _⚠ pending annotation_

| Column         | Business Name  | Type                     | Class | Constraints                | Description |
| :------------- | :------------- | :----------------------- | :---- | :------------------------- | :---------- |
| cost_center_id | cost_center_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id      | tenant_id      | uuid                     | —     | NOT NULL                   |             |
| company_id     | company_id     | uuid                     | —     |                            |             |
| code           | code           | text                     | —     | NOT NULL                   |             |
| name           | name           | text                     | —     | NOT NULL                   |             |
| is_active      | is_active      | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| archived       | archived       | boolean                  | —     | NOT NULL                   |             |
| created_at     | created_at     | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_cost_center_tenant` (tenant_id) [btree]

### `country`

> _⚠ pending annotation_

| Column     | Business Name | Type                     | Class | Constraints                | Description |
| :--------- | :------------ | :----------------------- | :---- | :------------------------- | :---------- |
| country_id | country_id    | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| iso2_code  | iso2_code     | varchar(2)               | —     | NOT NULL                   |             |
| iso3_code  | iso3_code     | varchar(3)               | —     | NOT NULL                   |             |
| name       | name          | jsonb                    | —     | NOT NULL                   |             |
| is_eu      | is_eu         | boolean                  | —     | NOT NULL                   |             |
| is_active  | is_active     | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| archived   | archived      | boolean                  | —     | NOT NULL                   |             |
| created_at | created_at    | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `country_iso2_code_key` (iso2_code) [btree]
> INDEX `country_iso3_code_key` (iso3_code) [btree]

### `currency`

> _⚠ pending annotation_

| Column      | Business Name | Type                     | Class | Constraints                | Description |
| :---------- | :------------ | :----------------------- | :---- | :------------------------- | :---------- |
| currency_id | currency_id   | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| code        | code          | varchar(3)               | —     | NOT NULL                   |             |
| name        | name          | jsonb                    | —     | NOT NULL                   |             |
| symbol      | symbol        | varchar(5)               | —     |                            |             |
| decimals    | decimals      | integer                  | —     | NOT NULL, DEFAULT 2        |             |
| is_active   | is_active     | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| archived    | archived      | boolean                  | —     | NOT NULL                   |             |
| created_at  | created_at    | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `currency_code_key` (code) [btree]

### `delivery_address`

> _⚠ pending annotation_

| Column               | Business Name        | Type                     | Class | Constraints                | Description |
| :------------------- | :------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| delivery_address_id  | delivery_address_id  | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id            | tenant_id            | uuid                     | —     | NOT NULL                   |             |
| address_id           | address_id           | uuid                     | —     | NOT NULL                   |             |
| name                 | name                 | text                     | —     |                            |             |
| address_line_1       | address_line_1       | text                     | —     | NOT NULL                   |             |
| address_line_2       | address_line_2       | text                     | —     |                            |             |
| postal_code          | postal_code          | text                     | —     | NOT NULL                   |             |
| city                 | city                 | text                     | —     | NOT NULL                   |             |
| country_code         | country_code         | char(2)                  | —     | NOT NULL                   |             |
| is_active            | is_active            | boolean                  | —     | DEFAULT true               |             |
| default_for_shipping | default_for_shipping | boolean                  | —     |                            |             |
| custom_attributes    | custom_attributes    | jsonb                    | —     |                            |             |
| created_at           | created_at           | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at           | updated_at           | timestamp with time zone | —     |                            |             |

> INDEX `idx_delivery_address_partner` (address_id) [btree]
> INDEX `idx_delivery_address_tenant` (tenant_id) [btree]

### `discount_group`

> _⚠ pending annotation_

| Column            | Business Name     | Type                     | Class | Constraints                | Description |
| :---------------- | :---------------- | :----------------------- | :---- | :------------------------- | :---------- |
| discount_group_id | discount_group_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id         | tenant_id         | uuid                     | —     | NOT NULL                   |             |
| name              | name              | text                     | —     | NOT NULL                   |             |
| percentage        | percentage        | numeric                  | —     | NOT NULL                   |             |
| is_active         | is_active         | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| archived          | archived          | boolean                  | —     | NOT NULL                   |             |
| created_at        | created_at        | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_discount_group_tenant` (tenant_id) [btree]

### `document`

> _⚠ pending annotation_

| Column              | Business Name       | Type                     | Class | Constraints                | Description |
| :------------------ | :------------------ | :----------------------- | :---- | :------------------------- | :---------- |
| document_id         | document_id         | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id           | tenant_id           | uuid                     | —     | NOT NULL                   |             |
| company_id          | company_id          | uuid                     | —     | NOT NULL                   |             |
| document_type       | document_type       | char(1)                  | —     | NOT NULL                   |             |
| document_direction  | document_direction  | text                     | —     | NOT NULL                   |             |
| document_no         | document_no         | text                     | —     | NOT NULL                   |             |
| status              | status              | text                     | —     | NOT NULL                   |             |
| customer_id         | customer_id         | uuid                     | —     |                            |             |
| currency_id         | currency_id         | char(3)                  | —     |                            |             |
| document_date       | document_date       | date                     | —     | NOT NULL                   |             |
| posting_date        | posting_date        | date                     | —     |                            |             |
| total_net           | total_net           | numeric                  | —     |                            |             |
| total_tax           | total_tax           | numeric                  | —     |                            |             |
| total_gross         | total_gross         | numeric                  | —     |                            |             |
| version_no          | version_no          | integer                  | —     | NOT NULL, DEFAULT 1        |             |
| posted_at           | posted_at           | timestamp with time zone | —     |                            |             |
| posted_by           | posted_by           | uuid                     | —     |                            |             |
| cancelled_at        | cancelled_at        | timestamp with time zone | —     |                            |             |
| storno_document_id  | storno_document_id  | uuid                     | —     |                            |             |
| custom_attributes   | custom_attributes   | jsonb                    | —     |                            |             |
| created_at          | created_at          | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at          | updated_at          | timestamp with time zone | —     |                            |             |
| transaction_id      | transaction_id      | uuid                     | —     | NOT NULL                   |             |
| parent_document_id  | parent_document_id  | uuid                     | —     |                            |             |
| document_group_id   | document_group_id   | uuid                     | —     |                            |             |
| archived_at         | archived_at         | timestamp with time zone | —     |                            |             |
| billing_address     | billing_address     | jsonb                    | —     |                            |             |
| delivery_address    | delivery_address    | jsonb                    | —     |                            |             |
| delivery_address_id | delivery_address_id | uuid                     | —     |                            |             |
| payment_term_id     | payment_term_id     | uuid                     | —     |                            |             |
| shipping_method_id  | shipping_method_id  | uuid                     | —     |                            |             |
| document_type_id    | document_type_id    | uuid                     | —     |                            |             |
| warehouse_id        | warehouse_id        | uuid                     | —     |                            |             |
| target_warehouse_id | target_warehouse_id | uuid                     | —     |                            |             |
| is_paid             | is_paid             | boolean                  | —     | NOT NULL                   |             |
| paid_at             | paid_at             | timestamp with time zone | —     |                            |             |
| paid_amount         | paid_amount         | numeric                  | —     |                            |             |

> INDEX `idx_document_company` (tenant_id, company_id) [btree]
> INDEX `idx_document_customer` (tenant_id, customer_id) [btree]
> INDEX `idx_document_delivery_address` (tenant_id, delivery_address_id) [btree]
> INDEX `idx_document_group` (document_group_id) [btree]
> INDEX `idx_document_group_type` (document_group_id, document_type_id) [btree]
> INDEX `idx_document_parent` (parent_document_id) [btree]
> INDEX `idx_document_payment_term` (payment_term_id) [btree]
> INDEX `idx_document_posted_at` (tenant_id, posted_at) [btree]
> INDEX `idx_document_shipping_method` (shipping_method_id) [btree]
> INDEX `idx_document_tenant` (tenant_id) [btree]
> INDEX `idx_document_transaction` (tenant_id, transaction_id) [btree]
> INDEX `idx_document_type_status` (tenant_id, document_type, status) [btree]
> INDEX `idx_document_warehouse` (warehouse_id) [btree]

> CHECK `chk_document_type`: [object Object]

### `document_group`

> _⚠ pending annotation_

| Column                     | Business Name              | Type                     | Class | Constraints                | Description |
| :------------------------- | :------------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| document_group_id          | document_group_id          | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id                  | tenant_id                  | uuid                     | —     | NOT NULL                   |             |
| name                       | name                       | text                     | —     | NOT NULL                   |             |
| created_at                 | created_at                 | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| number_sequence_id         | number_sequence_id         | uuid                     | —     |                            |             |
| description                | description                | text                     | —     |                            |             |
| default_warehouse_id       | default_warehouse_id       | uuid                     | —     |                            |             |
| default_tax_code_id        | default_tax_code_id        | uuid                     | —     |                            |             |
| default_sales_account_id   | default_sales_account_id   | uuid                     | —     |                            |             |
| default_cost_account_id    | default_cost_account_id    | uuid                     | —     |                            |             |
| is_active                  | is_active                  | boolean                  | —     | DEFAULT true               |             |
| sort_order                 | sort_order                 | integer                  | —     |                            |             |
| updated_at                 | updated_at                 | timestamp with time zone | —     |                            |             |
| default_payment_term_id    | default_payment_term_id    | uuid                     | —     |                            |             |
| default_shipping_method_id | default_shipping_method_id | uuid                     | —     |                            |             |
| require_serial_tracking    | require_serial_tracking    | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| require_batch_tracking     | require_batch_tracking     | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| document_type              | document_type              | varchar(1)               | —     | NOT NULL                   |             |
| group_number               | group_number               | integer                  | —     | NOT NULL                   |             |
| direction                  | direction                  | varchar(20)              | —     |                            |             |
| next_group_id              | next_group_id              | uuid                     | —     |                            |             |
| company_id                 | company_id                 | uuid                     | —     |                            |             |

> INDEX `idx_document_group_company` (company_id) [btree]
> INDEX `idx_document_group_tenant` (tenant_id) [btree]

> CHECK `document_group_group_number_check`: [object Object]

### `document_line`

> _⚠ pending annotation_

| Column                | Business Name         | Type                     | Class | Constraints                | Description |
| :-------------------- | :-------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| document_line_id      | document_line_id      | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id             | tenant_id             | uuid                     | —     | NOT NULL                   |             |
| document_id           | document_id           | uuid                     | —     | NOT NULL                   |             |
| line_no               | line_no               | integer                  | —     | NOT NULL                   |             |
| article_id            | article_id            | uuid                     | —     |                            |             |
| article_text_snapshot | article_text_snapshot | text                     | —     |                            |             |
| quantity              | quantity              | numeric                  | —     | NOT NULL                   |             |
| unit                  | unit                  | text                     | —     |                            |             |
| net_price             | net_price             | numeric                  | —     | NOT NULL                   |             |
| discount_percentage   | discount_percentage   | numeric                  | —     |                            |             |
| tax_code_id           | tax_code_id           | uuid                     | —     |                            |             |
| tax_amount            | tax_amount            | numeric                  | —     |                            |             |
| line_total_net        | line_total_net        | numeric                  | —     |                            |             |
| warehouse_id          | warehouse_id          | uuid                     | —     |                            |             |
| cost_center_id        | cost_center_id        | uuid                     | —     |                            |             |
| created_at            | created_at            | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| transaction_id        | transaction_id        | uuid                     | —     |                            |             |
| movement_type         | movement_type         | char(1)                  | —     |                            |             |
| line_type             | line_type             | varchar(20)              | —     | NOT NULL, DEFAULT article  |             |

> INDEX `idx_document_line_article` (article_id) [btree]
> INDEX `idx_document_line_document` (document_id) [btree]
> INDEX `idx_document_line_tenant` (tenant_id) [btree]
> INDEX `idx_document_line_tx` (tenant_id, transaction_id) [btree]

> CHECK `chk_article_line_requires_article_id`: [object Object]
> CHECK `chk_document_line_movement_type`: [object Object]
> CHECK `document_line_line_type_check`: [object Object]

### `document_line_tracking`

> _⚠ pending annotation_

| Column           | Business Name    | Type                     | Class | Constraints                | Description |
| :--------------- | :--------------- | :----------------------- | :---- | :------------------------- | :---------- |
| tracking_id      | tracking_id      | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id        | tenant_id        | uuid                     | —     | NOT NULL                   |             |
| document_line_id | document_line_id | uuid                     | —     | NOT NULL                   |             |
| serial_number_id | serial_number_id | uuid                     | —     |                            |             |
| batch_no         | batch_no         | text                     | —     |                            |             |
| qty              | qty              | numeric                  | —     | NOT NULL                   |             |
| created_at       | created_at       | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> CHECK `document_line_tracking_check`: [object Object]

### `document_type`

> _⚠ pending annotation_

| Column                | Business Name         | Type                     | Class | Constraints                | Description |
| :-------------------- | :-------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| document_type_id      | document_type_id      | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id             | tenant_id             | uuid                     | —     | NOT NULL                   |             |
| code                  | code                  | varchar(20)              | —     | NOT NULL                   |             |
| name                  | name                  | varchar(100)             | —     | NOT NULL                   |             |
| movement_type         | movement_type         | char(1)                  | —     | NOT NULL                   |             |
| next_document_type_id | next_document_type_id | uuid                     | —     |                            |             |
| requires_warehouse    | requires_warehouse    | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| requires_cost_center  | requires_cost_center  | boolean                  | —     | NOT NULL                   |             |
| is_active             | is_active             | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| sort_order            | sort_order            | integer                  | —     | NOT NULL                   |             |
| created_at            | created_at            | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at            | updated_at            | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_document_type_tenant` (tenant_id) [btree]

> CHECK `document_type_movement_type_check`: [object Object]

### `entity_commands`

> _⚠ pending annotation_

| Column           | Business Name    | Type                     | Class | Constraints                       | Description |
| :--------------- | :--------------- | :----------------------- | :---- | :-------------------------------- | :---------- |
| command_id       | command_id       | uuid                     | PK    | NOT NULL, DEFAULT uuidv7()        |             |
| scope            | scope            | text                     | —     | NOT NULL, DEFAULT global          |             |
| organization_id  | organization_id  | uuid                     | —     |                                   |             |
| tenant_id        | tenant_id        | uuid                     | —     |                                   |             |
| entity_name      | entity_name      | text                     | —     | NOT NULL                          |             |
| command_key      | command_key      | text                     | —     | NOT NULL                          |             |
| handlerkey       | handlerkey       | text                     | —     |                                   |             |
| label            | label            | jsonb                    | —     | NOT NULL                          |             |
| description      | description      | jsonb                    | —     |                                   |             |
| http_method      | http_method      | text                     | —     | NOT NULL, DEFAULT POST            |             |
| route_pattern    | route_pattern    | text                     | —     | NOT NULL                          |             |
| entity_id_param  | entity_id_param  | text                     | —     |                                   |             |
| parent_entity    | parent_entity    | text                     | —     |                                   |             |
| parent_id_source | parent_id_source | text                     | —     |                                   |             |
| input_schema     | input_schema     | jsonb                    | —     | NOT NULL, DEFAULT [object Object] |             |
| server_managed   | server_managed   | jsonb                    | —     | NOT NULL, DEFAULT                 |             |
| ui_placement     | ui_placement     | text                     | —     |                                   |             |
| ui_icon          | ui_icon          | text                     | —     |                                   |             |
| ui_shortcut      | ui_shortcut      | text                     | —     |                                   |             |
| ui_confirm       | ui_confirm       | jsonb                    | —     |                                   |             |
| writes_tables    | writes_tables    | jsonb                    | —     | NOT NULL, DEFAULT                 |             |
| side_effects     | side_effects     | jsonb                    | —     | NOT NULL, DEFAULT                 |             |
| min_role         | min_role         | text                     | —     | NOT NULL, DEFAULT tenant_user     |             |
| visibility       | visibility       | text                     | —     | NOT NULL, DEFAULT tenant          |             |
| command_state    | command_state    | text                     | —     | NOT NULL, DEFAULT published       |             |
| sort_order       | sort_order       | integer                  | —     | NOT NULL                          |             |
| created_at       | created_at       | timestamp with time zone | —     | NOT NULL, DEFAULT now()           |             |

> INDEX `idx_entity_commands_entity` (entity_name, command_state) [btree]
> INDEX `idx_entity_commands_org` (organization_id) [btree]
> INDEX `idx_entity_commands_tenant` (tenant_id) [btree]

### `fact_purchase_event`

> _⚠ pending annotation_

| Column                  | Business Name           | Type                     | Class | Constraints                | Description |
| :---------------------- | :---------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| fact_purchase_event_id  | fact_purchase_event_id  | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id               | tenant_id               | uuid                     | —     | NOT NULL                   |             |
| company_id              | company_id              | uuid                     | —     | NOT NULL                   |             |
| source_document_id      | source_document_id      | uuid                     | —     |                            |             |
| source_document_line_id | source_document_line_id | uuid                     | —     |                            |             |
| supplier_id             | supplier_id             | uuid                     | —     |                            |             |
| article_id              | article_id              | uuid                     | —     |                            |             |
| event_type              | event_type              | text                     | —     | NOT NULL, DEFAULT purchase |             |
| quantity_delta          | quantity_delta          | numeric                  | —     | NOT NULL                   |             |
| amount_net_delta        | amount_net_delta        | numeric                  | —     | NOT NULL                   |             |
| avg_cost_before         | avg_cost_before         | numeric                  | —     |                            |             |
| avg_cost_after          | avg_cost_after          | numeric                  | —     |                            |             |
| fiscal_period_id        | fiscal_period_id        | uuid                     | —     |                            |             |
| booking_period          | booking_period          | date                     | —     |                            |             |
| created_at              | created_at              | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_fact_purchase_tenant_company` (tenant_id, company_id) [btree]
> INDEX `idx_fact_purchase_supplier` (tenant_id, supplier_id) [btree]
> INDEX `idx_fact_purchase_article` (tenant_id, article_id) [btree]
> INDEX `idx_fact_purchase_period` (tenant_id, fiscal_period_id) [btree]

### `fact_sales_event`

> _⚠ pending annotation_

| Column                  | Business Name           | Type                     | Class | Constraints                | Description |
| :---------------------- | :---------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| fact_sales_event_id     | fact_sales_event_id     | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id               | tenant_id               | uuid                     | —     | NOT NULL                   |             |
| company_id              | company_id              | uuid                     | —     |                            |             |
| source_document_id      | source_document_id      | uuid                     | —     |                            |             |
| source_document_line_id | source_document_line_id | uuid                     | —     |                            |             |
| customer_id             | customer_id             | uuid                     | —     |                            |             |
| article_id              | article_id              | uuid                     | —     |                            |             |
| event_type              | event_type              | text                     | —     |                            |             |
| quantity_delta          | quantity_delta          | numeric                  | —     | NOT NULL                   |             |
| amount_net_delta        | amount_net_delta        | numeric                  | —     | NOT NULL                   |             |
| booking_period          | booking_period          | date                     | —     | NOT NULL                   |             |
| created_at              | created_at              | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| transaction_id          | transaction_id          | uuid                     | —     |                            |             |
| cogs_delta              | cogs_delta              | numeric                  | —     |                            |             |
| fiscal_period_id        | fiscal_period_id        | uuid                     | —     |                            |             |

> INDEX `idx_fact_sales_article` (tenant_id, article_id) [btree]
> INDEX `idx_fact_sales_customer` (tenant_id, customer_id) [btree]
> INDEX `idx_fact_sales_period` (tenant_id, booking_period) [btree]
> INDEX `idx_fact_sales_tenant` (tenant_id) [btree]
> INDEX `idx_fact_sales_tx` (tenant_id, transaction_id) [btree]

### `fiscal_period`

> _⚠ pending annotation_

| Column           | Business Name    | Type                     | Class | Constraints                | Description |
| :--------------- | :--------------- | :----------------------- | :---- | :------------------------- | :---------- |
| fiscal_period_id | fiscal_period_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id        | tenant_id        | uuid                     | —     | NOT NULL                   |             |
| company_id       | company_id       | uuid                     | —     | NOT NULL                   |             |
| fiscal_year      | fiscal_year      | integer                  | —     | NOT NULL                   |             |
| period_no        | period_no        | integer                  | —     | NOT NULL                   |             |
| start_date       | start_date       | date                     | —     | NOT NULL                   |             |
| end_date         | end_date         | date                     | —     | NOT NULL                   |             |
| is_closed        | is_closed        | boolean                  | —     | NOT NULL                   |             |
| created_at       | created_at       | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_fiscal_period_tenant_date` (tenant_id, company_id, start_date, end_date) [btree]

### `gl_account`

> _⚠ pending annotation_

| Column        | Business Name | Type                     | Class | Constraints                | Description |
| :------------ | :------------ | :----------------------- | :---- | :------------------------- | :---------- |
| gl_account_id | gl_account_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id     | tenant_id     | uuid                     | —     | NOT NULL                   |             |
| company_id    | company_id    | uuid                     | —     |                            |             |
| account_no    | account_no    | text                     | —     | NOT NULL                   |             |
| name          | name          | text                     | —     | NOT NULL                   |             |
| account_type  | account_type  | text                     | —     | NOT NULL                   |             |
| is_active     | is_active     | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| archived      | archived      | boolean                  | —     | NOT NULL                   |             |
| created_at    | created_at    | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_gl_account_tenant` (tenant_id) [btree]

### `helper_table_registry`

> _⚠ pending annotation_

| Column           | Business Name    | Type                     | Class | Constraints                | Description |
| :--------------- | :--------------- | :----------------------- | :---- | :------------------------- | :---------- |
| id               | id               | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| table_name       | table_name       | text                     | —     | NOT NULL                   |             |
| label            | label            | jsonb                    | —     | NOT NULL                   |             |
| pk_column        | pk_column        | text                     | —     | NOT NULL                   |             |
| display_column   | display_column   | text                     | —     | NOT NULL                   |             |
| display_is_i18n  | display_is_i18n  | boolean                  | —     | NOT NULL                   |             |
| code_column      | code_column      | text                     | —     |                            |             |
| is_tenant_scoped | is_tenant_scoped | boolean                  | —     | NOT NULL                   |             |
| default_filter   | default_filter   | jsonb                    | —     |                            |             |
| sort_column      | sort_column      | text                     | —     | NOT NULL                   |             |
| created_at       | created_at       | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| value_column     | value_column     | text                     | —     |                            |             |
| group            | group            | text                     | —     |                            |             |
| category         | category         | text                     | —     |                            |             |

### `import_batch`

> _⚠ pending annotation_

| Column              | Business Name       | Type                     | Class | Constraints                | Description |
| :------------------ | :------------------ | :----------------------- | :---- | :------------------------- | :---------- |
| batch_id            | batch_id            | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id           | tenant_id           | uuid                     | —     | NOT NULL                   |             |
| connector_id        | connector_id        | uuid                     | —     |                            |             |
| atomicity_mode      | atomicity_mode      | text                     | —     | NOT NULL                   |             |
| status              | status              | text                     | —     | NOT NULL, DEFAULT pending  |             |
| is_rerun            | is_rerun            | boolean                  | —     | NOT NULL                   |             |
| source_batch_id     | source_batch_id     | uuid                     | —     |                            |             |
| posted_entity_count | posted_entity_count | integer                  | —     | NOT NULL                   |             |
| error_summary       | error_summary       | jsonb                    | —     |                            |             |
| created_at          | created_at          | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| processed_at        | processed_at        | timestamp with time zone | —     |                            |             |
| target_entity       | target_entity       | text                     | —     |                            |             |
| target_command_key  | target_command_key  | text                     | —     |                            |             |

> CHECK `import_batch_atomicity_mode_check`: [object Object]
> CHECK `import_batch_status_check`: [object Object]

### `import_row`

> _⚠ pending annotation_

| Column        | Business Name | Type                     | Class | Constraints                | Description |
| :------------ | :------------ | :----------------------- | :---- | :------------------------- | :---------- |
| row_id        | row_id        | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id     | tenant_id     | uuid                     | —     | NOT NULL                   |             |
| batch_id      | batch_id      | uuid                     | —     | NOT NULL                   |             |
| target_entity | target_entity | text                     | —     | NOT NULL                   |             |
| payload       | payload       | jsonb                    | —     | NOT NULL                   |             |
| status        | status        | text                     | —     | NOT NULL, DEFAULT pending  |             |
| error_detail  | error_detail  | jsonb                    | —     |                            |             |
| posted_at     | posted_at     | timestamp with time zone | —     |                            |             |

> CHECK `import_row_status_check`: [object Object]

### `incoterm`

> _⚠ pending annotation_

| Column      | Business Name | Type                     | Class | Constraints                | Description |
| :---------- | :------------ | :----------------------- | :---- | :------------------------- | :---------- |
| incoterm_id | incoterm_id   | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| code        | code          | char(3)                  | —     | NOT NULL                   |             |
| name        | name          | text                     | —     | NOT NULL                   |             |
| created_at  | created_at    | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `incoterm_code_key` (code) [btree]

### `industry`

> _⚠ pending annotation_

| Column            | Business Name     | Type                     | Class | Constraints                | Description |
| :---------------- | :---------------- | :----------------------- | :---- | :------------------------- | :---------- |
| industry_id       | industry_id       | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id         | tenant_id         | uuid                     | —     | NOT NULL                   |             |
| name              | name              | jsonb                    | —     | NOT NULL                   |             |
| is_active         | is_active         | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| archived          | archived          | boolean                  | —     | NOT NULL                   |             |
| created_at        | created_at        | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| custom_attributes | custom_attributes | jsonb                    | —     |                            |             |

> INDEX `idx_industry_tenant` (tenant_id) [btree]

### `inventory_balance`

> _⚠ pending annotation_

| Column                | Business Name         | Type                     | Class | Constraints                | Description |
| :-------------------- | :-------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| inventory_balance_id  | inventory_balance_id  | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id             | tenant_id             | uuid                     | —     | NOT NULL                   |             |
| company_id            | company_id            | uuid                     | —     |                            |             |
| warehouse_id          | warehouse_id          | uuid                     | —     | NOT NULL                   |             |
| article_id            | article_id            | uuid                     | —     | NOT NULL                   |             |
| on_hand_qty           | on_hand_qty           | numeric                  | —     | NOT NULL, DEFAULT 0        |             |
| reserved_qty          | reserved_qty          | numeric                  | —     | NOT NULL, DEFAULT 0        |             |
| as_of_at              | as_of_at              | timestamp with time zone | —     |                            |             |
| created_at            | created_at            | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| available_qty         | available_qty         | numeric                  | —     |                            |             |
| expected_purchase_qty | expected_purchase_qty | numeric                  | —     | NOT NULL, DEFAULT 0        |             |
| gld_purchase          | gld_purchase          | numeric                  | —     |                            |             |
| gld_cost              | gld_cost              | numeric                  | —     |                            |             |

> INDEX `idx_inv_balance_lookup` (tenant_id, warehouse_id, article_id) [btree]
> INDEX `idx_inv_balance_tenant` (tenant_id) [btree]

### `inventory_movement`

> _⚠ pending annotation_

| Column                  | Business Name           | Type                     | Class | Constraints                | Description |
| :---------------------- | :---------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| inventory_movement_id   | inventory_movement_id   | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id               | tenant_id               | uuid                     | —     | NOT NULL                   |             |
| company_id              | company_id              | uuid                     | —     |                            |             |
| warehouse_id            | warehouse_id            | uuid                     | —     | NOT NULL                   |             |
| article_id              | article_id              | uuid                     | —     | NOT NULL                   |             |
| movement_type           | movement_type           | char(1)                  | —     | NOT NULL                   |             |
| qty_delta               | qty_delta               | numeric                  | —     |                            |             |
| movement_date           | movement_date           | timestamp with time zone | —     | NOT NULL                   |             |
| source_document_id      | source_document_id      | uuid                     | —     |                            |             |
| source_document_line_id | source_document_line_id | uuid                     | —     |                            |             |
| created_at              | created_at              | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| transaction_id          | transaction_id          | uuid                     | —     |                            |             |
| absolute_qty            | absolute_qty            | numeric                  | —     |                            |             |
| reference_text          | reference_text          | text                     | —     |                            |             |
| serial_number_id        | serial_number_id        | uuid                     | —     |                            |             |
| batch_no                | batch_no                | text                     | —     |                            |             |

> INDEX `idx_inv_movement_date` (tenant_id, movement_date) [btree]
> INDEX `idx_inv_movement_inventory_anchor` (tenant_id, warehouse_id, article_id, movement_date) [btree]
> INDEX `idx_inv_movement_lookup` (tenant_id, warehouse_id, article_id, movement_date) [btree]
> INDEX `idx_inv_movement_tenant` (tenant_id) [btree]
> INDEX `idx_inv_movement_tx` (tenant_id, transaction_id) [btree]
> INDEX `idx_inv_movement_warehouse_article` (tenant_id, warehouse_id, article_id) [btree]
> INDEX `idx_inventory_movement_batch_balance` (tenant_id, warehouse_id, article_id, batch_no) [btree]

> CHECK `chk_inventory_movement_qty_logic`: [object Object]
> CHECK `chk_inventory_movement_type`: [object Object]

### `journal_entry`

> _⚠ pending annotation_

| Column             | Business Name      | Type                     | Class | Constraints                | Description |
| :----------------- | :----------------- | :----------------------- | :---- | :------------------------- | :---------- |
| journal_entry_id   | journal_entry_id   | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id          | tenant_id          | uuid                     | —     | NOT NULL                   |             |
| company_id         | company_id         | uuid                     | —     | NOT NULL                   |             |
| posting_date       | posting_date       | date                     | —     | NOT NULL                   |             |
| source_document_id | source_document_id | uuid                     | —     |                            |             |
| description        | description        | text                     | —     |                            |             |
| created_at         | created_at         | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_journal_entry_company` (tenant_id, company_id) [btree]
> INDEX `idx_journal_entry_date` (tenant_id, posting_date) [btree]
> INDEX `idx_journal_entry_document` (source_document_id) [btree]
> INDEX `idx_journal_entry_tenant` (tenant_id) [btree]

### `journal_line`

> _⚠ pending annotation_

| Column           | Business Name    | Type                     | Class | Constraints                | Description |
| :--------------- | :--------------- | :----------------------- | :---- | :------------------------- | :---------- |
| journal_line_id  | journal_line_id  | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id        | tenant_id        | uuid                     | —     | NOT NULL                   |             |
| company_id       | company_id       | uuid                     | —     | NOT NULL                   |             |
| journal_entry_id | journal_entry_id | uuid                     | —     | NOT NULL                   |             |
| gl_account_id    | gl_account_id    | uuid                     | —     | NOT NULL                   |             |
| debit_amount     | debit_amount     | numeric                  | —     | NOT NULL, DEFAULT 0        |             |
| credit_amount    | credit_amount    | numeric                  | —     | NOT NULL, DEFAULT 0        |             |
| created_at       | created_at       | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_journal_line_account` (gl_account_id) [btree]
> INDEX `idx_journal_line_entry` (journal_entry_id) [btree]
> INDEX `idx_journal_line_tenant` (tenant_id) [btree]

> CHECK `chk_debit_or_credit`: [object Object]

### `modules`

> _⚠ pending annotation_

| Column    | Business Name | Type  | Class | Constraints                | Description |
| :-------- | :------------ | :---- | :---- | :------------------------- | :---------- |
| module_id | module_id     | uuid  | PK    | NOT NULL, DEFAULT uuidv7() |             |
| slug      | slug          | text  | —     | NOT NULL                   |             |
| label     | label         | jsonb | —     | NOT NULL                   |             |

> INDEX `modules_slug_key` (slug) [btree]

### `number_sequence`

> _⚠ pending annotation_

| Column             | Business Name      | Type                     | Class | Constraints                | Description |
| :----------------- | :----------------- | :----------------------- | :---- | :------------------------- | :---------- |
| number_sequence_id | number_sequence_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id          | tenant_id          | uuid                     | —     | NOT NULL                   |             |
| company_id         | company_id         | uuid                     | —     | NOT NULL                   |             |
| prefix             | prefix             | varchar(10)              | —     | NOT NULL                   |             |
| next_value         | next_value         | integer                  | —     | NOT NULL, DEFAULT 1        |             |
| padding            | padding            | integer                  | —     | NOT NULL, DEFAULT 5        |             |
| archived           | archived           | boolean                  | —     | NOT NULL                   |             |
| created_at         | created_at         | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at         | updated_at         | timestamp with time zone | —     |                            |             |

> INDEX `idx_number_sequence_tenant` (tenant_id) [btree]
> INDEX `idx_number_sequence_tenant_company` (tenant_id, company_id) [btree]

### `organization`

> _⚠ pending annotation_

| Column          | Business Name   | Type                     | Class | Constraints                | Description |
| :-------------- | :-------------- | :----------------------- | :---- | :------------------------- | :---------- |
| organization_id | organization_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| slug            | slug            | varchar(63)              | —     | NOT NULL                   |             |
| name            | name            | text                     | —     | NOT NULL                   |             |
| is_active       | is_active       | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| archived        | archived        | boolean                  | —     | NOT NULL                   |             |
| created_at      | created_at      | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `organization_slug_key` (slug) [btree]

### `payment_term`

> _⚠ pending annotation_

| Column              | Business Name       | Type                     | Class | Constraints                | Description |
| :------------------ | :------------------ | :----------------------- | :---- | :------------------------- | :---------- |
| payment_term_id     | payment_term_id     | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id           | tenant_id           | uuid                     | —     | NOT NULL                   |             |
| name                | name                | jsonb                    | —     | NOT NULL                   |             |
| net_days            | net_days            | integer                  | —     | NOT NULL                   |             |
| discount_days       | discount_days       | integer                  | —     |                            |             |
| discount_percentage | discount_percentage | numeric                  | —     |                            |             |
| is_active           | is_active           | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| archived            | archived            | boolean                  | —     | NOT NULL                   |             |
| created_at          | created_at          | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| custom_attributes   | custom_attributes   | jsonb                    | —     |                            |             |

> INDEX `idx_payment_term_tenant` (tenant_id) [btree]

### `postal_code`

> _⚠ pending annotation_

| Column         | Business Name  | Type                     | Class | Constraints                | Description |
| :------------- | :------------- | :----------------------- | :---- | :------------------------- | :---------- |
| postal_code_id | postal_code_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| country_code   | country_code   | varchar(2)               | —     | NOT NULL                   |             |
| plz            | plz            | text                     | —     | NOT NULL                   |             |
| city           | city           | text                     | —     | NOT NULL                   |             |
| state          | state          | text                     | —     |                            |             |
| archived       | archived       | boolean                  | —     | NOT NULL                   |             |
| created_at     | created_at     | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_postal_code_lookup` (country_code, plz) [btree]

### `price_list`

> _⚠ pending annotation_

| Column        | Business Name | Type                     | Class | Constraints                | Description |
| :------------ | :------------ | :----------------------- | :---- | :------------------------- | :---------- |
| price_list_id | price_list_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id     | tenant_id     | uuid                     | —     | NOT NULL                   |             |
| name          | name          | text                     | —     | NOT NULL                   |             |
| currency_id   | currency_id   | char(3)                  | —     | NOT NULL                   |             |
| is_net        | is_net        | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| is_active     | is_active     | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| archived      | archived      | boolean                  | —     | NOT NULL                   |             |
| created_at    | created_at    | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_price_list_tenant` (tenant_id) [btree]

### `price_list_item`

> _⚠ pending annotation_

| Column             | Business Name      | Type                     | Class | Constraints                | Description |
| :----------------- | :----------------- | :----------------------- | :---- | :------------------------- | :---------- |
| price_list_item_id | price_list_item_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id          | tenant_id          | uuid                     | —     | NOT NULL                   |             |
| price_list_id      | price_list_id      | uuid                     | —     | NOT NULL                   |             |
| article_id         | article_id         | uuid                     | —     | NOT NULL                   |             |
| price              | price              | numeric                  | —     | NOT NULL                   |             |
| valid_from         | valid_from         | date                     | —     |                            |             |
| valid_to           | valid_to           | date                     | —     |                            |             |
| created_at         | created_at         | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_price_list_item_lookup` (price_list_id, article_id, valid_from) [btree]
> INDEX `idx_price_list_item_tenant` (tenant_id) [btree]

### `production_order`

> _⚠ pending annotation_

| Column              | Business Name       | Type                     | Class | Constraints                | Description |
| :------------------ | :------------------ | :----------------------- | :---- | :------------------------- | :---------- |
| production_order_id | production_order_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id           | tenant_id           | uuid                     | —     | NOT NULL                   |             |
| company_id          | company_id          | uuid                     | —     |                            |             |
| order_no            | order_no            | varchar(50)              | —     | NOT NULL                   |             |
| article_id          | article_id          | uuid                     | —     |                            |             |
| quantity            | quantity            | integer                  | —     | NOT NULL                   |             |
| status              | status              | varchar(20)              | —     | NOT NULL, DEFAULT planned  |             |
| planned_start_date  | planned_start_date  | date                     | —     |                            |             |
| planned_end_date    | planned_end_date    | date                     | —     |                            |             |
| actual_start_date   | actual_start_date   | date                     | —     |                            |             |
| actual_end_date     | actual_end_date     | date                     | —     |                            |             |
| is_active           | is_active           | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| archived            | archived            | boolean                  | —     | NOT NULL                   |             |
| created_at          | created_at          | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at          | updated_at          | timestamp with time zone | —     |                            |             |

> INDEX `idx_production_order_article` (article_id) [btree]
> INDEX `idx_production_order_status` (status) [btree]
> INDEX `idx_production_order_tenant` (tenant_id) [btree]

### `schema_annotations`

> _⚠ pending annotation_

| Column          | Business Name   | Type                     | Class | Constraints                | Description |
| :-------------- | :-------------- | :----------------------- | :---- | :------------------------- | :---------- |
| id              | id              | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| table_name      | table_name      | text                     | —     | NOT NULL                   |             |
| column_name     | column_name     | text                     | —     | NOT NULL                   |             |
| business_name   | business_name   | text                     | —     | NOT NULL                   |             |
| description     | description     | text                     | —     | NOT NULL                   |             |
| data_class      | data_class      | text                     | —     | NOT NULL                   |             |
| module_id       | module_id       | uuid                     | —     |                            |             |
| mandatory_for   | mandatory_for   | jsonb                    | —     | NOT NULL, DEFAULT          |             |
| locked_for      | locked_for      | jsonb                    | —     | NOT NULL, DEFAULT          |             |
| ai_generated_at | ai_generated_at | timestamp with time zone | —     |                            |             |
| human_override  | human_override  | boolean                  | —     | NOT NULL                   |             |

### `serial_number`

> _⚠ pending annotation_

| Column               | Business Name        | Type                     | Class | Constraints                | Description |
| :------------------- | :------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| serial_number_id     | serial_number_id     | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id            | tenant_id            | uuid                     | —     | NOT NULL                   |             |
| article_id           | article_id           | uuid                     | —     | NOT NULL                   |             |
| serial_no            | serial_no            | text                     | —     | NOT NULL                   |             |
| status               | status               | text                     | —     | NOT NULL, DEFAULT in_stock |             |
| created_movement_id  | created_movement_id  | uuid                     | —     |                            |             |
| consumed_movement_id | consumed_movement_id | uuid                     | —     |                            |             |
| created_at           | created_at           | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> CHECK `serial_number_status_check`: [object Object]

### `session`

> _⚠ pending annotation_

| Column     | Business Name | Type                     | Class | Constraints             | Description |
| :--------- | :------------ | :----------------------- | :---- | :---------------------- | :---------- |
| id         | id            | text                     | PK    | NOT NULL                |             |
| expires_at | expires_at    | timestamp with time zone | —     | NOT NULL                |             |
| token      | token         | text                     | —     | NOT NULL                |             |
| created_at | created_at    | timestamp with time zone | —     | NOT NULL, DEFAULT now() |             |
| updated_at | updated_at    | timestamp with time zone | —     | NOT NULL, DEFAULT now() |             |
| ip_address | ip_address    | text                     | —     |                         |             |
| user_agent | user_agent    | text                     | —     |                         |             |
| user_id    | user_id       | text                     | —     | NOT NULL                |             |

> INDEX `session_userId_idx` (user_id) [btree]

### `shipping_method`

> _⚠ pending annotation_

| Column                | Business Name         | Type                     | Class | Constraints                | Description |
| :-------------------- | :-------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| shipping_method_id    | shipping_method_id    | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id             | tenant_id             | uuid                     | —     | NOT NULL                   |             |
| name                  | name                  | jsonb                    | —     | NOT NULL                   |             |
| tracking_url_template | tracking_url_template | text                     | —     |                            |             |
| is_active             | is_active             | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| archived              | archived              | boolean                  | —     | NOT NULL                   |             |
| created_at            | created_at            | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| custom_attributes     | custom_attributes     | jsonb                    | —     |                            |             |

> INDEX `idx_shipping_method_tenant` (tenant_id) [btree]

### `system_settings`

> _⚠ pending annotation_

| Column          | Business Name   | Type                     | Class | Constraints                | Description |
| :-------------- | :-------------- | :----------------------- | :---- | :------------------------- | :---------- |
| setting_id      | setting_id      | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| scope           | scope           | text                     | —     | NOT NULL                   |             |
| organization_id | organization_id | uuid                     | —     |                            |             |
| tenant_id       | tenant_id       | uuid                     | —     |                            |             |
| key             | key             | text                     | —     | NOT NULL                   |             |
| value           | value           | jsonb                    | —     | NOT NULL                   |             |
| created_at      | created_at      | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at      | updated_at      | timestamp with time zone | —     |                            |             |

### `tax_class`

> _⚠ pending annotation_

| Column            | Business Name     | Type                     | Class | Constraints                | Description |
| :---------------- | :---------------- | :----------------------- | :---- | :------------------------- | :---------- |
| tax_class_id      | tax_class_id      | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id         | tenant_id         | uuid                     | —     | NOT NULL                   |             |
| code              | code              | text                     | —     | NOT NULL                   |             |
| name              | name              | jsonb                    | —     | NOT NULL                   |             |
| is_active         | is_active         | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| archived          | archived          | boolean                  | —     | NOT NULL                   |             |
| created_at        | created_at        | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| custom_attributes | custom_attributes | jsonb                    | —     |                            |             |

> INDEX `idx_tax_class_tenant` (tenant_id) [btree]

### `tax_code`

> _⚠ pending annotation_

| Column      | Business Name | Type                     | Class | Constraints                | Description |
| :---------- | :------------ | :----------------------- | :---- | :------------------------- | :---------- |
| tax_code_id | tax_code_id   | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id   | tenant_id     | uuid                     | —     | NOT NULL                   |             |
| code        | code          | text                     | —     | NOT NULL                   |             |
| description | description   | text                     | —     |                            |             |
| tax_rate    | tax_rate      | numeric                  | —     | NOT NULL                   |             |
| is_active   | is_active     | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| archived    | archived      | boolean                  | —     | NOT NULL                   |             |
| created_at  | created_at    | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_tax_code_tenant` (tenant_id) [btree]

### `tax_rule`

> _⚠ pending annotation_

| Column                | Business Name         | Type                     | Class | Constraints                | Description |
| :-------------------- | :-------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| tax_rule_id           | tax_rule_id           | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id             | tenant_id             | uuid                     | —     | NOT NULL                   |             |
| customer_tax_class_id | customer_tax_class_id | uuid                     | —     |                            |             |
| article_tax_class_id  | article_tax_class_id  | uuid                     | —     |                            |             |
| country_code          | country_code          | char(2)                  | —     |                            |             |
| tax_code_id           | tax_code_id           | uuid                     | —     | NOT NULL                   |             |
| valid_from            | valid_from            | date                     | —     | NOT NULL                   |             |
| valid_to              | valid_to              | date                     | —     |                            |             |
| created_at            | created_at            | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_tax_rule_lookup` (tenant_id, customer_tax_class_id, article_tax_class_id, country_code, valid_from) [btree]
> INDEX `idx_tax_rule_tenant` (tenant_id) [btree]

### `tenant`

> _⚠ pending annotation_

| Column          | Business Name   | Type                     | Class | Constraints                | Description |
| :-------------- | :-------------- | :----------------------- | :---- | :------------------------- | :---------- |
| tenant_id       | tenant_id       | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| organization_id | organization_id | uuid                     | —     | NOT NULL                   |             |
| slug            | slug            | varchar(63)              | —     | NOT NULL                   |             |
| name            | name            | text                     | —     | NOT NULL                   |             |
| is_base         | is_base         | boolean                  | —     | NOT NULL                   |             |
| is_active       | is_active       | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| archived        | archived        | boolean                  | —     | NOT NULL                   |             |
| created_at      | created_at      | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_tenant_organization` (organization_id) [btree]
> INDEX `tenant_slug_key` (slug) [btree]
> INDEX `uq_single_base_tenant` (is_base) [btree]

### `tenant_connector`

> _⚠ pending annotation_

| Column              | Business Name       | Type                     | Class | Constraints                       | Description |
| :------------------ | :------------------ | :----------------------- | :---- | :-------------------------------- | :---------- |
| tenant_connector_id | tenant_connector_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7()        |             |
| tenant_id           | tenant_id           | uuid                     | —     | NOT NULL                          |             |
| connector_id        | connector_id        | uuid                     | —     | NOT NULL                          |             |
| credentials         | credentials         | jsonb                    | —     | NOT NULL, DEFAULT [object Object] |             |
| is_active           | is_active           | boolean                  | —     | NOT NULL, DEFAULT true            |             |
| archived            | archived            | boolean                  | —     | NOT NULL                          |             |
| created_at          | created_at          | timestamp with time zone | —     | NOT NULL, DEFAULT now()           |             |
| updated_at          | updated_at          | timestamp with time zone | —     | NOT NULL, DEFAULT now()           |             |

### `tenant_connector_mapping`

> _⚠ pending annotation_

| Column              | Business Name       | Type  | Class | Constraints                       | Description |
| :------------------ | :------------------ | :---- | :---- | :-------------------------------- | :---------- |
| mapping_id          | mapping_id          | uuid  | PK    | NOT NULL, DEFAULT uuidv7()        |             |
| tenant_id           | tenant_id           | uuid  | —     | NOT NULL                          |             |
| tenant_connector_id | tenant_connector_id | uuid  | —     | NOT NULL                          |             |
| source_field        | source_field        | text  | —     | NOT NULL                          |             |
| target_table        | target_table        | text  | —     | NOT NULL                          |             |
| target_column       | target_column       | text  | —     | NOT NULL                          |             |
| transform           | transform           | jsonb | —     | NOT NULL, DEFAULT [object Object] |             |
| default_value       | default_value       | jsonb | —     |                                   |             |

### `tenant_fields`

> _⚠ pending annotation_

| Column            | Business Name     | Type                     | Class | Constraints                | Description |
| :---------------- | :---------------- | :----------------------- | :---- | :------------------------- | :---------- |
| field_id          | field_id          | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| scope             | scope             | text                     | —     | NOT NULL, DEFAULT tenant   |             |
| organization_id   | organization_id   | uuid                     | —     |                            |             |
| tenant_id         | tenant_id         | uuid                     | —     |                            |             |
| entity_name       | entity_name       | text                     | —     | NOT NULL                   |             |
| field_name        | field_name        | text                     | —     | NOT NULL                   |             |
| field_type        | field_type        | text                     | —     | NOT NULL                   |             |
| is_required       | is_required       | boolean                  | —     | NOT NULL                   |             |
| custom_attributes | custom_attributes | jsonb                    | —     |                            |             |
| created_at        | created_at        | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| label             | label             | jsonb                    | —     |                            |             |
| help_text         | help_text         | jsonb                    | —     |                            |             |
| is_visible        | is_visible        | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| display_order     | display_order     | integer                  | —     |                            |             |
| import_column     | import_column     | text                     | —     |                            |             |
| import_type       | import_type       | text                     | —     |                            |             |
| import_required   | import_required   | boolean                  | —     | NOT NULL                   |             |
| import_transform  | import_transform  | text                     | —     |                            |             |
| group_id          | group_id          | text                     | —     |                            |             |
| lookup_table      | lookup_table      | text                     | —     |                            |             |
| lookup_filter     | lookup_filter     | jsonb                    | —     |                            |             |

### `tenant_groups`

> _⚠ pending annotation_

| Column            | Business Name     | Type                     | Class | Constraints                | Description |
| :---------------- | :---------------- | :----------------------- | :---- | :------------------------- | :---------- |
| group_id          | group_id          | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| scope             | scope             | text                     | —     | NOT NULL, DEFAULT tenant   |             |
| organization_id   | organization_id   | uuid                     | —     |                            |             |
| tenant_id         | tenant_id         | uuid                     | —     |                            |             |
| entity_name       | entity_name       | text                     | —     | NOT NULL                   |             |
| group_key         | group_key         | text                     | —     | NOT NULL                   |             |
| label             | label             | jsonb                    | —     | NOT NULL                   |             |
| display_order     | display_order     | integer                  | —     | NOT NULL                   |             |
| is_visible        | is_visible        | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| custom_attributes | custom_attributes | jsonb                    | —     |                            |             |
| created_at        | created_at        | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

### `tenant_layouts`

> _⚠ pending annotation_

| Column            | Business Name     | Type                     | Class | Constraints                | Description |
| :---------------- | :---------------- | :----------------------- | :---- | :------------------------- | :---------- |
| layout_id         | layout_id         | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| scope             | scope             | text                     | —     | NOT NULL, DEFAULT tenant   |             |
| organization_id   | organization_id   | uuid                     | —     |                            |             |
| tenant_id         | tenant_id         | uuid                     | —     |                            |             |
| entity_name       | entity_name       | text                     | —     | NOT NULL                   |             |
| layout_key        | layout_key        | text                     | —     | NOT NULL                   |             |
| layout_definition | layout_definition | jsonb                    | —     | NOT NULL                   |             |
| created_at        | created_at        | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

### `tenant_rules`

> _⚠ pending annotation_

| Column          | Business Name   | Type                     | Class | Constraints                | Description |
| :-------------- | :-------------- | :----------------------- | :---- | :------------------------- | :---------- |
| rule_id         | rule_id         | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| scope           | scope           | text                     | —     | NOT NULL, DEFAULT tenant   |             |
| organization_id | organization_id | uuid                     | —     |                            |             |
| tenant_id       | tenant_id       | uuid                     | —     |                            |             |
| entity_name     | entity_name     | text                     | —     | NOT NULL                   |             |
| hook_name       | hook_name       | text                     | —     | NOT NULL                   |             |
| rule_state      | rule_state      | text                     | —     | NOT NULL, DEFAULT draft    |             |
| rule_definition | rule_definition | jsonb                    | —     | NOT NULL                   |             |
| created_at      | created_at      | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| rule_source     | rule_source     | text                     | —     |                            |             |

### `unit`

> _⚠ pending annotation_

| Column            | Business Name     | Type                     | Class | Constraints                | Description |
| :---------------- | :---------------- | :----------------------- | :---- | :------------------------- | :---------- |
| unit_id           | unit_id           | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id         | tenant_id         | uuid                     | —     | NOT NULL                   |             |
| code              | code              | varchar(10)              | —     | NOT NULL                   |             |
| name              | name              | jsonb                    | —     | NOT NULL                   |             |
| is_active         | is_active         | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| archived          | archived          | boolean                  | —     | NOT NULL                   |             |
| created_at        | created_at        | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| custom_attributes | custom_attributes | jsonb                    | —     |                            |             |

> INDEX `idx_unit_tenant` (tenant_id) [btree]

### `user`

> _⚠ pending annotation_

| Column          | Business Name   | Type                     | Class | Constraints             | Description |
| :-------------- | :-------------- | :----------------------- | :---- | :---------------------- | :---------- |
| id              | id              | text                     | PK    | NOT NULL                |             |
| name            | name            | text                     | —     | NOT NULL                |             |
| email           | email           | text                     | —     | NOT NULL                |             |
| email_verified  | email_verified  | boolean                  | —     | NOT NULL                |             |
| image           | image           | text                     | —     |                         |             |
| created_at      | created_at      | timestamp with time zone | —     | NOT NULL, DEFAULT now() |             |
| updated_at      | updated_at      | timestamp with time zone | —     | NOT NULL, DEFAULT now() |             |
| display_name    | display_name    | text                     | —     |                         |             |
| is_active       | is_active       | boolean                  | —     | NOT NULL, DEFAULT true  |             |
| last_company_id | last_company_id | text                     | —     |                         |             |
| is_system_admin | is_system_admin | boolean                  | —     | NOT NULL                |             |
| locale          | locale          | varchar(5)               | —     | NOT NULL, DEFAULT de    |             |

### `user_tenant`

> _⚠ pending annotation_

| Column    | Business Name | Type | Class | Constraints                | Description |
| :-------- | :------------ | :--- | :---- | :------------------------- | :---------- |
| id        | id            | uuid | PK    | NOT NULL, DEFAULT uuidv7() |             |
| user_id   | user_id       | text | —     | NOT NULL                   |             |
| tenant_id | tenant_id     | uuid | —     | NOT NULL                   |             |
| role      | role          | text | —     | NOT NULL                   |             |

> INDEX `idx_user_tenant_tenant` (tenant_id) [btree]
> INDEX `idx_user_tenant_user` (user_id) [btree]

### `verification`

> _⚠ pending annotation_

| Column     | Business Name | Type                     | Class | Constraints             | Description |
| :--------- | :------------ | :----------------------- | :---- | :---------------------- | :---------- |
| id         | id            | text                     | PK    | NOT NULL                |             |
| identifier | identifier    | text                     | —     | NOT NULL                |             |
| value      | value         | text                     | —     | NOT NULL                |             |
| expires_at | expires_at    | timestamp with time zone | —     | NOT NULL                |             |
| created_at | created_at    | timestamp with time zone | —     | NOT NULL, DEFAULT now() |             |
| updated_at | updated_at    | timestamp with time zone | —     | NOT NULL, DEFAULT now() |             |

> INDEX `verification_identifier_idx` (identifier) [btree]

### `warehouse`

> _⚠ pending annotation_

| Column       | Business Name | Type                     | Class | Constraints                | Description |
| :----------- | :------------ | :----------------------- | :---- | :------------------------- | :---------- |
| warehouse_id | warehouse_id  | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id    | tenant_id     | uuid                     | —     | NOT NULL                   |             |
| company_id   | company_id    | uuid                     | —     |                            |             |
| code         | code          | text                     | —     | NOT NULL                   |             |
| name         | name          | text                     | —     | NOT NULL                   |             |
| is_active    | is_active     | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| archived     | archived      | boolean                  | —     | NOT NULL                   |             |
| created_at   | created_at    | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_warehouse_tenant` (tenant_id) [btree]
