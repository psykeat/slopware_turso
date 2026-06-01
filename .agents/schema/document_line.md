# Table: `document_line`

> _⚠ pending annotation_

| Column                  | Business Name           | Type                     | Class | Constraints                | Description |
| :---------------------- | :---------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| document_line_id        | document_line_id        | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id               | tenant_id               | uuid                     | —     | NOT NULL                   |             |
| document_id             | document_id             | uuid                     | —     | NOT NULL                   |             |
| line_no                 | line_no                 | integer                  | —     | NOT NULL                   |             |
| article_id              | article_id              | uuid                     | —     |                            |             |
| article_text_snapshot   | article_text_snapshot   | text                     | —     |                            |             |
| lang_text               | lang_text               | text                     | —     |                            |             |
| lang_text_source_entity | lang_text_source_entity | text                     | —     |                            |             |
| lang_text_source_id     | lang_text_source_id     | uuid                     | —     |                            |             |
| lang_text_source_field  | lang_text_source_field  | text                     | —     |                            |             |
| lang_text_linked_at     | lang_text_linked_at     | timestamp with time zone | —     |                            |             |
| lang_text_overridden_at | lang_text_overridden_at | timestamp with time zone | —     |                            |             |
| quantity                | quantity                | numeric                  | —     | NOT NULL                   |             |
| unit                    | unit                    | text                     | —     |                            |             |
| net_price               | net_price               | numeric                  | —     | NOT NULL                   |             |
| discount_percentage     | discount_percentage     | numeric                  | —     |                            |             |
| tax_code_id             | tax_code_id             | uuid                     | —     |                            |             |
| tax_amount              | tax_amount              | numeric                  | —     |                            |             |
| line_total_net          | line_total_net          | numeric                  | —     |                            |             |
| warehouse_id            | warehouse_id            | uuid                     | —     |                            |             |
| cost_center_id          | cost_center_id          | uuid                     | —     |                            |             |
| created_at              | created_at              | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| archived_at             | archived_at             | timestamp with time zone | —     |                            |             |
| transaction_id          | transaction_id          | uuid                     | —     |                            |             |
| movement_type           | movement_type           | char(1)                  | —     |                            |             |
| line_type               | line_type               | varchar(20)              | —     | NOT NULL, DEFAULT article  |             |
| bom_group_id            | bom_group_id            | uuid                     | —     |                            |             |

> INDEX `idx_document_line_article` (article_id) [btree]
> INDEX `idx_document_line_document` (document_id) [btree]
> INDEX `idx_document_line_tenant_document` (tenant_id, document_id) [btree]
> INDEX `idx_document_line_tenant_archived` (tenant_id, archived_at) [btree]
> INDEX `idx_document_line_tenant` (tenant_id) [btree]
> INDEX `idx_document_line_tx` (tenant_id, transaction_id) [btree]

> CHECK `chk_article_line_requires_article_id`: [object Object]
> CHECK `chk_document_line_movement_type`: [object Object]
> CHECK `document_line_line_type_check`: [object Object]
