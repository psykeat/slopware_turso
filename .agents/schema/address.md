# Table: `address`

> _⚠ pending annotation_

| Column                      | Business Name               | Type                     | Class | Constraints                | Description |
| :-------------------------- | :-------------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| address_id                  | address_id                  | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id                   | tenant_id                   | uuid                     | —     | NOT NULL                   |             |
| address_no                  | address_no                  | text                     | —     | NOT NULL                   |             |
| is_customer                 | is_customer                 | boolean                  | —     | NOT NULL                   |             |
| is_supplier                 | is_supplier                 | boolean                  | —     | NOT NULL                   |             |
| company_name                | company_name                | text                     | —     |                            |             |
| first_name                  | first_name                  | text                     | —     |                            |             |
| last_name                   | last_name                   | text                     | —     |                            |             |
| notiztext                   | notiztext                   | text                     | —     |                            |             |
| notiztext_source_entity     | notiztext_source_entity     | text                     | —     |                            |             |
| notiztext_source_id         | notiztext_source_id         | uuid                     | —     |                            |             |
| notiztext_source_field      | notiztext_source_field      | text                     | —     |                            |             |
| notiztext_linked_at         | notiztext_linked_at         | timestamp with time zone | —     |                            |             |
| notiztext_overridden_at     | notiztext_overridden_at     | timestamp with time zone | —     |                            |             |
| langtext                    | langtext                    | text                     | —     |                            |             |
| langtext_source_entity      | langtext_source_entity      | text                     | —     |                            |             |
| langtext_source_id          | langtext_source_id          | uuid                     | —     |                            |             |
| langtext_source_field       | langtext_source_field       | text                     | —     |                            |             |
| langtext_linked_at          | langtext_linked_at          | timestamp with time zone | —     |                            |             |
| langtext_overridden_at      | langtext_overridden_at      | timestamp with time zone | —     |                            |             |
| warntext                    | warntext                    | text                     | —     |                            |             |
| warntext_source_entity      | warntext_source_entity      | text                     | —     |                            |             |
| warntext_source_id          | warntext_source_id          | uuid                     | —     |                            |             |
| warntext_source_field       | warntext_source_field       | text                     | —     |                            |             |
| warntext_linked_at          | warntext_linked_at          | timestamp with time zone | —     |                            |             |
| warntext_overridden_at      | warntext_overridden_at      | timestamp with time zone | —     |                            |             |
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
| archived_at                 | archived_at                 | timestamp with time zone | —     |                            |             |
| custom_attributes           | custom_attributes           | jsonb                    | —     |                            |             |
| created_at                  | created_at                  | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at                  | updated_at                  | timestamp with time zone | —     |                            |             |
| default_delivery_address_id | default_delivery_address_id | uuid                     | —     |                            |             |
| search_text                 | search_text                 | text                     | —     |                            |             |
| address_category_id         | address_category_id         | uuid                     | —     |                            |             |

> INDEX `idx_address_category` (tenant_id, address_category_id) [btree]
> INDEX `idx_address_customer` (tenant_id, is_customer) [btree]
> INDEX `idx_address_supplier` (tenant_id, is_supplier) [btree]
> INDEX `idx_address_tenant` (tenant_id) [btree]
