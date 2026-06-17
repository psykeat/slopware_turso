# Table: `commerce_webhook_event`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| event_id | event_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| sales_channel_id | sales_channel_id | uuid | — | NOT NULL |  |
| event_name | event_name | text | — | NOT NULL |  |
| dedupe_key | dedupe_key | text | — | NOT NULL |  |
| payload | payload | jsonb | — | NOT NULL |  |
| status | status | commerce_webhook_event_status | — | NOT NULL, DEFAULT pending |  |
| attempt_count | attempt_count | integer | — | NOT NULL |  |
| error_message | error_message | text | — |  |  |
| next_retry_at | next_retry_at | timestamp with time zone | — |  |  |
| processed_at | processed_at | timestamp with time zone | — |  |  |
| received_at | received_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |
| updated_at | updated_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |

> INDEX `idx_commerce_webhook_event_tenant` (tenant_id) [btree]
> INDEX `idx_commerce_webhook_event_pending` (tenant_id, sales_channel_id, status, next_retry_at) [btree]

