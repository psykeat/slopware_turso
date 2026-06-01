# Table: `fact_purchase_event`

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
