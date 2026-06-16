# Table: `commerce_sync_run_step`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| step_id | step_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| run_id | run_id | uuid | — | NOT NULL |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| sales_channel_id | sales_channel_id | uuid | — | NOT NULL |  |
| entity_type | entity_type | external_sync_entity_type | — | NOT NULL |  |
| phase | phase | commerce_sync_step_phase | — | NOT NULL |  |
| status | status | commerce_sync_step_status | — | NOT NULL, DEFAULT pending |  |
| sequence | sequence | integer | — | NOT NULL |  |
| batch_no | batch_no | integer | — | NOT NULL |  |
| cursor | cursor | text | — |  |  |
| planned_items | planned_items | integer | — | NOT NULL |  |
| succeeded_items | succeeded_items | integer | — | NOT NULL |  |
| failed_items | failed_items | integer | — | NOT NULL |  |
| payload_summary | payload_summary | jsonb | — |  |  |
| error_summary | error_summary | text | — |  |  |
| started_at | started_at | timestamp with time zone | — |  |  |
| completed_at | completed_at | timestamp with time zone | — |  |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |
| updated_at | updated_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |

> INDEX `idx_commerce_sync_step_run` (run_id) [btree]
> INDEX `idx_commerce_sync_step_tenant` (tenant_id) [btree]

