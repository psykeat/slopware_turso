# Table: `document`

> _⚠ pending annotation_

| Column                    | Business Name             | Type                     | Class | Constraints                | Description |
| :------------------------ | :------------------------ | :----------------------- | :---- | :------------------------- | :---------- |
| document_id               | document_id               | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id                 | tenant_id                 | uuid                     | —     | NOT NULL                   |             |
| company_id                | company_id                | uuid                     | —     | NOT NULL                   |             |
| document_type             | document_type             | char(1)                  | —     | NOT NULL                   |             |
| document_direction        | document_direction        | text                     | —     | NOT NULL                   |             |
| document_no               | document_no               | text                     | —     | NOT NULL                   |             |
| status                    | status                    | text                     | —     | NOT NULL                   |             |
| customer_id               | customer_id               | uuid                     | —     |                            |             |
| currency_id               | currency_id               | char(3)                  | —     |                            |             |
| print_options             | print_options             | jsonb                    | —     |                            |             |
| document_date             | document_date             | date                     | —     | NOT NULL                   |             |
| posting_date              | posting_date              | date                     | —     |                            |             |
| total_net                 | total_net                 | numeric                  | —     |                            |             |
| total_tax                 | total_tax                 | numeric                  | —     |                            |             |
| total_gross               | total_gross               | numeric                  | —     |                            |             |
| version_no                | version_no                | integer                  | —     | NOT NULL, DEFAULT 1        |             |
| posted_at                 | posted_at                 | timestamp with time zone | —     |                            |             |
| posted_by                 | posted_by                 | text                     | —     |                            |             |
| cancelled_at              | cancelled_at              | timestamp with time zone | —     |                            |             |
| storno_document_id        | storno_document_id        | uuid                     | —     |                            |             |
| custom_attributes         | custom_attributes         | jsonb                    | —     |                            |             |
| created_at                | created_at                | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at                | updated_at                | timestamp with time zone | —     |                            |             |
| transaction_id            | transaction_id            | uuid                     | —     | NOT NULL                   |             |
| parent_document_id        | parent_document_id        | uuid                     | —     |                            |             |
| document_group_id         | document_group_id         | uuid                     | —     |                            |             |
| archived_at               | archived_at               | timestamp with time zone | —     |                            |             |
| billing_address           | billing_address           | jsonb                    | —     |                            |             |
| delivery_address          | delivery_address          | jsonb                    | —     |                            |             |
| delivery_address_id       | delivery_address_id       | uuid                     | —     |                            |             |
| note_text                 | note_text                 | text                     | —     |                            |             |
| note_text_source_entity   | note_text_source_entity   | text                     | —     |                            |             |
| note_text_source_id       | note_text_source_id       | uuid                     | —     |                            |             |
| note_text_source_field    | note_text_source_field    | text                     | —     |                            |             |
| note_text_linked_at       | note_text_linked_at       | timestamp with time zone | —     |                            |             |
| note_text_overridden_at   | note_text_overridden_at   | timestamp with time zone | —     |                            |             |
| pre_text                  | pre_text                  | text                     | —     |                            |             |
| pre_text_source_entity    | pre_text_source_entity    | text                     | —     |                            |             |
| pre_text_source_id        | pre_text_source_id        | uuid                     | —     |                            |             |
| pre_text_source_field     | pre_text_source_field     | text                     | —     |                            |             |
| pre_text_linked_at        | pre_text_linked_at        | timestamp with time zone | —     |                            |             |
| pre_text_overridden_at    | pre_text_overridden_at    | timestamp with time zone | —     |                            |             |
| post_text                 | post_text                 | text                     | —     |                            |             |
| post_text_source_entity   | post_text_source_entity   | text                     | —     |                            |             |
| post_text_source_id       | post_text_source_id       | uuid                     | —     |                            |             |
| post_text_source_field    | post_text_source_field    | text                     | —     |                            |             |
| post_text_linked_at       | post_text_linked_at       | timestamp with time zone | —     |                            |             |
| post_text_overridden_at   | post_text_overridden_at   | timestamp with time zone | —     |                            |             |
| storno_text               | storno_text               | text                     | —     |                            |             |
| storno_text_source_entity | storno_text_source_entity | text                     | —     |                            |             |
| storno_text_source_id     | storno_text_source_id     | uuid                     | —     |                            |             |
| storno_text_source_field  | storno_text_source_field  | text                     | —     |                            |             |
| storno_text_linked_at     | storno_text_linked_at     | timestamp with time zone | —     |                            |             |
| storno_text_overridden_at | storno_text_overridden_at | timestamp with time zone | —     |                            |             |
| payment_term_id           | payment_term_id           | uuid                     | —     |                            |             |
| shipping_method_id        | shipping_method_id        | uuid                     | —     |                            |             |
| document_type_id          | document_type_id          | uuid                     | —     |                            |             |
| warehouse_id              | warehouse_id              | uuid                     | —     |                            |             |
| target_warehouse_id       | target_warehouse_id       | uuid                     | —     |                            |             |
| is_paid                   | is_paid                   | boolean                  | —     | NOT NULL                   |             |
| paid_at                   | paid_at                   | timestamp with time zone | —     |                            |             |
| paid_amount               | paid_amount               | numeric                  | —     |                            |             |
| total_weight_kg           | total_weight_kg           | numeric                  | —     |                            |             |
| agent_id                  | agent_id                  | uuid                     | —     |                            |             |
| commission_rate           | commission_rate           | numeric(5, 2)            | —     |                            |             |

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
> INDEX `idx_document_agent` (tenant_id, agent_id) [btree]

> CHECK `chk_document_type`: [object Object]
