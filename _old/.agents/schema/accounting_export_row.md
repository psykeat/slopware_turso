# Table: `accounting_export_row`

> _⚠ pending annotation_

| Column             | Business Name      | Type                     | Class | Constraints                | Description |
| :----------------- | :----------------- | :----------------------- | :---- | :------------------------- | :---------- |
| row_id             | row_id             | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| batch_id           | batch_id           | uuid                     | —     | NOT NULL                   |             |
| tenant_id          | tenant_id          | uuid                     | —     | NOT NULL                   |             |
| company_id         | company_id         | uuid                     | —     | NOT NULL                   |             |
| posting_date       | posting_date       | date                     | —     | NOT NULL                   |             |
| gl_account_id      | gl_account_id      | uuid                     | —     | NOT NULL                   |             |
| cost_center_id     | cost_center_id     | uuid                     | —     |                            |             |
| tax_code_id        | tax_code_id        | uuid                     | —     |                            |             |
| debit_amount       | debit_amount       | numeric                  | —     | NOT NULL, DEFAULT 0        |             |
| credit_amount      | credit_amount      | numeric                  | —     | NOT NULL, DEFAULT 0        |             |
| currency_id        | currency_id        | char(3)                  | —     |                            |             |
| source_document_id | source_document_id | uuid                     | —     |                            |             |
| source_document_no | source_document_no | text                     | —     |                            |             |
| created_at         | created_at         | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_accounting_export_row_batch` (batch_id) [btree]
> INDEX `idx_accounting_export_row_tenant` (tenant_id) [btree]
