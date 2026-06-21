# Table: `company`

> _⚠ pending annotation_

| Column                          | Business Name                   | Type                     | Class | Constraints                | Description |
| :------------------------------ | :------------------------------ | :----------------------- | :---- | :------------------------- | :---------- |
| company_id                      | company_id                      | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id                       | tenant_id                       | uuid                     | —     | NOT NULL                   |             |
| company_no                      | company_no                      | text                     | —     | NOT NULL                   |             |
| name                            | name                            | text                     | —     | NOT NULL                   |             |
| legal_name                      | legal_name                      | text                     | —     |                            |             |
| country_code                    | country_code                    | char(2)                  | —     | NOT NULL                   |             |
| currency_id                     | currency_id                     | char(3)                  | —     | NOT NULL                   |             |
| vat_id                          | vat_id                          | text                     | —     |                            |             |
| archived                        | archived                        | boolean                  | —     | NOT NULL                   |             |
| created_at                      | created_at                      | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| address_line_1                  | address_line_1                  | text                     | —     |                            |             |
| address_line_2                  | address_line_2                  | text                     | —     |                            |             |
| city                            | city                            | text                     | —     |                            |             |
| postal_code                     | postal_code                     | text                     | —     |                            |             |
| phone_landline                  | phone_landline                  | text                     | —     |                            |             |
| phone_mobile                    | phone_mobile                    | text                     | —     |                            |             |
| email                           | email                           | text                     | —     |                            |             |
| homepage                        | homepage                        | text                     | —     |                            |             |
| tax_number                      | tax_number                      | text                     | —     |                            |             |
| tax_authority                   | tax_authority                   | text                     | —     |                            |             |
| gln                             | gln                             | text                     | —     |                            |             |
| eori_no                         | eori_no                         | text                     | —     |                            |             |
| duns_no                         | duns_no                         | text                     | —     |                            |             |
| custom_attributes               | custom_attributes               | jsonb                    | —     |                            |             |
| bank_name                       | bank_name                       | text                     | —     |                            |             |
| bank_bic                        | bank_bic                        | text                     | —     |                            |             |
| bank_iban                       | bank_iban                       | text                     | —     |                            |             |
| fiscal_year_start_month         | fiscal_year_start_month         | integer                  | —     | NOT NULL, DEFAULT 1        |             |
| default_warehouse_id            | default_warehouse_id            | uuid                     | —     |                            |             |
| copy_long_texts_only_on_change  | copy_long_texts_only_on_change  | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| print_address_long_text         | print_address_long_text         | boolean                  | —     | NOT NULL                   |             |
| print_pre_text                  | print_pre_text                  | boolean                  | —     | NOT NULL                   |             |
| print_post_text                 | print_post_text                 | boolean                  | —     | NOT NULL                   |             |
| print_position_texts            | print_position_texts            | boolean                  | —     | NOT NULL                   |             |
| show_article_image_in_entry     | show_article_image_in_entry     | boolean                  | —     | NOT NULL                   |             |
| show_article_image_on_documents | show_article_image_on_documents | boolean                  | —     | NOT NULL                   |             |

> INDEX `idx_company_tenant` (tenant_id) [btree]
> INDEX `idx_company_tenant_archived` (tenant_id, archived) [btree]

> CHECK `company_fiscal_year_start_month_check`: [object Object]
