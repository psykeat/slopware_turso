# Table: `accounting_export_batch`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| batch_id | batch_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| company_id | company_id | uuid | — | NOT NULL |  |
| fiscal_period_id | fiscal_period_id | uuid | — | NOT NULL |  |
| status | status | text | — | NOT NULL, DEFAULT pending |  |
| row_count | row_count | integer | — | NOT NULL |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |
| exported_at | exported_at | timestamp with time zone | — |  |  |
| created_by | created_by | uuid | — |  |  |

> INDEX `idx_accounting_export_batch_tenant` (tenant_id) [btree]
> INDEX `idx_accounting_export_batch_period` (tenant_id, fiscal_period_id) [btree]

> CHECK `chk_accounting_export_batch_status`: [object Object]

