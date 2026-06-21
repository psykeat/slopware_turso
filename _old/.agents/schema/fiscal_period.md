# Table: `fiscal_period`

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
