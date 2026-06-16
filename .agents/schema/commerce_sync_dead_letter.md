# Table: `commerce_sync_dead_letter`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| item_id | item_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| run_id | run_id | uuid | — | NOT NULL |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| sales_channel_id | sales_channel_id | uuid | — | NOT NULL |  |
| entity_type | entity_type | external_sync_entity_type | — | NOT NULL |  |
| internal_id | internal_id | uuid | — | NOT NULL |  |
| error_message | error_message | text | — | NOT NULL |  |
| attempt_count | attempt_count | integer | — | NOT NULL, DEFAULT 1 |  |
| last_attempted_at | last_attempted_at | timestamp with time zone | — | NOT NULL |  |
| next_retry_at | next_retry_at | timestamp with time zone | — |  |  |
| status | status | commerce_sync_dlq_status | — | NOT NULL, DEFAULT pending |  |
| resolved_at | resolved_at | timestamp with time zone | — |  |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |
| updated_at | updated_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |

> INDEX `idx_commerce_sync_dlq_tenant` (tenant_id) [btree]
> INDEX `idx_commerce_sync_dlq_pending` (tenant_id, status, next_retry_at) [btree]
> INDEX `idx_commerce_sync_dlq_item` (tenant_id, sales_channel_id, entity_type, internal_id) [btree]

