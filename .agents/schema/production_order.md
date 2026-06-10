# Table: `production_order`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| production_order_id | production_order_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| company_id | company_id | uuid | — |  |  |
| order_no | order_no | varchar(50) | — | NOT NULL |  |
| article_id | article_id | uuid | — |  |  |
| quantity | quantity | integer | — | NOT NULL |  |
| status | status | varchar(20) | — | NOT NULL, DEFAULT planned |  |
| planned_start_date | planned_start_date | date | — |  |  |
| planned_end_date | planned_end_date | date | — |  |  |
| actual_start_date | actual_start_date | date | — |  |  |
| actual_end_date | actual_end_date | date | — |  |  |
| archived | archived | boolean | — | NOT NULL |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |
| updated_at | updated_at | timestamp with time zone | — |  |  |

> INDEX `idx_production_order_article` (article_id) [btree]
> INDEX `idx_production_order_status` (status) [btree]
> INDEX `idx_production_order_tenant` (tenant_id) [btree]

