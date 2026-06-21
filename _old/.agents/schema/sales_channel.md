# Table: `sales_channel`

> _⚠ pending annotation_

| Column             | Business Name      | Type                     | Class | Constraints                | Description |
| :----------------- | :----------------- | :----------------------- | :---- | :------------------------- | :---------- |
| sales_channel_id   | sales_channel_id   | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id          | tenant_id          | uuid                     | —     | NOT NULL                   |             |
| name               | name               | text                     | —     | NOT NULL                   |             |
| platform           | platform           | ecommerce_platform       | —     | NOT NULL                   |             |
| api_url            | api_url            | text                     | —     | NOT NULL                   |             |
| credentials        | credentials        | jsonb                    | —     |                            |             |
| master_data_policy | master_data_policy | text                     | —     |                            |             |
| is_active          | is_active          | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| created_at         | created_at         | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at         | updated_at         | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_sales_channel_tenant` (tenant_id) [btree]
