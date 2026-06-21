# Table: `commerce_sync_run`

> _⚠ pending annotation_

| Column              | Business Name       | Type                        | Class | Constraints                | Description |
| :------------------ | :------------------ | :-------------------------- | :---- | :------------------------- | :---------- |
| run_id              | run_id              | uuid                        | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id           | tenant_id           | uuid                        | —     | NOT NULL                   |             |
| sales_channel_id    | sales_channel_id    | uuid                        | —     | NOT NULL                   |             |
| direction           | direction           | commerce_sync_run_direction | —     | NOT NULL                   |             |
| mode                | mode                | commerce_sync_run_mode      | —     | NOT NULL                   |             |
| status              | status              | commerce_sync_run_status    | —     | NOT NULL, DEFAULT queued   |             |
| requested_entities  | requested_entities  | jsonb                       | —     | NOT NULL                   |             |
| dry_run             | dry_run             | boolean                     | —     | NOT NULL                   |             |
| total_items         | total_items         | integer                     | —     | NOT NULL                   |             |
| succeeded_items     | succeeded_items     | integer                     | —     | NOT NULL                   |             |
| failed_items        | failed_items        | integer                     | —     | NOT NULL                   |             |
| error_summary       | error_summary       | text                        | —     |                            |             |
| started_at          | started_at          | timestamp with time zone    | —     |                            |             |
| completed_at        | completed_at        | timestamp with time zone    | —     |                            |             |
| cancel_requested_at | cancel_requested_at | timestamp with time zone    | —     |                            |             |
| created_by_user_id  | created_by_user_id  | text                        | —     |                            |             |
| created_at          | created_at          | timestamp with time zone    | —     | NOT NULL, DEFAULT now()    |             |
| updated_at          | updated_at          | timestamp with time zone    | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_commerce_sync_run_tenant` (tenant_id) [btree]
> INDEX `idx_commerce_sync_run_sales_channel` (tenant_id, sales_channel_id) [btree]
> INDEX `idx_commerce_sync_run_status` (tenant_id, status) [btree]
