# Table: `fact_sales_event`

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
